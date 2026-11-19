import type { DailySoilingStep } from '../intelligence/soilingModel.ts';
import { computeDailySolarPhysicsModel } from '../physics/index.ts';
import type { DailyAtmosphereRecord } from '../types/intelligence.ts';
import type { InverterLossCoeffs, MountingType } from '../types/settings.ts';

export interface ClearTelemetryDayEntry {
  ymd: string;
  day: DailyAtmosphereRecord;
  genSeriesData: Array<{ time?: string; value?: number | string }>;
  step: DailySoilingStep;
  soilLossPct: number;
}

export interface SiteGeometryCalibrationParams {
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
  appliedInvCoeffs: InverterLossCoeffs;
}

export function buildCalibrationDayModel(
  day: DailyAtmosphereRecord,
  step: DailySoilingStep,
  soilLossPct: number,
  azDeg: number,
  kSite: number,
  geom: SiteGeometryCalibrationParams
) {
  return computeDailySolarPhysicsModel({
    sunriseIso: day.sunrise,
    sunsetIso: day.sunset,
    ymd: day.ymd,
    lat: geom.latDeg,
    lon: geom.lonDeg,
    hourlyGti: Array.isArray(day.hourlyGti) ? day.hourlyGti : [],
    hourlyGtiInstant: Array.isArray(day.hourlyGtiInstant) ? day.hourlyGtiInstant : [],
    minutely15Gti: Array.isArray(day.minutely15Gti) ? day.minutely15Gti : [],
    minutely15GtiInstant: Array.isArray(day.minutely15GtiInstant) ? day.minutely15GtiInstant : [],
    radiationMjM2: day.radiationMjM2 ?? 14.5,
    capacityKwp: geom.acInverterCapacityKw,
    dcCapacityKwp: geom.dcCapacityKwp,
    acInverterCapacityKw: geom.acInverterCapacityKw,
    arrayTiltDeg: geom.tiltDeg,
    arrayAzimuthDeg: azDeg,
    gtiReferenceAzimuthDeg: day.gtiFetchedAzimuthDeg ?? geom.azimuthDeg,
    mountingType: geom.mountingType,
    roofAlbedo: geom.roofAlbedo,
    surfaceLossPct: soilLossPct,
    ambientTempC: day.tempMax ?? 26,
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
    thermalCoeffPerC: geom.thermalCoeffPerC,
    dcCleanFactor: geom.dcCleanFactor,
    basePrAtStc: geom.basePrAtStc,
    inverterEfficiency: geom.inverterEfficiency,
    kSite,
    hourlyShadeFactors: null,
    inverterLossCoeffs: geom.appliedInvCoeffs,
  });
}

/**
 * Sweeps effective array azimuth around configured orientation on steady clear-sky days
 * to recover true roof compass offset from midday symmetry.
 */
export function fitSiteAzimuthDeg(
  clearTelemetryDays: ClearTelemetryDayEntry[],
  kSiteApplied: number,
  enabled: boolean,
  geom: SiteGeometryCalibrationParams
): { effectiveAzimuthDeg: number; azimuthLearned: boolean; azimuthSampleDays: number } {
  let effectiveAzimuthDeg = geom.azimuthDeg;
  let azimuthLearned = false;
  let azimuthSampleDays = 0;

  if (!enabled || clearTelemetryDays.length < 2) {
    return { effectiveAzimuthDeg, azimuthLearned, azimuthSampleDays };
  }

  const minAz = Math.max(-15, Math.round(geom.azimuthDeg) - 5);
  const maxAz = Math.min(25, Math.round(geom.azimuthDeg) + 12);
  const parsedDays = clearTelemetryDays
    .map((entry) => {
      const pts: Array<{ mins: number; kw: number }> = [];
      for (const pt of entry.genSeriesData) {
        const m = /(\d{2}):(\d{2})/.exec(String(pt.time || ''));
        if (!m) continue;
        const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        pts.push({ mins, kw: Number(pt.value) || 0 });
      }
      return { ...entry, pts };
    })
    .filter((d) => d.pts.length >= 35);

  azimuthSampleDays = parsedDays.length;
  if (parsedDays.length < 2) {
    return { effectiveAzimuthDeg, azimuthLearned, azimuthSampleDays };
  }

  const evalAzRmse = (candAz: number): number => {
    let sq = 0;
    let cnt = 0;
    for (const d of parsedDays) {
      const mod = buildCalibrationDayModel(d.day, d.step, d.soilLossPct, candAz, kSiteApplied, geom);
      let daySq = 0;
      let dayN = 0;
      let dropPts = 0;
      for (const p of d.pts) {
        if (p.mins < mod.sunriseMin + 35 || p.mins > mod.sunsetMin - 35) continue;
        const mk = mod.lookupAtMinute(p.mins).kw;
        if (mk >= 0.4 && p.kw / mk < 0.78) {
          dropPts += 1;
          continue;
        }
        const e = (p.kw - mk) * 1000;
        daySq += e * e;
        dayN += 1;
      }
      if (dayN >= 45 && dropPts <= 6) {
        sq += daySq;
        cnt += dayN;
      }
    }
    return cnt > 0 ? Math.sqrt(sq / cnt) : Number.POSITIVE_INFINITY;
  };

  const baseRmse = evalAzRmse(geom.azimuthDeg);
  let bestAz = geom.azimuthDeg;
  let bestRmse = baseRmse;
  for (let az = minAz; az <= maxAz; az++) {
    const r = evalAzRmse(az);
    if (r < bestRmse) {
      bestRmse = r;
      bestAz = az;
    }
  }
  if (Math.abs(bestAz - geom.azimuthDeg) >= 1 && Number.isFinite(baseRmse) && bestRmse <= baseRmse - 2) {
    effectiveAzimuthDeg = bestAz;
    azimuthLearned = true;
  }

  return { effectiveAzimuthDeg, azimuthLearned, azimuthSampleDays };
}

/**
 * Evaluates post-calibration morning/evening hourly horizon residual profile
 * using P88 upper envelope across clear days so transient afternoon plumes aren't baked as shade.
 */
export function estimateHourlyShadeFactors(
  clearTelemetryDays: ClearTelemetryDayEntry[],
  effectiveAzimuthDeg: number,
  kSiteApplied: number,
  geom: SiteGeometryCalibrationParams
): { hourlyShadeFactors: number[]; shadedHoursSummary: Array<{ hour: number; factor: number }> } {
  const hourlyClearRatios: Record<number, number[]> = {};
  for (const entry of clearTelemetryDays) {
    const rawModel = buildCalibrationDayModel(entry.day, entry.step, entry.soilLossPct, effectiveAzimuthDeg, 1.0, geom);
    const perHourReal: Record<number, number[]> = {};
    const perHourMod: Record<number, number[]> = {};
    for (const pt of entry.genSeriesData) {
      const m = /(\d{2}):(\d{2})/.exec(String(pt.time || ''));
      if (!m) continue;
      const hh = parseInt(m[1], 10);
      const mins = hh * 60 + parseInt(m[2], 10);
      const modKw = rawModel.lookupAtMinute(mins).kw * kSiteApplied;
      if (modKw < 0.25 || hh < 6 || hh > 17) continue;
      if (!perHourReal[hh]) {
        perHourReal[hh] = [];
        perHourMod[hh] = [];
      }
      perHourReal[hh].push(Number(pt.value) || 0);
      perHourMod[hh].push(modKw);
    }
    for (const hStr of Object.keys(perHourReal)) {
      const hh = Number(hStr);
      if (perHourReal[hh].length < 4) continue;
      const avgReal = perHourReal[hh].reduce((a, b) => a + b, 0) / perHourReal[hh].length;
      const avgMod = perHourMod[hh].reduce((a, b) => a + b, 0) / perHourMod[hh].length;
      if (avgMod >= 0.25) {
        if (!hourlyClearRatios[hh]) hourlyClearRatios[hh] = [];
        hourlyClearRatios[hh].push(Math.max(0.35, Math.min(1.35, avgReal / avgMod)));
      }
    }
  }

  const hourlyShadeFactors = Array.from({ length: 24 }, () => 1.0);
  const shadedHoursSummary: Array<{ hour: number; factor: number }> = [];
  for (let h = 6; h <= 17; h++) {
    const ratios = hourlyClearRatios[h];
    if (!ratios || ratios.length < 3) continue;
    const sortedR = ratios.toSorted((a, b) => a - b);
    const p85Idx = Math.min(sortedR.length - 1, Math.floor((sortedR.length - 1) * 0.88));
    const upperClear = sortedR[p85Idx];
    if (upperClear < 0.90) {
      const clamped = +Math.max(0.55, Math.min(1.0, upperClear)).toFixed(2);
      hourlyShadeFactors[h] = clamped;
      shadedHoursSummary.push({ hour: h, factor: clamped });
    }
  }

  return { hourlyShadeFactors, shadedHoursSummary };
}
