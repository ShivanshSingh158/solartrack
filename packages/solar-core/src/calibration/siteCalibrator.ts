import { computeDayIrradianceBenchmarks } from '../intelligence/dailyLedger.ts';
import {
  type SoilingAccumulatorState,
  advanceSoilingDayState,
  evaluateDayRawCoverage,
  evaluateSingleDaySoilingStep,
  resolveInitialCleanYmd,
} from '../intelligence/soilingModel.ts';
import { SOLAR_CONSTANTS } from '../physics/index.ts';
import type {
  CleaningEvent,
  DailyAtmosphereRecord,
  DailyGenerationRecord,
  SiteCalibrationReport,
} from '../types/intelligence.ts';
import type { InverterLossCoeffs, MountingType } from '../types/settings.ts';
import {
  type ClearTelemetryDayEntry,
  type SiteGeometryCalibrationParams,
  buildCalibrationDayModel,
  estimateHourlyShadeFactors,
  fitSiteAzimuthDeg,
} from './horizonAndAzimuth.ts';
import { fitEmpiricalInverterCurve } from './inverterFitter.ts';

/**
 * Self-Learning Site Physics Calibrator:
 * - Fits K_site from midday (10:30–14:00) upper-envelope on clear, high-coverage days
 *   normalized for surface soiling.
 * - Fits empirical quadratic inverter loss curve from paired DC/AC telemetry.
 * - Sweeps effective roof azimuth and derives P88 hourly shade factors.
 */
export function calibrateSitePhysicsFromHistory(params: {
  pastYmds: string[];
  dayMap: Map<string, DailyAtmosphereRecord>;
  generationByYmd: Record<string, DailyGenerationRecord>;
  manualWashMap: Map<string, CleaningEvent>;
  commissioningYmd: string;
  todayYmd: string;
  nowMinutesIst: number;
  rainResetDailyMm: number;
  dcCapacityKwp: number;
  acInverterCapacityKw: number;
  latDeg: number;
  lonDeg: number;
  tiltDeg: number;
  azimuthDeg: number;
  mountingType: MountingType;
  roofAlbedo: number;
  thermalCoeffPerC?: number;
  dcCleanFactor?: number;
  basePrAtStc?: number;
  inverterEfficiency?: number;
  useCalibratedTwin?: boolean;
  kSiteOverride?: number | null;
  manualInverterCoeffs?: Partial<InverterLossCoeffs> | null;
}): SiteCalibrationReport {
  const dcCap = params.dcCapacityKwp;
  const acCap = params.acInverterCapacityKw;
  const invFit = fitEmpiricalInverterCurve(params.generationByYmd, dcCap, acCap);
  const hasManualInv =
    params.manualInverterCoeffs &&
    Number.isFinite(params.manualInverterCoeffs.tareKw as number) &&
    Number(params.manualInverterCoeffs.tareKw) > 0;
  const appliedInvCoeffs: InverterLossCoeffs = hasManualInv
    ? {
        tareKw: Number(params.manualInverterCoeffs!.tareKw),
        linearLoss: Number(params.manualInverterCoeffs!.linearLoss ?? invFit.coeffs.linearLoss),
        quadLoss: Number(params.manualInverterCoeffs!.quadLoss ?? invFit.coeffs.quadLoss),
        cutoffKw: invFit.coeffs.cutoffKw,
        referenceAcKw: acCap,
      }
    : invFit.coeffs;

  const geom: SiteGeometryCalibrationParams = {
    dcCapacityKwp: dcCap,
    acInverterCapacityKw: acCap,
    latDeg: params.latDeg,
    lonDeg: params.lonDeg,
    tiltDeg: params.tiltDeg,
    azimuthDeg: params.azimuthDeg,
    mountingType: params.mountingType,
    roofAlbedo: params.roofAlbedo,
    thermalCoeffPerC: params.thermalCoeffPerC,
    dcCleanFactor: params.dcCleanFactor,
    basePrAtStc: params.basePrAtStc,
    inverterEfficiency: params.inverterEfficiency,
    appliedInvCoeffs,
  };

  const completedYmds = params.pastYmds.filter((y) => y < params.todayYmd);
  const initialCleanYmd = resolveInitialCleanYmd(completedYmds, params.manualWashMap, params.commissioningYmd);

  let soilState: SoilingAccumulatorState = {
    looseLoss: 0,
    cementedLoss: 0,
    stickyFilmActive: false,
    lastClean: { ymd: initialCleanYmd, source: 'manual' },
  };

  const cleanCandidates: Array<{ ymd: string; ratio: number }> = [];
  const clearTelemetryDays: ClearTelemetryDayEntry[] = [];

  for (const ymd of completedYmds) {
    const day = params.dayMap.get(ymd);
    if (!day) continue;
    const step = evaluateSingleDaySoilingStep(day, params.tiltDeg, params.rainResetDailyMm);
    const manualWash = params.manualWashMap.get(ymd);

    const benchRaw = computeDayIrradianceBenchmarks(day, dcCap, params.latDeg, params.tiltDeg, {
      dcCapacityKwp: dcCap,
      acInverterCapacityKw: acCap,
      lonDeg: params.lonDeg,
      azimuthDegrees: params.azimuthDeg,
      gtiReferenceAzimuthDeg: day.gtiFetchedAzimuthDeg ?? params.azimuthDeg,
      mountingType: params.mountingType,
      roofAlbedo: params.roofAlbedo,
      thermalCoeffPerC: params.thermalCoeffPerC,
      dcCleanFactor: params.dcCleanFactor,
      basePrAtStc: params.basePrAtStc,
      inverterEfficiency: params.inverterEfficiency,
      kSite: 1.0,
      inverterLossCoeffs: appliedInvCoeffs,
    });

    const soilRes = advanceSoilingDayState(soilState, {
      ymd,
      step,
      manualWash,
      fogHours: benchRaw.fogHours,
    });
    soilState = soilRes.nextState;

    const gen = params.generationByYmd[ymd];
    const isConfirmed = Boolean(gen?.isConfirmed && gen.realKwh !== null && gen.realKwh > 1.5);
    let coveragePct: number | null = typeof gen?.onlineCoveragePct === 'number' ? gen.onlineCoveragePct : null;
    if (coveragePct === null && gen?.rawSeries?.length) {
      coveragePct = evaluateDayRawCoverage(
        gen.rawSeries,
        day.sunrise,
        day.sunset,
        ymd,
        params.todayYmd,
        params.nowMinutesIst
      ).onlineCoveragePct;
    }

    const highCov = coveragePct === null || coveragePct >= 85;
    const isClearWeather = benchRaw.dayCloudAvgPct < 15 && step.rainMm < 0.2 && benchRaw.fogHours === 0;
    const soilFactor = Math.max(0.84, 1 - soilRes.totalParticleLossPct / 100);

    if (isConfirmed && isClearWeather && highCov && benchRaw.weatherCleanKwh > 1.5) {
      const genSeries = gen?.rawSeries?.length
        ? gen.rawSeries.find((s) => /generationPower/i.test(String(s?.variable || '')) || s?.variable === 'generationPower') ||
          gen.rawSeries[0]
        : null;

      if (genSeries?.data?.length) {
        clearTelemetryDays.push({
          ymd,
          day,
          genSeriesData: genSeries.data,
          step,
          soilLossPct: soilRes.totalParticleLossPct,
        });
        const baseModel = buildCalibrationDayModel(day, step, soilRes.totalParticleLossPct, params.azimuthDeg, 1.0, geom);
        const middayRatios: number[] = [];
        for (const pt of genSeries.data) {
          const m = /(\d{2}):(\d{2})/.exec(String(pt.time || ''));
          if (!m) continue;
          const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          if (mins < 10 * 60 + 30 || mins > 14 * 60) continue;
          const modKw = baseModel.lookupAtMinute(mins).kw;
          if (modKw < 0.35) continue;
          const r = (Number(pt.value) || 0) / modKw;
          if (r >= 0.55 && r <= 1.28) middayRatios.push(r);
        }
        if (middayRatios.length >= 10) {
          middayRatios.sort((a, b) => a - b);
          const p75 = middayRatios[Math.min(middayRatios.length - 1, Math.floor((middayRatios.length - 1) * 0.75))];
          if (p75 >= 0.80) {
            cleanCandidates.push({ ymd, ratio: p75 });
          }
        }
      } else {
        const dayRatio = Number(gen!.realKwh) / Math.max(0.5, benchRaw.weatherCleanKwh * soilFactor);
        if (dayRatio >= 0.82 && dayRatio <= 1.28) {
          cleanCandidates.push({ ymd, ratio: dayRatio });
        }
      }
    }
  }

  let kSiteLearned: number | null = null;
  if (cleanCandidates.length > 0) {
    const sorted = cleanCandidates.map((c) => c.ratio).sort((a, b) => a - b);
    const p65Idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.65));
    kSiteLearned = +Math.min(SOLAR_CONSTANTS.KSITE_MAX, Math.max(SOLAR_CONSTANTS.KSITE_MIN, sorted[p65Idx])).toFixed(4);
  }

  const enabled = params.useCalibratedTwin !== false;
  const hasOverride =
    typeof params.kSiteOverride === 'number' &&
    Number.isFinite(params.kSiteOverride) &&
    params.kSiteOverride > 0;
  let kSiteApplied = 1.0;
  let kSiteSource: SiteCalibrationReport['kSiteSource'] = 'raw_uncalibrated';
  if (!enabled) {
    kSiteApplied = 1.0;
    kSiteSource = 'raw_uncalibrated';
  } else if (hasOverride) {
    kSiteApplied = +Math.min(SOLAR_CONSTANTS.KSITE_MAX, Math.max(SOLAR_CONSTANTS.KSITE_MIN, Number(params.kSiteOverride))).toFixed(4);
    kSiteSource = 'manual_override';
  } else if (kSiteLearned !== null) {
    kSiteApplied = kSiteLearned;
    kSiteSource = 'clean_day_fitted';
  } else {
    kSiteApplied = 1.0;
    kSiteSource = 'insufficient_clean_days';
  }

  const { effectiveAzimuthDeg, azimuthLearned, azimuthSampleDays } = fitSiteAzimuthDeg(
    clearTelemetryDays,
    kSiteApplied,
    enabled,
    geom
  );
  const { hourlyShadeFactors, shadedHoursSummary } = estimateHourlyShadeFactors(
    clearTelemetryDays,
    effectiveAzimuthDeg,
    kSiteApplied,
    geom
  );

  const apparentDcCapacityKwp =
    kSiteLearned !== null ? +(dcCap * kSiteLearned).toFixed(2) : null;
  const azimuthOffsetDeg = +(effectiveAzimuthDeg - params.azimuthDeg).toFixed(1);

  const note = !enabled
    ? 'Raw uncalibrated physics mode (K_site = 1.000).'
    : hasOverride
      ? `Manual K_site override active (${kSiteApplied.toFixed(3)}x) with ${invFit.source === 'empirical_fitted' ? `empirical inverter fit (${invFit.samplesCount} pts)` : 'Waaree baseline inverter curve'}.`
      : kSiteLearned !== null
        ? `Calibrated K_site = ${kSiteApplied.toFixed(3)}x across ${cleanCandidates.length} clear day(s)${azimuthLearned ? ` · Fitted Azimuth ${effectiveAzimuthDeg >= 0 ? '+' : ''}${effectiveAzimuthDeg}°` : ''}.`
        : 'Awaiting clear-sky confirmation days before locking K_site.';

  return {
    enabled,
    kSiteApplied,
    kSiteLearned,
    kSiteSource,
    cleanDaysUsed: cleanCandidates.length,
    cleanDayYmds: cleanCandidates.map((c) => c.ymd),
    apparentDcCapacityKwp,
    effectiveAzimuthDeg,
    azimuthOffsetDeg,
    azimuthLearned,
    azimuthSampleDays,
    inverterCoeffs: appliedInvCoeffs,
    inverterSource: hasManualInv ? 'manual_override' : invFit.source,
    inverterSamplesCount: invFit.samplesCount,
    inverterRmseWatts: invFit.rmseWatts,
    hourlyShadeFactors,
    shadedHoursSummary,
    note,
  };
}
