import { parseRawTelemetry } from '../analytics/telemetryParser.ts';
import { calibrateSitePhysicsFromHistory } from '../calibration/siteCalibrator.ts';
import {
  SOLAR_CONSTANTS,
  computeDailySolarPhysicsModel,
  detectSkyAnomalyEvents,
} from '../physics/index.ts';
import type {
  CleaningEvent,
  DailyAtmosphereRecord,
  DailyPerformanceLedgerEntry,
  DipAttributionCategory,
  SolarIntelligenceInput,
  SolarIntelligenceReport,
  UnifiedPhysicsOptions,
  WashActionState,
  WeeklyComparisonWindow,
} from '../types/intelligence.ts';
import type { SkyAnomalyPeakLensing, UnforecastedSkyEvent } from '../types/physics.ts';
import type { MountingType } from '../types/settings.ts';
import type { RawSeries } from '../types/telemetry.ts';
import {
  DEFAULT_LAT_DEG,
  DEFAULT_TILT_DEG,
  computeDayIrradianceBenchmarks,
} from './dailyLedger.ts';
import { buildWeeklyWindow, resolveTomorrowForecastWindow } from './forecastOutlook.ts';
import { classifyDayGapArchitecture } from './gapClassifier.ts';
import {
  SOILING_THRESHOLDS,
  type SoilingAccumulatorState,
  advanceSoilingDayState,
  diffDaysYmd,
  evaluateDayRawCoverage,
  evaluateSingleDaySoilingStep,
  formatShortLabel,
  isValidYmd,
  resolveInitialCleanYmd,
  shiftYmd,
} from './soilingModel.ts';

/**
 * Main Pure Entry Point: Executes complete multi-day hydrological, aerosol,
 * empirical EEPROM performance, week-over-week comparison, site calibration, and wash recommendation engine.
 */
export function computeSolarIntelligence(input: SolarIntelligenceInput): SolarIntelligenceReport {
  const safeCap = Math.max(0.5, input.capacityKwp || 3.0);
  const dcCap = Math.max(0.5, input.dcCapacityKwp ?? safeCap);
  const acCap = Math.max(0.5, input.acInverterCapacityKw ?? safeCap);
  const tariff = Math.max(0, input.tariffPerKwh || 8.0);
  const tiltDeg = input.tiltDegrees ?? DEFAULT_TILT_DEG;
  const azimuthDeg = input.azimuthDegrees ?? SOLAR_CONSTANTS.DEFAULT_AZIMUTH_DEG;
  const latDeg = input.latitudeDeg ?? DEFAULT_LAT_DEG;
  const lonDeg = input.longitudeDeg ?? SOLAR_CONSTANTS.DEFAULT_LON;
  const mountingType: MountingType = input.mountingType === 'flush_rcc' ? 'flush_rcc' : 'open_rack';
  const roofAlbedo =
    typeof input.roofAlbedo === 'number' && Number.isFinite(input.roofAlbedo)
      ? Math.max(0.05, Math.min(0.8, input.roofAlbedo))
      : SOLAR_CONSTANTS.DEFAULT_ALBEDO;
  const todayYmd = input.todayYmd;
  const minYmd = isValidYmd(input.commissioningYmd) ? input.commissioningYmd : '2026-10-28';
  const customWashTriggerPct =
    typeof input.washRecommendPct === 'number' && Number.isFinite(input.washRecommendPct) && input.washRecommendPct >= 3
      ? input.washRecommendPct
      : SOILING_THRESHOLDS.washRecommendPct;
  const customStickyTriggerPct = +(customWashTriggerPct * (4.5 / 7.0)).toFixed(1);
  const customRainResetMm =
    typeof input.rainResetDailyMm === 'number' && Number.isFinite(input.rainResetDailyMm) && input.rainResetDailyMm >= 1
      ? input.rainResetDailyMm
      : SOILING_THRESHOLDS.rainFullDailyMm;

  // Index manual washes by YYYY-MM-DD
  const manualWashMap = new Map<string, CleaningEvent>();
  for (const ev of input.manualCleanEvents || []) {
    const ymd = isValidYmd(ev.ymd) ? ev.ymd : String(ev.timestampIso || '').slice(0, 10);
    if (!isValidYmd(ymd)) continue;
    manualWashMap.set(ymd, { ...ev, ymd, type: ev.type || 'manual' });
  }

  // Sort atmosphere records chronologically & split history+today vs future forecast
  const dayMap = new Map<string, DailyAtmosphereRecord>();
  for (const d of input.days || []) {
    if (isValidYmd(d.ymd)) dayMap.set(d.ymd, d);
  }

  const allSortedYmds = Array.from(dayMap.keys()).sort();
  const pastAndTodayYmds = allSortedYmds.filter((y) => y >= minYmd && y <= todayYmd);
  const futureYmds = allSortedYmds.filter((y) => y > todayYmd);

  const manualInverterCoeffs =
    typeof input.inverterTareKw === 'number' && Number.isFinite(input.inverterTareKw) && input.inverterTareKw > 0
      ? {
          tareKw: input.inverterTareKw,
          linearLoss: input.inverterLinearLoss ?? SOLAR_CONSTANTS.DEFAULT_INV_LINEAR_LOSS,
          quadLoss: input.inverterQuadLoss ?? SOLAR_CONSTANTS.DEFAULT_INV_QUAD_LOSS,
          cutoffKw: SOLAR_CONSTANTS.DEFAULT_INV_CUTOFF_KW,
          referenceAcKw: acCap,
        }
      : null;

  const siteCalibration = calibrateSitePhysicsFromHistory({
    pastYmds: pastAndTodayYmds,
    dayMap,
    generationByYmd: input.generationByYmd,
    manualWashMap,
    commissioningYmd: minYmd,
    todayYmd,
    nowMinutesIst: input.nowMinutesIst,
    rainResetDailyMm: customRainResetMm,
    dcCapacityKwp: dcCap,
    acInverterCapacityKw: acCap,
    latDeg,
    lonDeg,
    tiltDeg,
    azimuthDeg,
    mountingType,
    roofAlbedo,
    thermalCoeffPerC: input.thermalCoeffPerC,
    dcCleanFactor: input.dcCleanFactor,
    basePrAtStc: input.basePrAtStc,
    inverterEfficiency: input.inverterEfficiency,
    useCalibratedTwin: input.useCalibratedTwin,
    kSiteOverride: input.kSiteOverride,
    manualInverterCoeffs,
  });

  const physicsOverrides: UnifiedPhysicsOptions = {
    dcCapacityKwp: dcCap,
    acInverterCapacityKw: acCap,
    lonDeg,
    azimuthDegrees:
      siteCalibration.enabled &&
      typeof siteCalibration.effectiveAzimuthDeg === 'number' &&
      Number.isFinite(siteCalibration.effectiveAzimuthDeg)
        ? siteCalibration.effectiveAzimuthDeg
        : azimuthDeg,
    mountingType,
    roofAlbedo,
    thermalCoeffPerC: input.thermalCoeffPerC,
    dcCleanFactor: input.dcCleanFactor,
    basePrAtStc: input.basePrAtStc,
    inverterEfficiency: input.inverterEfficiency,
    kSite: siteCalibration.kSiteApplied,
    gtiReferenceAzimuthDeg: azimuthDeg,
    inverterLossCoeffs: siteCalibration.inverterCoeffs,
    hourlyShadeFactors: siteCalibration.enabled ? siteCalibration.hourlyShadeFactors : null,
  };

  const initialCleanYmd = resolveInitialCleanYmd(pastAndTodayYmds, manualWashMap, minYmd);
  let soilMainState: SoilingAccumulatorState = {
    looseLoss: 0,
    cementedLoss: 0,
    stickyFilmActive: false,
    lastClean: { ymd: initialCleanYmd, source: 'manual' },
  };
  const cleaningHistory: CleaningEvent[] = [];
  const dailyLedger: DailyPerformanceLedgerEntry[] = [];

  const todayRec = input.generationByYmd[todayYmd];
  const todayActive = Boolean(
    input.todayHasLivePackets ||
      (todayRec?.rawSeries && todayRec.rawSeries.length > 0) ||
      (todayRec?.isConfirmed && (todayRec.realKwh ?? 0) > 0.05)
  );
  let latestActiveYmd: string | null = todayActive ? todayYmd : null;
  for (const y of pastAndTodayYmds) {
    const g = input.generationByYmd[y];
    const hasPosYield = Boolean(g?.isConfirmed && (g.realKwh ?? 0) > 0);
    const hasRawPackets = Array.isArray(g?.rawSeries) && g.rawSeries.length > 0;
    if ((hasPosYield || hasRawPackets) && (!latestActiveYmd || y > latestActiveYmd)) {
      latestActiveYmd = y;
    }
  }
  const manualGridOffSet = new Set(
    (input.manualGridOffDates || []).map((d) => String(d || '').trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  );

  for (const ymd of pastAndTodayYmds) {
    const day = dayMap.get(ymd)!;
    const bench = computeDayIrradianceBenchmarks(day, dcCap, latDeg, tiltDeg, physicsOverrides);
    const step = evaluateSingleDaySoilingStep(day, tiltDeg, customRainResetMm);
    const manualWash = manualWashMap.get(ymd);

    const soilRes = advanceSoilingDayState(soilMainState, {
      ymd,
      step,
      manualWash,
      fogHours: bench.fogHours,
    });
    soilMainState = soilRes.nextState;
    const { dailyDelta, totalParticleLossPct, eventTag, eventLabel, cleaningEventToPush } = soilRes;
    if (cleaningEventToPush) {
      cleaningHistory.push(cleaningEventToPush);
    }

    const gen = input.generationByYmd[ymd];
    const isConfirmed = Boolean(gen?.isConfirmed && gen.realKwh !== null && gen.realKwh >= 0);
    const realKwh = isConfirmed ? +(gen!.realKwh ?? 0).toFixed(2) : null;

    let onlineCoveragePct: number | null =
      typeof gen?.onlineCoveragePct === 'number' ? gen.onlineCoveragePct : null;
    let coverageNote: string | null = gen?.coverageNote ?? null;
    if (gen?.rawSeries && gen.rawSeries.length > 0) {
      const cov = evaluateDayRawCoverage(
        gen.rawSeries,
        day.sunrise,
        day.sunset,
        ymd,
        todayYmd,
        input.nowMinutesIst
      );
      if (onlineCoveragePct === null) {
        onlineCoveragePct = cov.onlineCoveragePct;
        coverageNote = cov.note;
      }
    }

    const modeledAfterSoilingKwh = +(bench.weatherCleanKwh * (1 - totalParticleLossPct / 100)).toFixed(2);
    const realVsModelPct =
      isConfirmed && realKwh !== null && bench.weatherCleanKwh > 0.3 && ymd < todayYmd
        ? Math.round((realKwh / bench.weatherCleanKwh) * 100)
        : null;
    const realVsIdealPct =
      isConfirmed && realKwh !== null && bench.idealClearSkyKwh > 0.3 && ymd < todayYmd
        ? Math.round((realKwh / bench.idealClearSkyKwh) * 100)
        : null;

    let dipCategory: DipAttributionCategory = 'OPTIMAL';
    let dipReasonLabel = 'Normal solar yield';
    const isPast = ymd < todayYmd;

    if (!isPast) {
      dipCategory = isConfirmed ? 'OPTIMAL' : 'PENDING_SYNC';
      dipReasonLabel = isConfirmed
        ? 'Live today in progress'
        : 'Awaiting Wi-Fi reconnect before 00:00 IST EDay reset';
    } else if (!isConfirmed || realKwh === null || realKwh === 0) {
      if (ymd === minYmd) {
        dipCategory = 'OPTIMAL';
        dipReasonLabel = 'Commissioning day (late installation — awaiting first full day)';
      } else {
        const isPermanentUnlogged =
          (latestActiveYmd !== null && ymd < latestActiveYmd) || diffDaysYmd(todayYmd, ymd) >= 2;
        if (isPermanentUnlogged) {
          dipCategory = 'WIFI_OUTAGE_UNLOGGED';
          dipReasonLabel = `Wi-Fi Offline All Day — Cloud Missed · Twin Est: ~${modeledAfterSoilingKwh.toFixed(1)} kWh`;
        } else {
          dipCategory = 'PENDING_SYNC';
          dipReasonLabel = 'Inverter Wi-Fi offline — awaiting EDay sync';
        }
      }
    } else if (
      onlineCoveragePct !== null &&
      (onlineCoveragePct < 80 ||
        (coverageNote && /ended early/i.test(coverageNote)) ||
        (onlineCoveragePct < 85 && (realVsModelPct ?? 100) < 90))
    ) {
      dipCategory = 'OUTAGE_GAP';
      dipReasonLabel = coverageNote || `Partial runtime (${onlineCoveragePct}% online)`;
    } else if (realVsModelPct !== null && realVsModelPct < 82) {
      if (bench.weatherAttenuationPct >= 32 || step.rainMm >= 0.5 || bench.dayCloudAvgPct >= 55) {
        dipCategory = 'CLOUD_RAIN';
        dipReasonLabel = `Cloud / rain blocked ~${bench.weatherAttenuationPct}% sky irradiance`;
      } else if (bench.fogHours >= 2 || bench.aodAvg >= 0.72) {
        dipCategory = 'FOG_HAZE';
        dipReasonLabel =
          bench.fogHours >= 2
            ? `Morning fog (${bench.fogHours}h low vis)`
            : `Heavy smog haze (AOD ${bench.aodAvg})`;
      } else if (onlineCoveragePct !== null && onlineCoveragePct < 90) {
        dipCategory = 'OUTAGE_GAP';
        dipReasonLabel = coverageNote || 'Short midday telemetry gap';
      } else if (totalParticleLossPct >= 4.0) {
        dipCategory = 'SOILING_DRIFT';
        dipReasonLabel = `Clear-sky yield below clean model (-${100 - realVsModelPct}%)`;
      } else {
        dipCategory = 'BELOW_BASELINE';
        dipReasonLabel = `Below clean curve (${realVsModelPct}%) — check shade/grid`;
      }
    } else if (bench.weatherAttenuationPct >= 30) {
      dipCategory = 'CLOUD_RAIN';
      dipReasonLabel = `Partly cloudy day (-${bench.weatherAttenuationPct}% sky irradiance)`;
    }

    const needDayCurve =
      (isConfirmed && Boolean(gen?.rawSeries?.length)) ||
      (!isPast && Boolean(gen?.rawSeries?.length)) ||
      (ymd !== minYmd && (!isConfirmed || realKwh === null || realKwh === 0));
    const dayCurve = needDayCurve
      ? computeDailySolarPhysicsModel({
          sunriseIso: day.sunrise,
          sunsetIso: day.sunset,
          ymd,
          lat: latDeg,
          lon: lonDeg,
          hourlyGti: Array.isArray(day.hourlyGti) ? day.hourlyGti : [],
          hourlyGtiInstant: Array.isArray(day.hourlyGtiInstant) ? day.hourlyGtiInstant : [],
          minutely15Gti: Array.isArray(day.minutely15Gti) ? day.minutely15Gti : [],
          minutely15GtiInstant: Array.isArray(day.minutely15GtiInstant) ? day.minutely15GtiInstant : [],
          radiationMjM2: day.radiationMjM2 ?? 14.5,
          capacityKwp: acCap,
          dcCapacityKwp: dcCap,
          acInverterCapacityKw: acCap,
          arrayTiltDeg: tiltDeg,
          arrayAzimuthDeg: physicsOverrides.azimuthDegrees ?? azimuthDeg,
          gtiReferenceAzimuthDeg: day.gtiFetchedAzimuthDeg ?? azimuthDeg,
          mountingType,
          roofAlbedo,
          surfaceLossPct: totalParticleLossPct,
          windSpeedKmh: step.windAvgKmh,
          aod: step.aodAvg,
          pm10: step.pm10Avg,
          hourlyTempC: day.hourlyTempC,
          hourlyWindKmh: day.hourlyWindKmh,
          hourlyAod: day.hourlyAod,
          hourlyPm10: day.hourlyPm10,
          hourlyDiffuse: day.hourlyDiffuse,
          hourlyDni: day.hourlyDni,
          hourlyCloudCover: day.hourlyCloudCover,
          thermalCoeffPerC: physicsOverrides.thermalCoeffPerC,
          dcCleanFactor: physicsOverrides.dcCleanFactor,
          basePrAtStc: physicsOverrides.basePrAtStc,
          inverterEfficiency: physicsOverrides.inverterEfficiency,
          kSite: physicsOverrides.kSite,
          hourlyShadeFactors: physicsOverrides.hourlyShadeFactors,
          inverterLossCoeffs: physicsOverrides.inverterLossCoeffs,
        })
      : null;

    const parsedRaw =
      dayCurve && Array.isArray(gen?.rawSeries) && gen.rawSeries.length > 0
        ? parseRawTelemetry(
            gen.rawSeries.map((s) => ({
              variable: String(s?.variable || ''),
              data: Array.isArray(s?.data) ? s.data : [],
            })) as RawSeries[],
            dayCurve.sunriseMin,
            dayCurve.sunsetMin
          )
        : {
            segments: [],
            gaps: [],
            allPoints: [],
            peakKw: 0,
            peakMinutes: 0,
            onlineIntegratedKwh: 0,
            hasData: false,
            firstPointMin: null,
            lastPointMin: null,
            firstActiveMin: null,
            lastActiveMin: null,
            presentZeroMinutes: 0,
            presentZeroWindows: [],
          };

    const isManualGridOff = manualGridOffSet.has(ymd);
    const gapClassification =
      dayCurve && ymd !== minYmd && (isPast || parsedRaw.hasData || !todayActive)
        ? classifyDayGapArchitecture({
            parsed: parsedRaw,
            physicsModel: dayCurve,
            eepromKwh: realKwh ?? 0,
            surfaceLossPct: totalParticleLossPct,
            ymd,
            todayYmd,
            commissioningYmd: minYmd,
            nowMinutesIst: input.nowMinutesIst,
            isManualGridOff,
            isWifiOfflineFullDay: ymd === todayYmd && !todayActive && input.nowMinutesIst > dayCurve.sunriseMin + 45,
          })
        : null;

    if (
      parsedRaw.hasData &&
      parsedRaw.presentZeroMinutes >= 90 &&
      gapClassification?.suspectedGridCut &&
      (dipCategory === 'OUTAGE_GAP' || dipCategory === 'BELOW_BASELINE')
    ) {
      const zeroHrs = +(parsedRaw.presentZeroMinutes / 60).toFixed(1);
      dipReasonLabel = `Grid/inverter offline ${zeroHrs}h (0.00 kW logged — 0 buffer)`;
    } else if (
      !isPast &&
      gapClassification &&
      gapClassification.bufferKwh >= 0.25 &&
      isConfirmed
    ) {
      dipReasonLabel = `Live today + ${gapClassification.bufferKwh.toFixed(2)} kWh AM/outage buffer`;
    }

    let skyAnomalyBadge: string | null = null;
    let cloudEdgeLensing: SkyAnomalyPeakLensing | null = null;
    let unforecastedSkyEvent: UnforecastedSkyEvent | null = null;
    if (isConfirmed && gen?.rawSeries?.length && dayCurve && dipCategory !== 'OUTAGE_GAP') {
      const anomalies = detectSkyAnomalyEvents({
        rawSeries: gen.rawSeries,
        baseModel: dayCurve,
        hourlyCloudCover: day.hourlyCloudCover,
        dayCloudAvgPct: bench.dayCloudAvgPct,
      });
      cloudEdgeLensing = anomalies.peakLensing;
      unforecastedSkyEvent = anomalies.unforecastedEvent;
      if (isPast && unforecastedSkyEvent && (dipCategory === 'OPTIMAL' || dipCategory === 'SOILING_DRIFT' || dipCategory === 'BELOW_BASELINE')) {
        dipCategory = unforecastedSkyEvent.kind === 'unforecasted_haze_veil' ? 'FOG_HAZE' : 'CLOUD_RAIN';
        dipReasonLabel = unforecastedSkyEvent.reasonLabel;
      }
      skyAnomalyBadge = unforecastedSkyEvent?.badge || cloudEdgeLensing?.badge || null;
    }

    const isClearCheckDay =
      isPast &&
      isConfirmed &&
      (realKwh ?? 0) > 1.0 &&
      bench.dayCloudAvgPct < 35 &&
      bench.fogHours === 0 &&
      step.rainMm < 0.2 &&
      !unforecastedSkyEvent &&
      (onlineCoveragePct === null || onlineCoveragePct >= 88);

    const computedBufferKwh = (() => {
      if (ymd === minYmd) return 0;
      if (gapClassification) return +gapClassification.bufferKwh.toFixed(2);
      if (dipCategory === 'WIFI_OUTAGE_UNLOGGED') {
        return isManualGridOff ? 0 : +Math.max(0, modeledAfterSoilingKwh).toFixed(2);
      }
      return 0;
    })();

    dailyLedger.push({
      ymd,
      shortLabel: formatShortLabel(ymd),
      sunrise: day.sunrise ?? null,
      sunset: day.sunset ?? null,
      idealClearSkyKwh: bench.idealClearSkyKwh,
      weatherCleanKwh: bench.weatherCleanKwh,
      radBaselineKwh: bench.radBaselineKwh,
      modeledAfterSoilingKwh,
      realKwh,
      isConfirmed,
      onlineCoveragePct,
      coverageNote,
      weatherAttenuationPct: bench.weatherAttenuationPct,
      hazeOpticalLossPct: bench.hazeOpticalLossPct,
      realVsModelPct,
      realVsIdealPct,
      pm10Avg: step.pm10Avg,
      pm25Avg: step.pm25Avg,
      dustAvg: step.dustAvg,
      aodAvg: step.aodAvg,
      usAqiMax: step.usAqiMax,
      rainMm: step.rainMm,
      maxHourlyRainMm: step.maxHourlyRainMm,
      dewGlueHours: step.dewGlueHours,
      fogHours: bench.fogHours,
      minVisibilityM: bench.minVisibilityM,
      windAvgKmh: step.windAvgKmh,
      dayCloudAvgPct: bench.dayCloudAvgPct,
      dailySoilingDeltaPct: dailyDelta,
      particleSurfaceLossPct: totalParticleLossPct,
      stickyFilmActive: soilMainState.stickyFilmActive,
      eventTag,
      eventLabel,
      dipCategory,
      dipReasonLabel,
      skyAnomalyBadge,
      cloudEdgeLensing,
      unforecastedSkyEvent,
      unloggedEstimatedKwh: computedBufferKwh,
      bufferKwh: computedBufferKwh,
      eepromConfirmedPreKwh: gapClassification ? +gapClassification.eepromConfirmedPreKwh.toFixed(2) : 0,
      onlineKwh: gapClassification ? +gapClassification.onlineKwh.toFixed(2) : realKwh ?? 0,
      suspectedGridCut: Boolean(gapClassification?.suspectedGridCut),
      isManualGridOff,
      gapHoles: gapClassification?.holes || [],
      isClearCheckDay,
    });
  }

  const { stickyFilmActive, lastClean } = soilMainState;

  const latestLedger = dailyLedger[dailyLedger.length - 1];
  const particleLossPct = latestLedger ? latestLedger.particleSurfaceLossPct : 0;

  const ledgerSinceClean = dailyLedger.filter((d) => d.ymd >= lastClean.ymd && d.ymd < todayYmd);
  const clearCheckDays = ledgerSinceClean.filter((d) => d.isClearCheckDay && d.realVsModelPct !== null);
  let empiricalDriftPct: number | null = null;
  let empiricalUsed = false;

  if (clearCheckDays.length >= 4) {
    const calcSmogNormalizedPi = (d: DailyPerformanceLedgerEntry): number => {
      return d.realKwh !== null && d.weatherCleanKwh > 0.3
        ? (d.realKwh / d.weatherCleanKwh) * 100
        : (d.realVsModelPct ?? 100);
    };
    const baselineSlice = clearCheckDays.slice(0, 2);
    const recentSlice = clearCheckDays.slice(-2);
    const baselinePi = baselineSlice.reduce((s, d) => s + calcSmogNormalizedPi(d), 0) / baselineSlice.length;
    const recentPi = recentSlice.reduce((s, d) => s + calcSmogNormalizedPi(d), 0) / recentSlice.length;
    empiricalDriftPct = +Math.max(0, Math.min(22, baselinePi - recentPi)).toFixed(1);
    empiricalUsed = true;
  }

  let effectiveSurfaceLossPct = particleLossPct;
  let confidenceSource: 'empirical_blended' | 'clear_verified' | 'particle_physics' = 'particle_physics';
  let confidenceLabel = 'Particle Physics Est.';

  if (empiricalUsed && empiricalDriftPct !== null) {
    const minGuard = Math.max(0, particleLossPct * 0.45);
    const maxGuard = Math.max(particleLossPct * 1.85, particleLossPct + 4.5);
    const clampedEmp = Math.min(maxGuard, Math.max(minGuard, empiricalDriftPct));
    effectiveSurfaceLossPct = +Math.min(
      SOILING_THRESHOLDS.maxLossPct,
      particleLossPct * 0.6 + clampedEmp * 0.4
    ).toFixed(1);
    confidenceSource = 'empirical_blended';
    confidenceLabel = `Particle + Real Drift (${clearCheckDays.length} clear days)`;
  } else if (clearCheckDays.length >= 1) {
    confidenceSource = 'clear_verified';
    confidenceLabel = `Particle Model · ${clearCheckDays.length} clear check`;
  }

  const sinceCleanIncludingToday = dailyLedger.filter((d) => d.ymd >= lastClean.ymd);
  const daysSinceWash = Math.max(0, diffDaysYmd(todayYmd, lastClean.ymd));
  const statsDays = sinceCleanIncludingToday.length > 0 ? sinceCleanIncludingToday : dailyLedger.slice(-1);
  const avgPm10Since = +(
    statsDays.reduce((s, d) => s + d.pm10Avg, 0) / Math.max(1, statsDays.length)
  ).toFixed(0);
  const avgPm25Since = +(
    statsDays.reduce((s, d) => s + d.pm25Avg, 0) / Math.max(1, statsDays.length)
  ).toFixed(0);
  const avgDustSince = +(
    statsDays.reduce((s, d) => s + d.dustAvg, 0) / Math.max(1, statsDays.length)
  ).toFixed(0);
  const avgAodSince = +(
    statsDays.reduce((s, d) => s + d.aodAvg, 0) / Math.max(1, statsDays.length)
  ).toFixed(2);
  const dewNightsCount = statsDays.filter((d) => d.dewGlueHours >= 2).length;
  const fogDaysCount = statsDays.filter((d) => d.fogHours >= 2).length;
  const drizzleMudEvents = statsDays.filter((d) => d.eventTag === 'DRIZZLE_MUD').length;
  const skyHazeLossPct = Math.min(24, Math.round(avgAodSince * 9.5));

  const futureDays = futureYmds.map((y) => dayMap.get(y)!);
  let incomingRainHold: SolarIntelligenceReport['soiling']['incomingRainHold'] = null;
  for (let idx = 0; idx < Math.min(SOILING_THRESHOLDS.rainHoldLookaheadDays, futureDays.length); idx++) {
    const fDay = futureDays[idx];
    const step = evaluateSingleDaySoilingStep(fDay, tiltDeg);
    const prob = Math.round(fDay.precipitationProbMax ?? (step.rainMm >= 4 ? 75 : 20));
    const isStrongRain =
      step.rainMm >= SOILING_THRESHOLDS.rainHoldDailyMm ||
      (step.rainMm >= SOILING_THRESHOLDS.rainHoldProbDailyMm && prob >= SOILING_THRESHOLDS.rainHoldProbPct);
    if (isStrongRain) {
      incomingRainHold = {
        ymd: fDay.ymd,
        shortLabel: formatShortLabel(fDay.ymd),
        rainMm: step.rainMm,
        probPct: prob,
      };
      break;
    }
  }

  const targetThreshold = stickyFilmActive ? customStickyTriggerPct : customWashTriggerPct;
  const dailyAccumRatePct = +(
    (statsDays.reduce((s, d) => s + Math.max(0.15, d.dailySoilingDeltaPct), 0) /
      Math.max(1, statsDays.length)) ||
    0.28
  ).toFixed(2);

  let estimatedDaysToThreshold: number | null = 0;
  let estimatedNextWashYmd: string | null = todayYmd;
  if (effectiveSurfaceLossPct < targetThreshold) {
    let simLoss = effectiveSurfaceLossPct;
    let simDays = 0;
    for (let idx = 0; idx < futureDays.length && simLoss < targetThreshold; idx++) {
      const fStep = evaluateSingleDaySoilingStep(futureDays[idx], tiltDeg, customRainResetMm);
      if (fStep.isRainFullWash) {
        simLoss = 0;
      } else {
        simLoss += Math.max(0.12, fStep.dailyAdditionPct);
      }
      simDays += 1;
    }
    if (simLoss < targetThreshold) {
      const forecastAvgRate =
        futureDays.length > 0
          ? futureDays.reduce((s, f) => s + evaluateSingleDaySoilingStep(f, tiltDeg, customRainResetMm).dailyAdditionPct, 0) /
            futureDays.length
          : dailyAccumRatePct;
      const steadyRate = Math.max(0.15, forecastAvgRate || dailyAccumRatePct);
      const extraDays = Math.ceil((targetThreshold - simLoss) / steadyRate);
      simDays += extraDays;
    }
    estimatedDaysToThreshold = Math.min(45, Math.max(1, simDays));
    estimatedNextWashYmd = shiftYmd(todayYmd, estimatedDaysToThreshold);
  }

  const washTriggered =
    effectiveSurfaceLossPct >= customWashTriggerPct ||
    (stickyFilmActive && effectiveSurfaceLossPct >= customStickyTriggerPct);

  let actionState: WashActionState = 'CLEAN';
  let actionBadgeText = 'Clean';
  let actionHeadline = `Clean glass (${daysSinceWash}d ago)`;
  let actionAdvice = '';

  const baselineDailyKwh =
    latestLedger?.weatherCleanKwh && latestLedger.weatherCleanKwh > 3
      ? latestLedger.weatherCleanKwh
      : latestLedger?.radBaselineKwh && latestLedger.radBaselineKwh > 3
      ? latestLedger.radBaselineKwh
      : safeCap * 3.5;
  const recoverableKwhPerDay = +(
    (baselineDailyKwh / Math.max(0.1, 1 - effectiveSurfaceLossPct / 100)) *
    (effectiveSurfaceLossPct / 100)
  ).toFixed(2);
  const recoverableKwhPerWeek = +(recoverableKwhPerDay * 7).toFixed(1);
  const recoverableInrPerWeek = Math.round(recoverableKwhPerWeek * tariff);

  if (incomingRainHold && effectiveSurfaceLossPct >= SOILING_THRESHOLDS.watchBuildupPct) {
    actionState = 'HOLD_FOR_RAIN';
    actionBadgeText = `Hold · Rain ${incomingRainHold.shortLabel}`;
    actionHeadline = `Natural rain expected ${incomingRainHold.shortLabel} (~${incomingRainHold.rainMm.toFixed(1)} mm)`;
    actionAdvice = `Pause manual washing — forecasted rain (${incomingRainHold.rainMm.toFixed(1)} mm, ${incomingRainHold.probPct}% prob) should rinse off current -${effectiveSurfaceLossPct}% film naturally.`;
  } else if (washTriggered) {
    actionState = 'WASH_NOW';
    actionBadgeText = 'Wash Recommended';
    actionHeadline = stickyFilmActive
      ? `Dew/drizzle cemented dust (-${effectiveSurfaceLossPct}%)`
      : `Surface dust reached -${effectiveSurfaceLossPct}% threshold`;
    actionAdvice = `Wash with clean water to recover ~${recoverableKwhPerDay.toFixed(1)} kWh/day (~${recoverableKwhPerWeek} kWh/week).`;
  } else if (effectiveSurfaceLossPct >= SOILING_THRESHOLDS.watchBuildupPct) {
    actionState = 'WATCH_BUILDUP';
    actionBadgeText = `Wash in ~${estimatedDaysToThreshold}d`;
    actionHeadline = `Moderate settling (-${effectiveSurfaceLossPct}%) · Next wash ~${formatShortLabel(estimatedNextWashYmd!)}`;
    actionAdvice = `Monitor PM10/dew buildup (${dewNightsCount} dew nights). Next wash projected around ${formatShortLabel(estimatedNextWashYmd!)}.`;
  } else {
    actionState = 'CLEAN';
    actionBadgeText = 'Clean';
    const washSourceStr =
      lastClean.source === 'rain_auto'
        ? `Rain-washed ${formatShortLabel(lastClean.ymd)} (${lastClean.precipMm?.toFixed(1)} mm)`
        : `Washed ${daysSinceWash === 0 ? 'today' : `${daysSinceWash}d ago`}`;
    actionHeadline = `${washSourceStr} · Next est. in ~${estimatedDaysToThreshold}d`;
    actionAdvice =
      skyHazeLossPct >= 5
        ? `Glass surface is clean (-${effectiveSurfaceLossPct}%). Today's ~${skyHazeLossPct}% haze reduction is airborne smog (AOD ${avgAodSince}), not panel dirt.`
        : `Panels are optically clean under ${avgPm10Since} ug/m3 PM10 load; next wash projected ~${formatShortLabel(estimatedNextWashYmd!)}.`;
  }

  const curTemp = input.currentWeather?.temperatureC ?? 24;
  const isMiddayHotWindow = input.nowMinutesIst >= 510 && input.nowMinutesIst <= 1005;
  const bestWashTimeText =
    isMiddayHotWindow || (curTemp ?? 24) >= 27
      ? 'Wash after sunset (after 05:30 PM) or before 07:30 AM tomorrow to avoid glass thermal shock'
      : 'Safe temperature window right now or early morning before 07:30 AM';

  const completedDays = dailyLedger.filter((d) => d.ymd < todayYmd);
  const confirmedCompleted = completedDays.filter((d) => d.isConfirmed && d.realKwh !== null);

  let latestWindow: WeeklyComparisonWindow | null = null;
  let priorWindow: WeeklyComparisonWindow | null = null;
  let olderWindow: WeeklyComparisonWindow | null = null;

  if (completedDays.length >= 14) {
    latestWindow = buildWeeklyWindow(completedDays.slice(-7), 'Latest 7 Days');
    priorWindow = buildWeeklyWindow(completedDays.slice(-14, -7), 'Last Week');
    if (completedDays.length >= 21) {
      olderWindow = buildWeeklyWindow(completedDays.slice(-21, -14), 'Week Before Last');
    }
  } else if (completedDays.length >= 2) {
    const latestSliceSource =
      confirmedCompleted.length >= 7 && completedDays[completedDays.length - 1].realKwh === null
        ? completedDays.slice(Math.max(0, completedDays.length - 8), completedDays.length - 1)
        : completedDays.slice(-7);
    const firstEndIdx = completedDays.indexOf(latestSliceSource[0]);
    latestWindow = buildWeeklyWindow(latestSliceSource, `Latest ${latestSliceSource.length}d`);
    if (firstEndIdx > 0) {
      const priorSlice = completedDays.slice(Math.max(0, firstEndIdx - 7), firstEndIdx);
      priorWindow = buildWeeklyWindow(priorSlice, 'Prior Week');
    }
  }

  const perfDeltaVsPriorPct =
    latestWindow?.normalizedPerfPct != null && priorWindow?.normalizedPerfPct != null
      ? latestWindow.normalizedPerfPct - priorWindow.normalizedPerfPct
      : null;
  const weatherDeltaVsPriorPct =
    latestWindow && priorWindow ? priorWindow.weatherAttenuationPct - latestWindow.weatherAttenuationPct : null;

  let headlineSummary = 'Collecting multi-day telemetry baseline.';
  if (latestWindow && priorWindow) {
    const perfPart =
      latestWindow.normalizedPerfPct !== null
        ? `${latestWindow.realAvgKwh} vs ${latestWindow.modelAvgKwh} kWh/d (${latestWindow.normalizedPerfPct}%)`
        : `${latestWindow.modelAvgKwh} kWh/d model`;
    const deltaPart =
      perfDeltaVsPriorPct !== null
        ? ` · ${perfDeltaVsPriorPct >= 0 ? '+' : ''}${perfDeltaVsPriorPct}% vs prior wk`
        : '';
    const dipPart = priorWindow.biggestDip
      ? ` · ${priorWindow.biggestDip.shortLabel} dip: ${priorWindow.biggestDip.reason}`
      : latestWindow.biggestDip
      ? ` · ${latestWindow.biggestDip.shortLabel} dip: ${latestWindow.biggestDip.reason}`
      : '';
    headlineSummary = `${perfPart}${deltaPart}${dipPart}`;
  } else if (latestWindow) {
    headlineSummary = `${latestWindow.realAvgKwh} kWh/d real vs ${latestWindow.modelAvgKwh} model (${latestWindow.normalizedPerfPct ?? 0}%)`;
  }

  const extendedForecast = futureDays
    .slice(0, 4)
    .map((fDay) =>
      resolveTomorrowForecastWindow(
        fDay,
        dcCap,
        effectiveSurfaceLossPct,
        latDeg,
        tiltDeg,
        physicsOverrides,
        customRainResetMm
      )
    );
  const tomorrowOutlook = extendedForecast[0] || null;

  const snapTemp = input.currentWeather?.temperatureC ?? null;
  const snapDew = input.currentWeather?.dewPointC ?? null;
  const dewSpreadC =
    typeof snapTemp === 'number' && typeof snapDew === 'number' ? +(snapTemp - snapDew).toFixed(1) : null;

  return {
    generatedAtIstYmd: todayYmd,
    capacityKwp: dcCap,
    tariffPerKwh: tariff,
    commissioningYmd: minYmd,
    siteCalibration,
    soiling: {
      surfaceLossPct: effectiveSurfaceLossPct,
      particleModelLossPct: particleLossPct,
      empiricalDriftPct,
      empiricalUsed,
      confidenceLabel,
      confidenceSource,
      stickyFilmActive,
      lastClean: {
        ymd: lastClean.ymd,
        shortLabel: formatShortLabel(lastClean.ymd),
        source: lastClean.source,
        daysAgo: daysSinceWash,
        precipMm: lastClean.precipMm,
        label:
          lastClean.source === 'rain_auto'
            ? `Rain ${formatShortLabel(lastClean.ymd)} (${lastClean.precipMm?.toFixed(1)}mm)`
            : `Washed ${formatShortLabel(lastClean.ymd)}`,
      },
      recentRainWash:
        cleaningHistory.filter((e) => e.type === 'rain_auto').slice(-1)[0] || null,
      actionState,
      actionBadgeText,
      actionHeadline,
      actionAdvice,
      bestWashTimeText,
      recoverableKwhPerDay,
      recoverableKwhPerWeek,
      recoverableInrPerWeek,
      estimatedDaysToThreshold,
      estimatedNextWashYmd,
      estimatedNextWashLabel: estimatedNextWashYmd ? formatShortLabel(estimatedNextWashYmd) : null,
      incomingRainHold,
      statsSinceWash: {
        daysCount: statsDays.length,
        avgPm10: avgPm10Since,
        avgPm25: avgPm25Since,
        avgDust: avgDustSince,
        avgAod: avgAodSince,
        dewNightsCount,
        fogDaysCount,
        drizzleMudEvents,
        skyHazeLossPct,
        dailyAccumRatePct,
      },
      currentSnapshot: {
        pm10: Math.round(input.currentWeather?.pm10 ?? latestLedger?.pm10Avg ?? 100),
        pm25: Math.round(input.currentWeather?.pm25 ?? latestLedger?.pm25Avg ?? 60),
        dust: Math.round(input.currentWeather?.dust ?? latestLedger?.dustAvg ?? 18),
        aod: +(input.currentWeather?.aod ?? latestLedger?.aodAvg ?? 0.55).toFixed(2),
        usAqi: Math.round(input.currentWeather?.usAqi ?? latestLedger?.usAqiMax ?? 160),
        dewSpreadC,
        dewActiveNow:
          (dewSpreadC !== null && dewSpreadC <= SOILING_THRESHOLDS.dewSpreadMaxC) ||
          (input.currentWeather?.humidityPct ?? 0) >= SOILING_THRESHOLDS.dewRhMinPct,
        precipitationMm: +(input.currentWeather?.precipitationMm ?? latestLedger?.rainMm ?? 0).toFixed(1),
        windKmh: +(input.currentWeather?.windSpeedKmh ?? latestLedger?.windAvgKmh ?? 5).toFixed(1),
      },
    },
    weeklyComparison: {
      latestWindow,
      priorWindow,
      olderWindow,
      perfDeltaVsPriorPct,
      weatherDeltaVsPriorPct,
      headlineSummary,
    },
    tomorrowOutlook,
    extendedForecast,
    dailyLedger,
    cleaningHistory,
  };
}
