import { SOLAR_CONSTANTS, computeDailySolarPhysicsModel } from '../physics/index.ts';
import { getKanpurProfileForDate, isKanpurRegion } from '../calibration/monthlyProfiles.ts';
import type {
  DailyAtmosphereRecord,
  DailyPerformanceLedgerEntry,
  ForecastDayOutlook,
  UnifiedPhysicsOptions,
  WeeklyComparisonWindow,
} from '../types/intelligence.ts';
import { computeDayIrradianceBenchmarks } from './dailyLedger.ts';
import { evaluateSingleDaySoilingStep, formatClock12Upper, formatShortLabel } from './soilingModel.ts';

/**
 * Generates an irradiance-derived daily forecast outlook including contiguous peak
 * load window, weather attenuation, and current surface-soiling penalty.
 */
export function resolveTomorrowForecastWindow(
  day: DailyAtmosphereRecord,
  capacityKwp: number,
  surfaceLossPct: number,
  latDeg: number,
  tiltDeg: number,
  physicsOverrides?: UnifiedPhysicsOptions,
  rainResetDailyMm?: number
): ForecastDayOutlook {
  const bench = computeDayIrradianceBenchmarks(day, capacityKwp, latDeg, tiltDeg, physicsOverrides);
  const step = evaluateSingleDaySoilingStep(day, tiltDeg, rainResetDailyMm);

  const safeCap = Math.max(0.5, capacityKwp || 3.0);
  const ambientAvgC =
    day.tempMax != null && day.tempMin != null
      ? (day.tempMax + day.tempMin) / 2
      : day.tempMax ?? 24;

  const kanpurMonthly = isKanpurRegion(latDeg, physicsOverrides?.lonDeg ?? SOLAR_CONSTANTS.DEFAULT_LON)
    ? getKanpurProfileForDate(day.ymd)
    : null;

  const resolvedKSite =
    kanpurMonthly?.kSite ??
    (typeof physicsOverrides?.kSite === 'number' && Number.isFinite(physicsOverrides.kSite)
      ? physicsOverrides.kSite
      : null);

  const resolvedHourlyShades =
    kanpurMonthly?.hourlyShadeFactors ??
    physicsOverrides?.hourlyShadeFactors ??
    null;

  const sharedParams = {
    sunriseIso: day.sunrise,
    sunsetIso: day.sunset,
    ymd: day.ymd,
    lat: latDeg,
    lon: physicsOverrides?.lonDeg ?? SOLAR_CONSTANTS.DEFAULT_LON,
    hourlyGti: Array.isArray(day.hourlyGti) ? day.hourlyGti : [],
    hourlyGtiInstant: Array.isArray(day.hourlyGtiInstant) ? day.hourlyGtiInstant : [],
    minutely15Gti: Array.isArray(day.minutely15Gti) ? day.minutely15Gti : [],
    minutely15GtiInstant: Array.isArray(day.minutely15GtiInstant) ? day.minutely15GtiInstant : [],
    radiationMjM2: day.radiationMjM2 ?? 14.5,
    capacityKwp: safeCap,
    dcCapacityKwp: physicsOverrides?.dcCapacityKwp ?? safeCap,
    acInverterCapacityKw: physicsOverrides?.acInverterCapacityKw ?? safeCap,
    arrayTiltDeg: tiltDeg,
    arrayAzimuthDeg: physicsOverrides?.azimuthDegrees ?? SOLAR_CONSTANTS.DEFAULT_AZIMUTH_DEG,
    mountingType: physicsOverrides?.mountingType ?? SOLAR_CONSTANTS.DEFAULT_MOUNTING_TYPE,
    roofAlbedo: physicsOverrides?.roofAlbedo ?? SOLAR_CONSTANTS.DEFAULT_ALBEDO,
    ambientTempC: ambientAvgC,
    windSpeedKmh: step.windAvgKmh,
    aod: step.aodAvg,
    pm10: step.pm10Avg,
    pm25: step.pm25Avg,
    hourlyTempC: Array.isArray(day.hourlyTempC) ? day.hourlyTempC : [],
    hourlyWindKmh: Array.isArray(day.hourlyWindKmh) ? day.hourlyWindKmh : [],
    hourlyAod: Array.isArray(day.hourlyAod) ? day.hourlyAod : [],
    hourlyPm10: Array.isArray(day.hourlyPm10) ? day.hourlyPm10 : [],
    hourlyShadeFactors: resolvedHourlyShades,
    hourlyDiffuse: Array.isArray(day.hourlyDiffuse) ? day.hourlyDiffuse : [],
    hourlyDni: Array.isArray(day.hourlyDni) ? day.hourlyDni : [],
    hourlyCloudCover: Array.isArray(day.hourlyCloudCover) ? day.hourlyCloudCover : [],
    gtiReferenceAzimuthDeg: day.gtiFetchedAzimuthDeg ?? physicsOverrides?.gtiReferenceAzimuthDeg ?? 0,
    thermalCoeffPerC: physicsOverrides?.thermalCoeffPerC,
    dcCleanFactor: physicsOverrides?.dcCleanFactor,
    basePrAtStc: physicsOverrides?.basePrAtStc,
    inverterEfficiency: physicsOverrides?.inverterEfficiency,
    kSite: resolvedKSite,
    inverterLossCoeffs: physicsOverrides?.inverterLossCoeffs,
  };
  const cleanCurve = computeDailySolarPhysicsModel({ ...sharedParams, surfaceLossPct: 0 });
  const asIsCurve = computeDailySolarPhysicsModel({ ...sharedParams, surfaceLossPct });
  const calibrated = asIsCurve.points.map((pt) => ({ mins: pt.minutes, kw: pt.kw }));
  const peakSlot = { mins: asIsCurve.peakMinutes, kw: asIsCurve.peakKw };

  // Contiguous Peak Window where kw >= max(0.75, peakKw * 0.65)
  const thresholdKw = Math.max(0.75, peakSlot.kw * 0.65);
  let bestStart: number | null = null;
  let bestEnd: number | null = null;
  let curStart: number | null = null;
  let curLen = 0;
  let bestLen = 0;

  for (let idx = 0; idx < calibrated.length; idx++) {
    const s = calibrated[idx];
    if (s.kw >= thresholdKw) {
      if (curStart === null) curStart = s.mins;
      curLen += 1;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
        bestEnd = idx + 1 < calibrated.length ? calibrated[idx + 1].mins : s.mins + 5;
      }
    } else {
      curStart = null;
      curLen = 0;
    }
  }

  const peakWindowStart = bestStart !== null && bestEnd !== null ? formatClock12Upper(bestStart) : null;
  const peakWindowEnd = bestStart !== null && bestEnd !== null ? formatClock12Upper(bestEnd) : null;

  const sunshineHours =
    typeof day.sunshineDurationHours === 'number' && day.sunshineDurationHours >= 0
      ? +day.sunshineDurationHours.toFixed(1)
      : 7.5;
  const rainProbPct = Math.round(day.precipitationProbMax ?? (step.rainMm >= 1 ? 75 : 5));
  const wCode = day.weatherCode ?? 0;

  let condition = 'Clear Sky';
  let conditionType = 'sunny';
  if (wCode === 95 || wCode === 96 || wCode === 99) {
    condition = 'Thunderstorm';
    conditionType = 'thunderstorm';
  } else if (step.rainMm >= 5.0 || wCode === 63 || wCode === 65 || wCode === 82) {
    condition = 'Rain / Natural Wash';
    conditionType = 'rainy';
  } else if (step.rainMm >= 0.4 || (wCode >= 51 && wCode <= 61) || wCode === 80 || wCode === 81) {
    condition = 'Light Rain / Drizzle';
    conditionType = 'showers';
  } else if (bench.fogHours >= 2 || wCode === 45 || wCode === 48) {
    condition = 'Morning Fog & Haze';
    conditionType = 'hazy';
  } else if (bench.dayCloudAvgPct >= 65 || wCode === 3) {
    condition = 'Overcast Clouds';
    conditionType = 'cloudy';
  } else if (step.aodAvg >= 0.6 || step.pm10Avg >= 140) {
    condition = 'Smoky Haze';
    conditionType = 'hazy';
  } else if (bench.dayCloudAvgPct >= 30 || wCode === 1 || wCode === 2) {
    condition = 'Partly Cloudy';
    conditionType = 'partly_cloudy';
  }

  const cleanExpectedKwh = +cleanCurve.targetDailyModelKwh.toFixed(1);
  const asIsExpectedKwh = +asIsCurve.targetDailyModelKwh.toFixed(1);
  const soilingPenaltyKwh = +Math.max(0, cleanExpectedKwh - asIsExpectedKwh).toFixed(1);

  let peakWindowNote = 'Ideal high-irradiance window (>=65% output) for pumps, EV charging & wash motors.';
  if (!peakWindowStart || !peakWindowEnd || peakSlot.kw < 0.75) {
    peakWindowNote = 'Low irradiance forecast — avoid scheduling heavy motors purely on solar.';
  } else if (bench.fogHours >= 2 && bestStart !== null && bestStart >= 620) {
    peakWindowNote = 'Morning fog delays solar ramp — run heavy loads later in this midday slot.';
  } else if (step.rainMm >= 2.0) {
    peakWindowNote = 'Pre-rain bright window — stagger heavy appliances before clouds thicken.';
  }

  let skyBadgeText = 'Clear Dawn';
  if (bench.fogHours >= 2) {
    skyBadgeText = `Fog ${bench.fogHours}h (<1.5km)`;
  } else if (step.rainMm >= 5.0) {
    skyBadgeText = `Rain ${step.rainMm.toFixed(1)}mm`;
  } else if (rainProbPct >= 45 || step.rainMm >= 0.3) {
    skyBadgeText = `Rain ${rainProbPct}%`;
  } else if (step.dewGlueHours >= 2) {
    skyBadgeText = 'Heavy Dew Night';
  } else if (step.aodAvg >= 0.65) {
    skyBadgeText = `Haze AOD ${step.aodAvg}`;
  }

  return {
    ymd: day.ymd,
    shortLabel: formatShortLabel(day.ymd),
    condition,
    conditionType,
    baselineExpectedKwh: cleanExpectedKwh,
    tiltedCleanExpectedKwh: cleanExpectedKwh,
    asIsExpectedKwh,
    soilingPenaltyKwh,
    sunshineHours,
    tempMin: +(day.tempMin ?? 17).toFixed(1),
    tempMax: +(day.tempMax ?? 28).toFixed(1),
    peakKw: peakSlot.kw,
    peakTimeLabel: formatClock12Upper(peakSlot.mins),
    peakWindowStart,
    peakWindowEnd,
    peakWindowNote,
    rainMm: step.rainMm,
    rainProbPct,
    fogHours: bench.fogHours,
    minVisibilityM: bench.minVisibilityM,
    hasDewNight: step.dewGlueHours >= 2,
    pm10Avg: step.pm10Avg,
    pm25Avg: step.pm25Avg,
    dustAvg: step.dustAvg,
    aodAvg: step.aodAvg,
    skyBadgeText,
  };
}

/**
 * Summarizes real vs modeled performance across a chronological ledger slice.
 */
export function buildWeeklyWindow(
  entries: DailyPerformanceLedgerEntry[],
  label: string
): WeeklyComparisonWindow | null {
  if (entries.length === 0) return null;
  const startYmd = entries[0].ymd;
  const endYmd = entries[entries.length - 1].ymd;
  const confirmed = entries.filter((e) => e.isConfirmed && e.realKwh !== null);
  const realTotal = +confirmed.reduce((s, e) => s + (e.realKwh || 0), 0).toFixed(1);
  const modelForConfirmedTotal = +confirmed.reduce((s, e) => s + e.weatherCleanKwh, 0).toFixed(1);
  const modelAllTotal = +entries.reduce((s, e) => s + e.weatherCleanKwh, 0).toFixed(1);
  const idealAllTotal = +entries.reduce((s, e) => s + e.idealClearSkyKwh, 0).toFixed(1);

  const realAvgKwh = confirmed.length > 0 ? +(realTotal / confirmed.length).toFixed(1) : 0;
  const modelAvgKwh = +(modelAllTotal / entries.length).toFixed(1);
  const idealAvgKwh = +(idealAllTotal / entries.length).toFixed(1);
  const normalizedPerfPct =
    confirmed.length > 0 && modelForConfirmedTotal > 0.5
      ? Math.round((realTotal / modelForConfirmedTotal) * 100)
      : null;
  const weatherAttenuationPct =
    idealAllTotal > 0.5
      ? Math.max(0, Math.min(95, Math.round((1 - modelAllTotal / idealAllTotal) * 100)))
      : 0;

  let biggestDip: WeeklyComparisonWindow['biggestDip'] = null;
  for (const e of confirmed) {
    const pct = e.realVsModelPct ?? 100;
    if (pct < 82 && (!biggestDip || pct < biggestDip.pct)) {
      biggestDip = {
        ymd: e.ymd,
        shortLabel: e.shortLabel,
        realKwh: e.realKwh ?? 0,
        modelKwh: +e.weatherCleanKwh.toFixed(1),
        pct,
        reason: e.dipReasonLabel,
      };
    }
  }

  return {
    label,
    rangeLabel: `${formatShortLabel(startYmd)} – ${formatShortLabel(endYmd)}`,
    startYmd,
    endYmd,
    daysCount: entries.length,
    confirmedDaysCount: confirmed.length,
    realAvgKwh,
    modelAvgKwh,
    idealAvgKwh,
    realTotalKwh: realTotal,
    modelTotalKwh: modelForConfirmedTotal,
    normalizedPerfPct,
    weatherAttenuationPct,
    biggestDip,
  };
}
