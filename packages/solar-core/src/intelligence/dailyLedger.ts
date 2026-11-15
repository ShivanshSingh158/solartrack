import {
  SOLAR_CONSTANTS,
  computeDailySolarPhysicsModel,
  computeEffectiveSolarPr,
  computeSmogAnomalyTransmittance,
} from '../physics/index.ts';
import type { DailyAtmosphereRecord, UnifiedPhysicsOptions } from '../types/intelligence.ts';
import { SOILING_THRESHOLDS, avgNums, isValidYmd, minNums, sumNums } from './soilingModel.ts';

export const ENGINE_PR = SOLAR_CONSTANTS.DEFAULT_PR_ANCHOR;
export const DEFAULT_TILT_DEG = 26.5;
export const DEFAULT_LAT_DEG = 26.5;
export const THERMAL_TEMP_COEFF = SOLAR_CONSTANTS.THERMAL_COEFF_PER_C;

/**
 * Meinel clear-sky tilted irradiance envelope (azimuth 0 due South, clean rural/urban atmosphere).
 * Provides a physically monotonic seasonal upper bound unaffected by Open-Meteo historical null clear_sky gaps or high cirrus clouds.
 */
export function computeAstronomicalClearSkyBench(
  ymd: string,
  capacityKwp: number,
  latDeg: number,
  tiltDeg: number
): { astroClearKwh: number; rbTiltFactor: number } {
  if (!isValidYmd(ymd)) return { astroClearKwh: +(capacityKwp * 4.7).toFixed(2), rbTiltFactor: 1.2 };
  const [y, m, d] = ymd.split('-').map((v) => parseInt(v, 10));
  const doy = Math.max(1, Math.min(366, Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000)));
  const rad = Math.PI / 180;
  const lat = latDeg * rad;
  const tilt = tiltDeg * rad;
  const decl = 23.45 * Math.sin(((360 / 365) * (doy - 81)) * rad) * rad;
  const i0 = 1367 * (1 + 0.033 * Math.cos(((360 * doy) / 365) * rad));

  let totalTiltedWhM2 = 0;
  let totalHorizWhM2 = 0;
  for (let min = 330; min <= 1080; min += 10) {
    const h = ((min / 60 - 12) * 15) * rad;
    const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(h);
    if (cosZ <= 0.04) continue;
    const zenithDeg = Math.acos(Math.min(1, cosZ)) / rad;
    const am = 1 / (cosZ + 0.50572 * Math.pow(Math.max(1.5, 96.07995 - zenithDeg), -1.6364));
    const dni = i0 * Math.pow(0.7, Math.pow(am, 0.678));
    const cosTheta = Math.sin(lat - tilt) * Math.sin(decl) + Math.cos(lat - tilt) * Math.cos(decl) * Math.cos(h);
    const directTilted = Math.max(0, dni * cosTheta);
    const ghi = dni * cosZ * 1.12;
    const diffTilted = ghi * 0.11 * ((1 + Math.cos(tilt)) / 2) + ghi * 0.2 * ((1 - Math.cos(tilt)) / 2);
    totalTiltedWhM2 += (directTilted + diffTilted) * (10 / 60);
    totalHorizWhM2 += ghi * (10 / 60);
  }
  const rbTiltFactor =
    totalHorizWhM2 > 100
      ? Math.max(0.95, Math.min(1.45, totalTiltedWhM2 / totalHorizWhM2))
      : 1.2;
  const astroClearKwh = +((totalTiltedWhM2 / 1000) * capacityKwp * ENGINE_PR * 0.96).toFixed(2);
  return { astroClearKwh, rbTiltFactor };
}

/**
 * Computes Ideal Clear-Sky, Tilted Clean Weather Model (unified Stage A + Stage B physics),
 * and Horizontal Radiation Baseline from daily weather telemetry.
 */
export function computeDayIrradianceBenchmarks(
  day: DailyAtmosphereRecord,
  capacityKwp: number,
  latDeg = DEFAULT_LAT_DEG,
  tiltDeg = DEFAULT_TILT_DEG,
  physicsOverrides?: UnifiedPhysicsOptions
): {
  radBaselineKwh: number;
  weatherCleanKwh: number;
  idealClearSkyKwh: number;
  weatherAttenuationPct: number;
  hazeOpticalLossPct: number;
  fogHours: number;
  minVisibilityM: number | null;
  dayCloudAvgPct: number;
  aodAvg: number;
  pm10Avg: number;
  sunsetMin: number;
  estimateTailKwhAfterMinute: (min: number) => number;
} {
  const dcCap = Math.max(0.5, physicsOverrides?.dcCapacityKwp ?? capacityKwp ?? 3.0);
  const acCap = Math.max(0.5, physicsOverrides?.acInverterCapacityKw ?? capacityKwp ?? 3.0);
  const radMj = typeof day.radiationMjM2 === 'number' && day.radiationMjM2 > 0 ? day.radiationMjM2 : 14.5;
  const ambientAvgC =
    day.tempMax != null && day.tempMin != null
      ? (day.tempMax + day.tempMin) / 2
      : day.tempMax ?? 25;
  const windAvg = avgNums(day.hourlyWindKmh, 5.5, 7, 17);
  const aodAvgVal = +avgNums(day.hourlyAod, 0.5, 7, 17).toFixed(2);
  const pm10AvgVal = Math.round(avgNums(day.hourlyPm10, 140, 7, 17));

  const effectiveKSite =
    typeof physicsOverrides?.kSite === 'number' && Number.isFinite(physicsOverrides.kSite)
      ? physicsOverrides.kSite
      : null;
  const effectiveShades = physicsOverrides?.hourlyShadeFactors ?? null;

  const baselinePrRes = computeEffectiveSolarPr({
    ambientTempC: ambientAvgC,
    windSpeedKmh: windAvg,
    gtiWm2: 500,
    surfaceLossPct: 0,
    aod: aodAvgVal,
    pm10: pm10AvgVal,
    thermalCoeffPerC: physicsOverrides?.thermalCoeffPerC,
    dcCleanFactor: physicsOverrides?.dcCleanFactor,
    basePrAtStc: physicsOverrides?.basePrAtStc,
    inverterEfficiency: physicsOverrides?.inverterEfficiency,
    mountingType: physicsOverrides?.mountingType,
    dcCapacityKwp: dcCap,
    acInverterCapacityKw: acCap,
    inverterLossCoeffs: physicsOverrides?.inverterLossCoeffs,
    kSite: effectiveKSite,
  });
  const radBaselineKwh = +((radMj / 3.6) * dcCap * baselinePrRes.pr).toFixed(2);

  const cleanModel = computeDailySolarPhysicsModel({
    sunriseIso: day.sunrise,
    sunsetIso: day.sunset,
    ymd: day.ymd,
    lat: latDeg,
    lon: physicsOverrides?.lonDeg ?? SOLAR_CONSTANTS.DEFAULT_LON,
    hourlyGti: Array.isArray(day.hourlyGti) ? day.hourlyGti.slice(0, 24) : [],
    hourlyGtiInstant: Array.isArray(day.hourlyGtiInstant) ? day.hourlyGtiInstant.slice(0, 24) : [],
    minutely15Gti: Array.isArray(day.minutely15Gti) ? day.minutely15Gti.slice(0, 96) : [],
    minutely15GtiInstant: Array.isArray(day.minutely15GtiInstant) ? day.minutely15GtiInstant.slice(0, 96) : [],
    hourlyDiffuse: Array.isArray(day.hourlyDiffuse) ? day.hourlyDiffuse.slice(0, 24) : [],
    hourlyDni: Array.isArray(day.hourlyDni) ? day.hourlyDni.slice(0, 24) : [],
    hourlyCloudCover: Array.isArray(day.hourlyCloudCover) ? day.hourlyCloudCover.slice(0, 24) : [],
    gtiReferenceAzimuthDeg: day.gtiFetchedAzimuthDeg ?? physicsOverrides?.gtiReferenceAzimuthDeg ?? null,
    radiationMjM2: radMj,
    capacityKwp,
    dcCapacityKwp: dcCap,
    acInverterCapacityKw: acCap,
    arrayTiltDeg: tiltDeg,
    arrayAzimuthDeg: physicsOverrides?.azimuthDegrees ?? SOLAR_CONSTANTS.DEFAULT_AZIMUTH_DEG,
    mountingType: physicsOverrides?.mountingType ?? SOLAR_CONSTANTS.DEFAULT_MOUNTING_TYPE,
    roofAlbedo: physicsOverrides?.roofAlbedo ?? SOLAR_CONSTANTS.DEFAULT_ALBEDO,
    surfaceLossPct: 0,
    ambientTempC: ambientAvgC,
    windSpeedKmh: windAvg,
    aod: aodAvgVal,
    pm10: pm10AvgVal,
    hourlyTempC: Array.isArray(day.hourlyTempC) ? day.hourlyTempC.slice(0, 24) : [],
    hourlyWindKmh: Array.isArray(day.hourlyWindKmh) ? day.hourlyWindKmh.slice(0, 24) : [],
    hourlyAod: Array.isArray(day.hourlyAod) ? day.hourlyAod.slice(0, 24) : [],
    hourlyPm10: Array.isArray(day.hourlyPm10) ? day.hourlyPm10.slice(0, 24) : [],
    hourlyShadeFactors: effectiveShades,
    thermalCoeffPerC: physicsOverrides?.thermalCoeffPerC,
    dcCleanFactor: physicsOverrides?.dcCleanFactor,
    basePrAtStc: physicsOverrides?.basePrAtStc,
    inverterEfficiency: physicsOverrides?.inverterEfficiency,
    kSite: effectiveKSite,
    inverterLossCoeffs: physicsOverrides?.inverterLossCoeffs,
  });

  const weatherCleanKwh = cleanModel.usedTiltedGti
    ? +cleanModel.targetDailyModelKwh.toFixed(2)
    : radBaselineKwh;

  const { astroClearKwh, rbTiltFactor } = computeAstronomicalClearSkyBench(day.ymd, dcCap, latDeg, tiltDeg);
  const clearSkyWhM2 = Array.isArray(day.hourlyClearSkyGhi) ? sumNums(day.hourlyClearSkyGhi.slice(0, 24)) : 0;
  const clearSkyMj =
    typeof day.clearSkyMjM2 === 'number' && day.clearSkyMjM2 > 1
      ? day.clearSkyMjM2
      : clearSkyWhM2 > 200
      ? clearSkyWhM2 * 0.0036
      : null;
  const clearSkyTiltedFromGhi =
    clearSkyMj !== null ? +((clearSkyMj / 3.6) * rbTiltFactor * dcCap * ENGINE_PR * 0.96).toFixed(2) : null;
  const idealBaseline =
    clearSkyTiltedFromGhi !== null && clearSkyTiltedFromGhi >= astroClearKwh * 0.8 && clearSkyTiltedFromGhi <= astroClearKwh * 1.25
      ? clearSkyTiltedFromGhi
      : astroClearKwh;
  const idealClearSkyKwh = +Math.max(weatherCleanKwh, idealBaseline).toFixed(2);
  const weatherAttenuationPct =
    idealClearSkyKwh > 0.5
      ? Math.max(0, Math.min(95, Math.round((1 - weatherCleanKwh / idealClearSkyKwh) * 100)))
      : 0;

  // Daytime Fog & Visibility (hours 06:00..17:00 IST)
  const visSlice = Array.isArray(day.hourlyVisibilityM) ? day.hourlyVisibilityM.slice(6, 18) : [];
  const codeSlice = Array.isArray(day.hourlyWeatherCode) ? day.hourlyWeatherCode.slice(6, 18) : [];
  let fogHours = 0;
  for (let i = 0; i < 12; i++) {
    const v = visSlice[i];
    const wc = codeSlice[i];
    if ((typeof v === 'number' && v < SOILING_THRESHOLDS.fogVisibilityM) || wc === 45 || wc === 48) {
      fogHours += 1;
    }
  }
  const minVisibilityM = minNums(visSlice);
  const dayCloudAvgPct = Math.round(avgNums(day.hourlyCloudCover, 15, 7, 17));
  const hazeOpticalLossPct = Math.min(24, Math.max(-8, Math.round((1 - computeSmogAnomalyTransmittance(pm10AvgVal).tauSmog) * 100)));

  return {
    radBaselineKwh,
    weatherCleanKwh,
    idealClearSkyKwh,
    weatherAttenuationPct,
    hazeOpticalLossPct,
    fogHours,
    minVisibilityM,
    dayCloudAvgPct,
    aodAvg: aodAvgVal,
    pm10Avg: pm10AvgVal,
    sunsetMin: cleanModel.sunsetMin,
    estimateTailKwhAfterMinute: (min: number) =>
      cleanModel.usedTiltedGti ? Math.max(0, cleanModel.targetDailyModelKwh - cleanModel.lookupAtMinute(min).cumKwh) : 0,
  };
}
