import { getIstClockParts } from '../time/istDate.ts';
import { SOLAR_CONSTANTS } from './constants.ts';
import { computeAstronomicalSunTimes, formatDurationHm, formatMinutes12hUpper, parseIsoClockMinutes } from './astronomy.ts';
import { computeAtmosphericAerosolTransmittance } from './atmosphere.ts';
import {
  computeAshraeIam,
  computeCellTempC,
  computeEffectiveSolarPr,
  computeInverterAcOutputKw,
  computeTiltedIncidenceCosine,
} from './pvCellAndInverter.ts';
import type {
  DailySolarPhysicsInput,
  DailySolarPhysicsModel,
  DailySolarPhysicsPoint,
} from '../types/physics.ts';
import type { InverterLossCoeffs, MountingType } from '../types/settings.ts';

export type { DailySolarPhysicsInput, DailySolarPhysicsPoint, DailySolarPhysicsModel };

/**
 * Linearly samples a uniform-step time array at a continuous minute coordinate.
 */
export function sampleUniformArrayAtMin(arr: number[], stepMin: number, coordMin: number): number {
  const maxIdx = arr.length - 1;
  if (maxIdx <= 0) return Math.max(0, Number(arr[0]) || 0);
  const pos = Math.max(0, Math.min(maxIdx, coordMin / stepMin));
  const i0 = Math.floor(pos);
  const i1 = Math.min(maxIdx, i0 + 1);
  const frac = pos - i0;
  const v0 = Number(arr[i0]);
  const v1 = Number(arr[i1]);
  const safe0 = Number.isFinite(v0) ? v0 : 0;
  const safe1 = Number.isFinite(v1) ? v1 : safe0;
  return safe0 + frac * (safe1 - safe0);
}

/**
 * Linearly interpolates hourly atmospheric state variables (Temp, Wind, PM10, AOD, Cloud) at a minute.
 */
export function sampleHourlyStateAtMin(arr: number[] | undefined, m: number, fallbackVal: number): number {
  if (!Array.isArray(arr) || arr.length === 0) return fallbackVal;
  const maxIdx = arr.length - 1;
  const pos = Math.max(0, Math.min(maxIdx, m / 60));
  const i0 = Math.floor(pos);
  const i1 = Math.min(maxIdx, i0 + 1);
  const v0 = Number(arr[i0]);
  const v1 = Number(arr[i1]);
  if (!Number.isFinite(v0) && !Number.isFinite(v1)) return fallbackVal;
  if (!Number.isFinite(v0)) return v1;
  if (!Number.isFinite(v1)) return v0;
  return v0 + (pos - i0) * (v1 - v0);
}

/**
 * Parses clock minutes (fractional with seconds) from telemetry series timestamps.
 */
export function parseSeriesTimeMinutes(timeStr: string | undefined): number | null {
  const s = String(timeStr || '').trim();
  const match = /(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(am|pm))?/i.exec(s);
  if (!match) return null;
  let hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  const ss = match[3] ? parseInt(match[3], 10) : 0;
  const mer = match[4]?.toLowerCase();
  if (mer === 'pm' && hh < 12) hh += 12;
  if (mer === 'am' && hh === 12) hh = 0;
  return hh * 60 + mm + ss / 60;
}

/**
 * Computes normalized 5-min flicker sigma of sky ratio delta-K to distinguish clouds vs smooth haze.
 */
export function computeFlickerSigmaDeltaK(points: Array<{ min: number; ratio: number }>): number {
  if (points.length < 2) return 0;
  const deltas: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const dtMin = Math.max(2.5, points[i].min - points[i - 1].min);
    const normDelta = (points[i].ratio - points[i - 1].ratio) * (5 / dtMin);
    deltas.push(normDelta);
  }
  if (deltas.length === 0) return 0;
  const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  const variance = deltas.reduce((s, d) => s + (d - mean) * (d - mean), 0) / deltas.length;
  return +Math.sqrt(variance).toFixed(4);
}

/**
 * Unified Two-Stage Physical Digital Twin Curve Builder:
 * Stage A (DC Array): GTI_instant + AOD/PM10 extinction + ASHRAE IAM + thermal inertia + hourly shade * K_site
 * Stage B (Waaree Inverter): Quadratic 3-term tare/linear/quad loss + relay hysteresis + AC clip ceiling
 */
export function computeDailySolarPhysicsModel({
  sunriseIso,
  sunsetIso,
  ymd,
  lat = SOLAR_CONSTANTS.DEFAULT_LAT,
  lon = SOLAR_CONSTANTS.DEFAULT_LON,
  hourlyGti = [],
  minutely15Gti = [],
  hourlyGtiInstant = [],
  minutely15GtiInstant = [],
  radiationMjM2 = 15.33,
  capacityKwp = SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP,
  dcCapacityKwp,
  acInverterCapacityKw,
  arrayTiltDeg = SOLAR_CONSTANTS.DEFAULT_TILT_DEG,
  arrayAzimuthDeg = SOLAR_CONSTANTS.DEFAULT_AZIMUTH_DEG,
  mountingType = SOLAR_CONSTANTS.DEFAULT_MOUNTING_TYPE,
  roofAlbedo = SOLAR_CONSTANTS.DEFAULT_ALBEDO,
  surfaceLossPct = 0,
  ambientTempC = 24,
  windSpeedKmh = 6,
  aod = 0.4,
  pm10,
  pm25 = 45,
  hourlyTempC = [],
  hourlyWindKmh = [],
  hourlyAod = [],
  hourlyPm10 = [],
  hourlyDiffuse = [],
  hourlyDni = [],
  hourlyCloudCover: _hourlyCloudCover = [],
  gtiReferenceAzimuthDeg = null,
  hourlyShadeFactors = null,
  thermalCoeffPerC,
  dcCleanFactor,
  basePrAtStc,
  inverterEfficiency,
  kSite,
  inverterLossCoeffs,
}: DailySolarPhysicsInput): DailySolarPhysicsModel {
  const dcCap =
    Number.isFinite(dcCapacityKwp as number) && Number(dcCapacityKwp) > 0
      ? Number(dcCapacityKwp)
      : capacityKwp > 0
        ? capacityKwp
        : SOLAR_CONSTANTS.DEFAULT_CAPACITY_KWP;
  const acCap =
    Number.isFinite(acInverterCapacityKw as number) && Number(acInverterCapacityKw) > 0
      ? Number(acInverterCapacityKw)
      : capacityKwp > 0
        ? capacityKwp
        : SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW;
  const safeTilt =
    Number.isFinite(arrayTiltDeg as number) && Number(arrayTiltDeg) >= 0
      ? Math.min(75, Number(arrayTiltDeg))
      : SOLAR_CONSTANTS.DEFAULT_TILT_DEG;
  const safeAzimuth =
    Number.isFinite(arrayAzimuthDeg as number)
      ? Math.max(-180, Math.min(180, Number(arrayAzimuthDeg)))
      : SOLAR_CONSTANTS.DEFAULT_AZIMUTH_DEG;
  const safeMounting: MountingType = mountingType === 'flush_rcc' ? 'flush_rcc' : 'open_rack';
  const safeAlbedo =
    Number.isFinite(roofAlbedo as number) && Number(roofAlbedo) >= 0.05
      ? Math.min(0.8, Number(roofAlbedo))
      : SOLAR_CONSTANTS.DEFAULT_ALBEDO;
  const resolvedDcClean =
    Number.isFinite(dcCleanFactor as number) && Number(dcCleanFactor) > 0
      ? Math.max(0.75, Math.min(1.0, Number(dcCleanFactor)))
      : Number.isFinite(basePrAtStc as number) && Number(basePrAtStc) > 0.88
        ? Math.min(1.0, Number(basePrAtStc))
        : SOLAR_CONSTANTS.DC_CLEAN_FACTOR;
  const resolvedKSite =
    Number.isFinite(kSite as number) && Number(kSite) > 0
      ? Math.min(SOLAR_CONSTANTS.KSITE_MAX, Math.max(SOLAR_CONSTANTS.KSITE_MIN, Number(kSite)))
      : SOLAR_CONSTANTS.DEFAULT_KSITE;
  const thermalCoeff =
    Number.isFinite(thermalCoeffPerC as number) && Number(thermalCoeffPerC) > 0
      ? Number(thermalCoeffPerC)
      : SOLAR_CONSTANTS.THERMAL_COEFF_PER_C;

  const safeSurfaceLoss = Math.max(0, Math.min(35, Number.isFinite(surfaceLossPct) ? surfaceLossPct : 0));
  const surfaceFactor = 1 - safeSurfaceLoss / 100;
  const resolvedYmd = ymd || getIstClockParts().ymd;

  const fallbackAstro = computeAstronomicalSunTimes(lat, lon, resolvedYmd);
  const srMin = parseIsoClockMinutes(sunriseIso) ?? fallbackAstro.sunriseMin;
  const ssMin = parseIsoClockMinutes(sunsetIso) ?? fallbackAstro.sunsetMin;
  const noonMin = Math.round((srMin + ssMin) / 2);
  const radMj = typeof radiationMjM2 === 'number' && Number.isFinite(radiationMjM2) ? radiationMjM2 : 15.33;

  const hasM15Instant =
    Array.isArray(minutely15GtiInstant) && minutely15GtiInstant.length >= 96 && minutely15GtiInstant.some((v) => v > 5);
  const hasHourlyInstant =
    Array.isArray(hourlyGtiInstant) && hourlyGtiInstant.length >= 24 && hourlyGtiInstant.some((v) => v > 5);
  const hasMinutelyGti = Array.isArray(minutely15Gti) && minutely15Gti.length >= 96 && minutely15Gti.some((v) => v > 5);
  const hasHourlyGti = Array.isArray(hourlyGti) && hourlyGti.length >= 24 && hourlyGti.some((v) => v > 5);
  const usedInstantGti = hasM15Instant || hasHourlyInstant;
  const usedTiltedGti = usedInstantGti || hasMinutelyGti || hasHourlyGti;

  const getRawGtiAtMin = (min: number): number => {
    if (min <= srMin + 1 || min >= ssMin - 1) return 0;
    if (hasM15Instant) return Math.max(0, sampleUniformArrayAtMin(minutely15GtiInstant, 15, min));
    if (hasHourlyInstant) {
      const gtiInterp = Math.max(0, sampleUniformArrayAtMin(hourlyGtiInstant, 60, min));
      const edgeFade = Math.min(1, (min - srMin) / 20, (ssMin - min) / 20);
      return gtiInterp * Math.max(0, edgeFade);
    }
    if (hasMinutelyGti) return Math.max(0, sampleUniformArrayAtMin(minutely15Gti, 15, min + 7.5));
    if (hasHourlyGti) {
      const gtiInterp = Math.max(0, sampleUniformArrayAtMin(hourlyGti, 60, min + 30));
      const edgeFade = Math.min(1, (min - srMin) / 20, (ssMin - min) / 20);
      return gtiInterp * Math.max(0, edgeFade);
    }
    const t = (min - srMin) / Math.max(1, ssMin - srMin);
    return Math.round(Math.sin(Math.PI * t) * 820);
  };

  const tiltRad = (safeTilt * Math.PI) / 180;
  const albedoDeltaGtiFrac = (safeAlbedo - 0.2) * ((1 - Math.cos(tiltRad)) / 2) * 0.85;

  const defaultPm10 =
    Number.isFinite(pm10 as number)
      ? Number(pm10)
      : Number.isFinite(pm25 as number) && Number(pm25) > 0
        ? Number(pm25) * 1.9
        : SOLAR_CONSTANTS.SMOG_PM10_CLIMATOLOGY_BASELINE;

  const baselinePr = computeEffectiveSolarPr({
    ambientTempC,
    windSpeedKmh,
    gtiWm2: 500,
    surfaceLossPct: safeSurfaceLoss,
    aod,
    pm10: defaultPm10,
    pm25,
    thermalCoeffPerC: thermalCoeff,
    dcCleanFactor: resolvedDcClean,
    basePrAtStc,
    inverterEfficiency,
    mountingType: safeMounting,
    dcCapacityKwp: dcCap,
    acInverterCapacityKw: acCap,
    inverterLossCoeffs,
    kSite: resolvedKSite,
  });

  const stepMin = 5;
  const invRefAcKw =
    inverterLossCoeffs &&
    Number.isFinite(inverterLossCoeffs.referenceAcKw as number) &&
    Number(inverterLossCoeffs.referenceAcKw) > 0
      ? Number(inverterLossCoeffs.referenceAcKw)
      : SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW;
  const invScale = acCap / invRefAcKw;
  const invTareKw =
    (inverterLossCoeffs &&
    Number.isFinite(inverterLossCoeffs.tareKw as number) &&
    Number(inverterLossCoeffs.tareKw) >= 0
      ? Number(inverterLossCoeffs.tareKw)
      : SOLAR_CONSTANTS.DEFAULT_INV_TARE_KW) * invScale;
  const dawnLatchGtiWm2 = SOLAR_CONSTANTS.DAWN_LATCH_GTI_WM2;
  const dawnLatchDcKw = SOLAR_CONSTANTS.DAWN_LATCH_DC_KW_REF3 * invScale;
  let relayLatched = false;

  const rawSamples: Array<{
    minutes: number;
    gti: number;
    dcKw: number;
    rawKw: number;
    etaPct: number;
    acPr: number;
    dcPr: number;
    cellTemp: number;
    tauSmog: number;
    tauSlant: number;
    iam: number;
  }> = [];

  const resolvedRefAzimuth =
    gtiReferenceAzimuthDeg !== null &&
    gtiReferenceAzimuthDeg !== undefined &&
    Number.isFinite(Number(gtiReferenceAzimuthDeg))
      ? Math.max(-180, Math.min(180, Number(gtiReferenceAzimuthDeg)))
      : safeAzimuth;
  const needsAzimuthTransposition = Math.abs(safeAzimuth - resolvedRefAzimuth) >= 0.5;
  const cosTilt = Math.cos((safeTilt * Math.PI) / 180);
  const thermalAlpha = 1 - Math.exp(-stepMin / SOLAR_CONSTANTS.CELL_TEMP_TAU_MIN);
  let smoothedCellTempC: number | null = null;
  const hasDniSeries = Array.isArray(hourlyDni) && hourlyDni.length >= 12;
  const hasDiffuseSeries = Array.isArray(hourlyDiffuse) && hourlyDiffuse.length >= 12;

  for (let m = srMin; m < ssMin; m += stepMin) {
    const rawGti = getRawGtiAtMin(m);
    const stepAmbient = sampleHourlyStateAtMin(hourlyTempC, m, ambientTempC ?? 24);
    const stepWind = sampleHourlyStateAtMin(hourlyWindKmh, m, windSpeedKmh ?? 6);
    const stepPm10 = sampleHourlyStateAtMin(hourlyPm10, m, defaultPm10);
    const stepAod = sampleHourlyStateAtMin(hourlyAod, m, NaN);
    const stepDni = hasDniSeries ? sampleUniformArrayAtMin(hourlyDni, 60, m + 30) : NaN;
    const stepDiffuse = hasDiffuseSeries ? sampleUniformArrayAtMin(hourlyDiffuse, 60, m + 30) : NaN;

    const inc = computeTiltedIncidenceCosine(lat, lon, safeTilt, safeAzimuth, resolvedYmd, m);
    let gti = rawGti;
    if (needsAzimuthTransposition && rawGti > 5) {
      const incRef = computeTiltedIncidenceCosine(lat, lon, safeTilt, resolvedRefAzimuth, resolvedYmd, m);
      if (Number.isFinite(stepDni) && stepDni > 5) {
        const beamRef = Math.max(0, stepDni * Math.max(0, incRef.cosThetaInc));
        const beamEff = Math.max(0, stepDni * Math.max(0, inc.cosThetaInc));
        gti = Math.max(0, rawGti + (beamEff - beamRef));
      } else {
        const ratio = Math.max(0, inc.cosThetaInc) / Math.max(0.15, incRef.cosThetaInc);
        gti = Math.max(0, rawGti * (0.3 + 0.7 * Math.max(0.75, Math.min(1.25, ratio))));
      }
    }

    const {
      tauAtmos,
      tauSmogCompat: tauSmog,
      tauSlantCompat: tauSlant,
    } = computeAtmosphericAerosolTransmittance(inc.cosThetaZ, stepAod, stepPm10);
    const gtiAlbedoAdjusted = gti * (1 + albedoDeltaGtiFrac);
    const gEff = Math.max(0, gtiAlbedoAdjusted * tauAtmos);

    let directWeight: number | undefined;
    if (gti > 5) {
      if (Number.isFinite(stepDni) && stepDni >= 0) {
        const beamTilted = Math.max(0, stepDni * Math.max(0, inc.cosThetaInc));
        directWeight = Math.max(0.05, Math.min(0.95, beamTilted / Math.max(gti, beamTilted + 1)));
      } else if (Number.isFinite(stepDiffuse) && stepDiffuse >= 0) {
        const diffuseTilted = Math.max(0, stepDiffuse * (1 + cosTilt) * 0.5);
        directWeight = Math.max(0.05, Math.min(0.95, 1 - diffuseTilted / Math.max(gti, diffuseTilted + 1)));
      }
    }

    const iam = computeAshraeIam(inc.cosThetaInc, gEff, directWeight, safeSurfaceLoss);

    const rawCellTemp = computeCellTempC(stepAmbient, gEff, stepWind, safeMounting);
    const cellTemp: number =
      smoothedCellTempC === null
        ? rawCellTemp
        : smoothedCellTempC + thermalAlpha * (rawCellTemp - smoothedCellTempC);
    smoothedCellTempC = cellTemp;
    const tempFactor = Math.max(
      0.80,
      Math.min(1.06, 1 - thermalCoeff * (cellTemp - SOLAR_CONSTANTS.REF_CELL_TEMP_C))
    );

    const hIdx = Math.min(23, Math.max(0, Math.floor(m / 60)));
    const shadeRaw =
      Array.isArray(hourlyShadeFactors) && Number.isFinite(hourlyShadeFactors[hIdx])
        ? hourlyShadeFactors[hIdx]
        : 1.0;
    const shadeFactor = Math.max(0.45, Math.min(1.05, shadeRaw));

    const dcPr = resolvedDcClean * iam * tempFactor * surfaceFactor * shadeFactor;
    const rawDcKw = Math.max(0, (gEff / 1000) * dcCap * resolvedKSite * dcPr);

    if (!relayLatched) {
      if (gti >= dawnLatchGtiWm2 && rawDcKw >= dawnLatchDcKw) relayLatched = true;
    } else if (rawDcKw <= invTareKw) {
      relayLatched = false;
    }

    const dcKw = relayLatched ? rawDcKw : 0;
    const invRes = relayLatched
      ? computeInverterAcOutputKw(dcKw, acCap, inverterLossCoeffs)
      : { acKw: 0, lossKw: 0, etaFrac: 0 };
    const acKw = invRes.acKw;
    const acPr = gti > 5 ? acKw / ((gti / 1000) * dcCap) : baselinePr.pr;

    rawSamples.push({
      minutes: m,
      gti,
      dcKw,
      rawKw: acKw,
      etaPct: +(invRes.etaFrac * 100).toFixed(1),
      acPr,
      dcPr,
      cellTemp,
      tauSmog,
      tauSlant,
      iam,
    });
  }

  rawSamples.push({
    minutes: ssMin,
    gti: 0,
    dcKw: 0,
    rawKw: 0,
    etaPct: 0,
    acPr: baselinePr.pr,
    dcPr: baselinePr.dcPr,
    cellTemp: baselinePr.cellTempC,
    tauSmog: baselinePr.tauSmog,
    tauSlant: 1.0,
    iam: 0.62,
  });

  let rawIntegralKwh = 0;
  for (let i = 1; i < rawSamples.length; i++) {
    const dtH = (rawSamples[i].minutes - rawSamples[i - 1].minutes) / 60;
    rawIntegralKwh += ((rawSamples[i - 1].rawKw + rawSamples[i].rawKw) / 2) * dtH;
  }

  const radFallbackKwh = +((radMj / 3.6) * dcCap * baselinePr.pr).toFixed(1);
  const calFactor = !usedTiltedGti && rawIntegralKwh > 0.1 ? radFallbackKwh / rawIntegralKwh : 1;

  let cumKwh = 0;
  let sumDcKwh = 0;
  let sumAcKwh = 0;
  let sumTauWeighted = 0;
  let sumTauSlantWeighted = 0;
  let sumGtiWeight = 0;
  let peakKw = 0;
  let peakDcKw = 0;
  let peakMinutes = noonMin;
  let peakPr = baselinePr.pr;
  let peakDcPr = baselinePr.dcPr;
  let peakCellTemp = baselinePr.cellTempC;
  let peakIam = 0.99;
  const points: DailySolarPhysicsPoint[] = [];

  for (let i = 0; i < rawSamples.length; i++) {
    const s = rawSamples[i];
    const dcKwStep = +Math.max(0, s.dcKw * calFactor).toFixed(3);
    const kw = +Math.min(acCap, Math.max(0, s.rawKw * calFactor)).toFixed(2);
    if (i > 0) {
      const dtH = (s.minutes - rawSamples[i - 1].minutes) / 60;
      cumKwh += ((points[i - 1].kw + kw) / 2) * dtH;
      sumAcKwh += ((points[i - 1].kw + kw) / 2) * dtH;
      sumDcKwh += ((points[i - 1].dcKw + dcKwStep) / 2) * dtH;
    }
    if (s.gti > 20) {
      sumTauWeighted += s.tauSmog * s.gti;
      sumTauSlantWeighted += s.tauSlant * s.gti;
      sumGtiWeight += s.gti;
    }
    if (dcKwStep > peakDcKw) peakDcKw = dcKwStep;
    if (kw > peakKw) {
      peakKw = kw;
      peakMinutes = s.minutes;
      peakPr = s.acPr;
      peakDcPr = s.dcPr;
      peakCellTemp = s.cellTemp;
      peakIam = s.iam;
    }
    points.push({
      minutes: s.minutes,
      gti: Math.round(s.gti),
      dcKw: dcKwStep,
      kw,
      etaPct: s.etaPct,
      cumKwh: +cumKwh.toFixed(2),
    });
  }

  const targetDailyModelKwh = usedTiltedGti ? +cumKwh.toFixed(1) : radFallbackKwh;
  const weightedInvEtaPct =
    sumDcKwh > 0.05 ? +Math.min(98.5, Math.max(50, (sumAcKwh / sumDcKwh) * 100)).toFixed(1) : 93.2;
  const tauSmogAvg = sumGtiWeight > 0 ? +(sumTauWeighted / sumGtiWeight).toFixed(3) : baselinePr.tauSmog;
  const tauSlantAvg = sumGtiWeight > 0 ? +(sumTauSlantWeighted / sumGtiWeight).toFixed(3) : 1.0;

  const lookupAtMinute = (targetMin: number) => {
    const m = Math.max(srMin, Math.min(ssMin, targetMin));
    if (points.length === 0) return { kw: 0, cumKwh: 0, gti: 0 };
    for (let i = 1; i < points.length; i++) {
      if (m <= points[i].minutes) {
        const a = points[i - 1];
        const b = points[i];
        const f = (m - a.minutes) / Math.max(0.01, b.minutes - a.minutes);
        return {
          kw: +(a.kw + f * (b.kw - a.kw)).toFixed(2),
          cumKwh: +(a.cumKwh + f * (b.cumKwh - a.cumKwh)).toFixed(2),
          gti: Math.round(a.gti + f * (b.gti - a.gti)),
        };
      }
    }
    const last = points[points.length - 1];
    return { kw: last.kw, cumKwh: last.cumKwh, gti: last.gti };
  };

  return {
    sunriseMin: srMin,
    sunsetMin: ssMin,
    noonMin,
    daylightMin: Math.max(1, ssMin - srMin),
    sunriseText: formatMinutes12hUpper(srMin),
    sunsetText: formatMinutes12hUpper(ssMin),
    solarNoonText: formatMinutes12hUpper(noonMin),
    daylightText: formatDurationHm(Math.max(1, ssMin - srMin)),
    targetDailyModelKwh,
    effectivePr: +peakPr.toFixed(4),
    effectiveDcPr: +peakDcPr.toFixed(4),
    weightedInvEtaPct,
    tauSmogAvg,
    tauSlantAvg,
    kSiteApplied: +resolvedKSite.toFixed(4),
    iamAtPeak: +peakIam.toFixed(4),
    cellTempC: peakCellTemp,
    usedTiltedGti,
    usedInstantGti,
    points,
    peakDcKw: +peakDcKw.toFixed(2),
    peakKw: +peakKw.toFixed(2),
    peakMinutes,
    peakTimeText: formatMinutes12hUpper(peakMinutes),
    lookupAtMinute,
  };
}

/**
 * Convenience helper computing Today's full physics model + instantaneous values at a given IST minute.
 */
export function computeTodayPhysicsAtMinute(
  weatherData: any,
  capacityKwp: number,
  minuteOfDay: number,
  surfaceLossPct?: number,
  physicsOverrides?: {
    thermalCoeffPerC?: number | null;
    dcCleanFactor?: number | null;
    basePrAtStc?: number | null;
    inverterEfficiency?: number | null;
    dcCapacityKwp?: number | null;
    acInverterCapacityKw?: number | null;
    arrayTiltDeg?: number | null;
    arrayAzimuthDeg?: number | null;
    mountingType?: MountingType | null;
    roofAlbedo?: number | null;
    kSite?: number | null;
    inverterLossCoeffs?: Partial<InverterLossCoeffs> | null;
    hourlyShadeFactors?: number[] | null;
    gtiReferenceAzimuthDeg?: number | null;
  }
) {
  const resolvedLoss =
    typeof surfaceLossPct === 'number' && Number.isFinite(surfaceLossPct)
      ? surfaceLossPct
      : Number(weatherData?.todayForecast?.currentSurfaceLossPct) || 0;
  const model = computeDailySolarPhysicsModel({
    sunriseIso: weatherData?.todayForecast?.sunrise,
    sunsetIso: weatherData?.todayForecast?.sunset,
    ymd: weatherData?.todayForecast?.dateYmd || weatherData?.istDateYmd,
    lat: weatherData?.location?.lat,
    lon: weatherData?.location?.lon,
    hourlyGti: Array.isArray(weatherData?.hourly?.globalTiltedIrradiance)
      ? weatherData.hourly.globalTiltedIrradiance.slice(0, 24)
      : [],
    hourlyGtiInstant: Array.isArray(weatherData?.hourly?.globalTiltedIrradianceInstant)
      ? weatherData.hourly.globalTiltedIrradianceInstant.slice(0, 24)
      : [],
    minutely15Gti: Array.isArray(weatherData?.minutely15?.globalTiltedIrradiance)
      ? weatherData.minutely15.globalTiltedIrradiance.slice(0, 96)
      : [],
    minutely15GtiInstant: Array.isArray(weatherData?.minutely15?.globalTiltedIrradianceInstant)
      ? weatherData.minutely15.globalTiltedIrradianceInstant.slice(0, 96)
      : [],
    hourlyDiffuse: Array.isArray(weatherData?.hourly?.diffuseRadiation)
      ? weatherData.hourly.diffuseRadiation.slice(0, 24)
      : [],
    hourlyDni: Array.isArray(weatherData?.hourly?.directNormalIrradiance)
      ? weatherData.hourly.directNormalIrradiance.slice(0, 24)
      : [],
    hourlyCloudCover: Array.isArray(weatherData?.hourly?.cloudCover)
      ? weatherData.hourly.cloudCover.slice(0, 24)
      : [],
    hourlyTempC: Array.isArray(weatherData?.hourly?.temperature2m)
      ? weatherData.hourly.temperature2m.slice(0, 24)
      : [],
    hourlyWindKmh: Array.isArray(weatherData?.hourly?.windSpeed10m)
      ? weatherData.hourly.windSpeed10m.slice(0, 24)
      : [],
    hourlyPm10: Array.isArray(weatherData?.hourly?.pm10)
      ? weatherData.hourly.pm10.slice(0, 24)
      : [],
    hourlyAod: Array.isArray(weatherData?.hourly?.aerosolOpticalDepth)
      ? weatherData.hourly.aerosolOpticalDepth.slice(0, 24)
      : [],
    radiationMjM2: weatherData?.todayForecast?.radiationMjM2 ?? 15.33,
    capacityKwp,
    dcCapacityKwp: physicsOverrides?.dcCapacityKwp,
    acInverterCapacityKw: physicsOverrides?.acInverterCapacityKw,
    arrayTiltDeg: physicsOverrides?.arrayTiltDeg,
    arrayAzimuthDeg: physicsOverrides?.arrayAzimuthDeg,
    gtiReferenceAzimuthDeg:
      weatherData?.location?.azimuthDegrees ??
      weatherData?.azimuthDegrees ??
      physicsOverrides?.gtiReferenceAzimuthDeg ??
      null,
    mountingType: physicsOverrides?.mountingType,
    roofAlbedo: physicsOverrides?.roofAlbedo,
    surfaceLossPct: resolvedLoss,
    ambientTempC: weatherData?.current?.temperature ?? 24,
    windSpeedKmh: weatherData?.current?.windSpeed ?? 6,
    aod: weatherData?.current?.aerosolOpticalDepth ?? 0.4,
    pm10: weatherData?.current?.pm10 ?? weatherData?.todayForecast?.pm10 ?? null,
    pm25: weatherData?.current?.pm25 ?? 45,
    thermalCoeffPerC: physicsOverrides?.thermalCoeffPerC,
    dcCleanFactor: physicsOverrides?.dcCleanFactor,
    basePrAtStc: physicsOverrides?.basePrAtStc,
    inverterEfficiency: physicsOverrides?.inverterEfficiency,
    kSite: physicsOverrides?.kSite,
    inverterLossCoeffs: physicsOverrides?.inverterLossCoeffs,
    hourlyShadeFactors: physicsOverrides?.hourlyShadeFactors,
  });
  const isAfterSunset = minuteOfDay > model.sunsetMin;
  const isDaylightWindow = minuteOfDay >= model.sunriseMin && !isAfterSunset;
  const current = isDaylightWindow
    ? model.lookupAtMinute(minuteOfDay)
    : { kw: 0, cumKwh: isAfterSunset ? model.targetDailyModelKwh : 0, gti: 0 };
  return { model, current, isDaylightWindow };
}
