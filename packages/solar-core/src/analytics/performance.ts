import { computeAstronomicalSunTimes, computeDailySolarPhysicsModel } from '../physics/index.ts';
import { parseYmdParts, shiftYmdDays } from '../time/istDate.ts';
import type { DailyPerformanceLedgerEntry, DipAttributionCategory } from '../types/intelligence.ts';
import type { DailySolarPhysicsModel } from '../types/physics.ts';
import type { MountingType } from '../types/settings.ts';
import type { RawSeries } from '../types/telemetry.ts';
import type { DayComparisonWeather, SolarWeatherResponse } from '../types/weather.ts';
import {
  lookupRealTelemetryAtMinute,
  parseRawTelemetry,
  type ParsedDayTelemetry,
} from './telemetryParser.ts';

export interface WeightedEfficiencyResult {
  etaPct: number | null;
  sampleCount: number;
  sumAcKw: number;
  sumDcKw: number;
  latestAcKw: number | null;
  latestDcKw: number | null;
  latestEtaPct: number | null;
}

function parsePointMinutes(timeStr: string): number | null {
  const m = String(timeStr || '').match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Computes energy-weighted inverter conversion efficiency (AC / DC) across active daytime samples.
 */
export function computeWeightedInverterEfficiency(
  rawSeries: RawSeries[] | null | undefined
): WeightedEfficiencyResult {
  if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
    return {
      etaPct: null,
      sampleCount: 0,
      sumAcKw: 0,
      sumDcKw: 0,
      latestAcKw: null,
      latestDcKw: null,
      latestEtaPct: null,
    };
  }

  const genSeries = rawSeries.find((s) => s.variable === 'generationPower');
  const pvSeries = rawSeries.find((s) => s.variable === 'pvPower');
  const genData = Array.isArray(genSeries?.data) ? genSeries.data : [];
  const pvData = Array.isArray(pvSeries?.data) ? pvSeries.data : [];
  if (genData.length === 0 || pvData.length === 0) {
    return {
      etaPct: null,
      sampleCount: 0,
      sumAcKw: 0,
      sumDcKw: 0,
      latestAcKw: null,
      latestDcKw: null,
      latestEtaPct: null,
    };
  }

  const pvByMin = new Map<number, number>();
  for (const pt of pvData) {
    const mins = parsePointMinutes(pt?.time);
    if (mins !== null) pvByMin.set(mins, Number(pt?.value) || 0);
  }

  let sumAc = 0;
  let sumDc = 0;
  let sampleCount = 0;
  let latestAcKw: number | null = null;
  let latestDcKw: number | null = null;
  let latestMin = -1;

  for (const pt of genData) {
    const mins = parsePointMinutes(pt?.time);
    if (mins === null) continue;
    const ac = Number(pt?.value) || 0;
    let dc = pvByMin.get(mins);
    if (dc === undefined) {
      for (const offset of [-1, 1, -2, 2]) {
        const alt = pvByMin.get(mins + offset);
        if (alt !== undefined) {
          dc = alt;
          break;
        }
      }
    }
    if (dc === undefined || dc < 0.08 || ac <= 0.01) continue;
    if (ac > dc * 1.04 || ac / dc < 0.42) continue;

    sumAc += ac;
    sumDc += dc;
    sampleCount += 1;
    if (mins >= latestMin) {
      latestMin = mins;
      latestAcKw = ac;
      latestDcKw = dc;
    }
  }

  if (sampleCount === 0 || sumDc <= 0) {
    return {
      etaPct: null,
      sampleCount: 0,
      sumAcKw: 0,
      sumDcKw: 0,
      latestAcKw: null,
      latestDcKw: null,
      latestEtaPct: null,
    };
  }

  const rawWeighted = (sumAc / sumDc) * 100;
  const etaPct = +Math.min(98.5, Math.max(45.0, rawWeighted)).toFixed(1);
  const latestEtaPct =
    latestAcKw !== null && latestDcKw !== null && latestDcKw >= 0.08
      ? +Math.min(98.5, Math.max(45.0, (latestAcKw / latestDcKw) * 100)).toFixed(1)
      : etaPct;

  return {
    etaPct,
    sampleCount,
    sumAcKw: +sumAc.toFixed(2),
    sumDcKw: +sumDc.toFixed(2),
    latestAcKw: latestAcKw !== null ? +latestAcKw.toFixed(2) : null,
    latestDcKw: latestDcKw !== null ? +latestDcKw.toFixed(2) : null,
    latestEtaPct,
  };
}

export interface BuildDatePhysicsParams {
  ymd: string;
  todayYmd: string;
  lat: number;
  lon: number;
  capacityKwp: number;
  dcCapacityKwp?: number | null;
  acInverterCapacityKw?: number | null;
  arrayTiltDeg?: number | null;
  arrayAzimuthDeg?: number | null;
  mountingType?: MountingType | null;
  roofAlbedo?: number | null;
  dcCleanFactor?: number | null;
  thermalCoeffPerC?: number | null;
  basePrAtStc?: number | null;
  inverterEfficiency?: number | null;
  kSite?: number | null;
  inverterLossCoeffs?: {
    tareKw?: number;
    linearLoss?: number;
    quadLoss?: number;
    cutoffKw?: number;
    referenceAcKw?: number;
  } | null;
  hourlyShadeFactors?: number[] | null;
  canonicalTodayModel?: DailySolarPhysicsModel | null;
  weatherData?: SolarWeatherResponse | null;
  histWeather?: DayComparisonWeather | null;
  surfaceLossPct: number;
}

/**
 * Produces the canonical physics curve for any calendar date, reusing `canonicalTodayModel` for Today.
 */
export function buildPhysicsModelForDate(
  params: BuildDatePhysicsParams
): DailySolarPhysicsModel {
  const {
    ymd,
    todayYmd,
    lat,
    lon,
    capacityKwp,
    dcCapacityKwp,
    acInverterCapacityKw,
    arrayTiltDeg,
    arrayAzimuthDeg,
    mountingType,
    roofAlbedo,
    dcCleanFactor,
    thermalCoeffPerC,
    basePrAtStc,
    inverterEfficiency,
    kSite,
    inverterLossCoeffs,
    hourlyShadeFactors,
    canonicalTodayModel,
    weatherData,
    histWeather,
    surfaceLossPct,
  } = params;

  if (ymd === todayYmd && canonicalTodayModel) {
    return canonicalTodayModel;
  }

  const astroFallback = computeAstronomicalSunTimes(lat, lon, ymd);
  const recentPast = weatherData?.pastDays?.[ymd];
  const sunriseFallback = `${ymd}T${String(Math.floor(astroFallback.sunriseMin / 60)).padStart(2, '0')}:${String(
    astroFallback.sunriseMin % 60
  ).padStart(2, '0')}`;
  const sunsetFallback = `${ymd}T${String(Math.floor(astroFallback.sunsetMin / 60)).padStart(2, '0')}:${String(
    astroFallback.sunsetMin % 60
  ).padStart(2, '0')}`;

  const sunriseIso =
    (ymd === todayYmd ? weatherData?.todayForecast?.sunrise : null) ||
    histWeather?.sunrise ||
    recentPast?.sunrise ||
    sunriseFallback;
  const sunsetIso =
    (ymd === todayYmd ? weatherData?.todayForecast?.sunset : null) ||
    histWeather?.sunset ||
    recentPast?.sunset ||
    sunsetFallback;

  const pickHourly = (
    todayArr: number[] | undefined,
    histArr: number[] | undefined,
    pastArr: number[] | undefined,
    len: number
  ): number[] => {
    if (ymd === todayYmd && Array.isArray(todayArr)) return todayArr.slice(0, len);
    if (Array.isArray(histArr) && histArr.length >= len) return histArr.slice(0, len);
    if (Array.isArray(pastArr) && pastArr.length >= len) return pastArr.slice(0, len);
    return [];
  };

  const hourlyGti = pickHourly(weatherData?.hourly?.globalTiltedIrradiance, histWeather?.hourlyGti, recentPast?.hourlyGti, 24);
  const hourlyGtiInstant = pickHourly(weatherData?.hourly?.globalTiltedIrradianceInstant, histWeather?.hourlyGtiInstant, recentPast?.hourlyGtiInstant, 24);
  const minutely15Gti = pickHourly(weatherData?.minutely15?.globalTiltedIrradiance, histWeather?.minutely15Gti, recentPast?.minutely15Gti, 96);
  const minutely15GtiInstant = pickHourly(weatherData?.minutely15?.globalTiltedIrradianceInstant, histWeather?.minutely15GtiInstant, recentPast?.minutely15GtiInstant, 96);
  const hourlyTempC = pickHourly(weatherData?.hourly?.temperature2m, histWeather?.hourlyTempC, recentPast?.hourlyTempC, 24);
  const hourlyWindKmh = pickHourly(weatherData?.hourly?.windSpeed10m, histWeather?.hourlyWindKmh, recentPast?.hourlyWindKmh, 24);
  const hourlyPm10 = pickHourly(weatherData?.hourly?.pm10, histWeather?.hourlyPm10, recentPast?.hourlyPm10, 24);
  const hourlyAod = pickHourly(weatherData?.hourly?.aerosolOpticalDepth, histWeather?.hourlyAod, recentPast?.hourlyAod, 24);
  const hourlyDiffuse = pickHourly(weatherData?.hourly?.diffuseRadiation, histWeather?.hourlyDiffuse, recentPast?.hourlyDiffuse, 24);
  const hourlyDni = pickHourly(weatherData?.hourly?.directNormalIrradiance, histWeather?.hourlyDni, recentPast?.hourlyDni, 24);
  const hourlyCloudCover = pickHourly(weatherData?.hourly?.cloudCover, histWeather?.hourlyCloudCover, recentPast?.hourlyCloudCover, 24);

  const gtiReferenceAzimuthDeg =
    histWeather?.gtiFetchedAzimuthDeg ??
    recentPast?.gtiFetchedAzimuthDeg ??
    weatherData?.azimuthDegrees ??
    weatherData?.location?.azimuthDegrees ??
    arrayAzimuthDeg;

  const radiationMjM2 =
    (ymd === todayYmd ? weatherData?.todayForecast?.radiationMjM2 : null) ??
    histWeather?.radiationMjM2 ??
    recentPast?.radiationMjM2 ??
    15.2;

  return computeDailySolarPhysicsModel({
    sunriseIso,
    sunsetIso,
    ymd,
    lat,
    lon,
    hourlyGti,
    hourlyGtiInstant,
    minutely15Gti,
    minutely15GtiInstant,
    hourlyTempC,
    hourlyWindKmh,
    hourlyPm10,
    hourlyAod,
    hourlyDiffuse,
    hourlyDni,
    hourlyCloudCover,
    ambientTempC:
      histWeather?.tempMax != null && histWeather?.tempMin != null
        ? (histWeather.tempMax + histWeather.tempMin) / 2
        : weatherData?.current?.temperature ?? 25,
    windSpeedKmh: weatherData?.current?.windSpeed ?? 6,
    radiationMjM2,
    capacityKwp,
    dcCapacityKwp,
    acInverterCapacityKw,
    arrayTiltDeg,
    arrayAzimuthDeg,
    gtiReferenceAzimuthDeg,
    mountingType,
    roofAlbedo,
    dcCleanFactor,
    thermalCoeffPerC,
    basePrAtStc,
    inverterEfficiency,
    kSite,
    inverterLossCoeffs,
    hourlyShadeFactors,
    surfaceLossPct,
  });
}

export interface CompareHoverDelta {
  minuteOfDay: number;
  realKw: number | null;
  realCumKwh: number | null;
  compareKw: number | null;
  compareCumKwh: number | null;
  diffKw: number | null;
  diffKwPct: number | null;
  diffCumKwh: number | null;
  diffCumPct: number | null;
}

export function computeCompareDeltaAtMinute(
  primaryParsed: ParsedDayTelemetry | null,
  compareParsed: ParsedDayTelemetry | null,
  minuteOfDay: number
): CompareHoverDelta {
  const pri = primaryParsed ? lookupRealTelemetryAtMinute(primaryParsed, minuteOfDay) : null;
  const cmp = compareParsed ? lookupRealTelemetryAtMinute(compareParsed, minuteOfDay) : null;

  const realKw = pri ? pri.kw : null;
  const realCumKwh = pri ? pri.cumKwh : null;
  const compareKw = cmp ? cmp.kw : null;
  const compareCumKwh = cmp ? cmp.cumKwh : null;

  const diffKw =
    realKw !== null && compareKw !== null ? +(realKw - compareKw).toFixed(2) : null;
  const diffKwPct =
    diffKw !== null && compareKw !== null && compareKw > 0.08
      ? Math.round((diffKw / compareKw) * 100)
      : null;

  const diffCumKwh =
    realCumKwh !== null && compareCumKwh !== null
      ? +(realCumKwh - compareCumKwh).toFixed(2)
      : null;
  const diffCumPct =
    diffCumKwh !== null && compareCumKwh !== null && compareCumKwh > 0.1
      ? Math.round((diffCumKwh / compareCumKwh) * 100)
      : null;

  return {
    minuteOfDay,
    realKw,
    realCumKwh,
    compareKw,
    compareCumKwh,
    diffKw,
    diffKwPct,
    diffCumKwh,
    diffCumPct,
  };
}

export function buildDaySparkPoints(params: {
  rawSeries?: RawSeries[] | null;
  sunriseMin: number;
  sunsetMin: number;
  hourlyGti?: number[];
  targetRealKwh: number;
  targetModelKwh: number;
}): {
  realNormPoints: Array<{ t: number; v: number }>;
  modelNormPoints: Array<{ t: number; v: number }>;
  peakKw: number | null;
  isMeasuredCurve: boolean;
} {
  const { rawSeries, sunriseMin, sunsetMin, hourlyGti, targetRealKwh, targetModelKwh } = params;
  const parsed =
    Array.isArray(rawSeries) && rawSeries.length > 0
      ? parseRawTelemetry(rawSeries, sunriseMin, sunsetMin)
      : null;

  const span = Math.max(60, sunsetMin - sunriseMin);
  const buckets = 16;

  const shapeWeights: number[] = [];
  for (let i = 0; i <= buckets; i++) {
    const frac = i / buckets;
    const m = sunriseMin + frac * span;
    let w = 0;
    if (Array.isArray(hourlyGti) && hourlyGti.length >= 24) {
      const hr = m / 60;
      const h0 = Math.max(0, Math.min(23, Math.floor(hr)));
      const h1 = Math.max(0, Math.min(23, Math.ceil(hr)));
      const t = hr - h0;
      const g0 = Number(hourlyGti[h0]) || 0;
      const g1 = Number(hourlyGti[h1]) || 0;
      w = Math.max(0, g0 + (g1 - g0) * t);
    } else {
      w = Math.max(0, Math.sin(frac * Math.PI) ** 1.35);
    }
    shapeWeights.push(w);
  }
  const weightSum = shapeWeights.reduce((acc, v) => acc + v, 0) || 1;
  const maxShapeWeight = Math.max(...shapeWeights, 0.001);

  const modelNormPoints = shapeWeights.map((w, idx) => ({
    t: idx / buckets,
    v: targetModelKwh > 0 ? Math.min(1, w / maxShapeWeight) : 0,
  }));

  if (parsed && parsed.allPoints.length >= 4 && parsed.peakKw > 0.05) {
    const refScale = Math.max(parsed.peakKw, (targetModelKwh / Math.max(1, span / 60)) * 1.45, 0.5);
    const realNormPoints = parsed.allPoints.map((pt) => ({
      t: Math.max(0, Math.min(1, (pt.minutes - sunriseMin) / span)),
      v: Math.max(0, Math.min(1, pt.kw / refScale)),
    }));
    const modelScale = targetModelKwh > 0 && weightSum > 0 ? targetModelKwh / Math.max(0.01, targetRealKwh || targetModelKwh) : 1;
    const scaledModelPoints = shapeWeights.map((w, idx) => ({
      t: idx / buckets,
      v: Math.max(0, Math.min(1, (w / maxShapeWeight) * Math.min(1.05, Math.max(0.55, modelScale * 0.85)))),
    }));
    return {
      realNormPoints,
      modelNormPoints: scaledModelPoints,
      peakKw: +parsed.peakKw.toFixed(2),
      isMeasuredCurve: true,
    };
  }

  const ratio =
    targetModelKwh > 0 ? Math.max(0, Math.min(1.15, targetRealKwh / targetModelKwh)) : targetRealKwh > 0 ? 0.85 : 0;

  return {
    realNormPoints: shapeWeights.map((w, idx) => ({
      t: idx / buckets,
      v: targetRealKwh > 0 ? Math.min(1, (w / maxShapeWeight) * Math.min(1, ratio * 0.92)) : 0,
    })),
    modelNormPoints,
    peakKw: null,
    isMeasuredCurve: false,
  };
}

export interface PeriodEnergyAttribution {
  idealClearSkyKwh: number;
  modeledTargetKwh: number;
  deliveredRealKwh: number;
  weatherLossKwh: number;
  hazeAndSoilingLossKwh: number;
  outageGapKwh: number;
  capturePct: number | null;
  confirmedDays: number;
  cloudRainDays: number;
  fogHazeDays: number;
  outageOrPendingDays: number;
  optimalDays: number;
  worstCloudLabel: string | null;
  pendingLabels: string[];
}

export function computePeriodEnergyAttribution(
  entries: DailyPerformanceLedgerEntry[]
): PeriodEnergyAttribution {
  let idealClearSkyKwh = 0;
  let modeledTargetKwh = 0;
  let deliveredRealKwh = 0;
  let weatherLossKwh = 0;
  let hazeAndSoilingLossKwh = 0;
  let outageGapKwh = 0;
  let confirmedDays = 0;
  let cloudRainDays = 0;
  let fogHazeDays = 0;
  let outageOrPendingDays = 0;
  let optimalDays = 0;
  let worstCloudDropKwh = 0;
  let worstCloudLabel: string | null = null;
  const pendingLabels: string[] = [];

  for (const d of entries) {
    idealClearSkyKwh += Number(d.idealClearSkyKwh) || 0;
    modeledTargetKwh += Number(d.modeledAfterSoilingKwh) || 0;
    const real = Number(d.realKwh) || 0;
    const model = Number(d.modeledAfterSoilingKwh) || 0;
    const ideal = Number(d.idealClearSkyKwh) || 0;
    const weatherClean = Number(d.weatherCleanKwh) || model;

    if (d.isConfirmed) {
      deliveredRealKwh += real;
      confirmedDays += 1;
    }

    const wDrop = Math.max(0, ideal - weatherClean);
    const soilHazeDrop = Math.max(0, weatherClean - model);
    weatherLossKwh += wDrop;
    hazeAndSoilingLossKwh += soilHazeDrop;

    if (
      !d.isConfirmed ||
      d.dipCategory === 'OUTAGE_GAP' ||
      d.dipCategory === 'PENDING_SYNC' ||
      d.dipCategory === 'WIFI_OUTAGE_UNLOGGED'
    ) {
      outageGapKwh += Math.max(0, model - real);
      outageOrPendingDays += 1;
      pendingLabels.push(d.shortLabel);
    } else if (d.dipCategory === 'CLOUD_RAIN') {
      cloudRainDays += 1;
      if (wDrop > worstCloudDropKwh) {
        worstCloudDropKwh = wDrop;
        worstCloudLabel = d.shortLabel;
      }
    } else if (d.dipCategory === 'FOG_HAZE' || d.dipCategory === 'SOILING_DRIFT') {
      fogHazeDays += 1;
    } else if (d.dipCategory === 'OPTIMAL') {
      optimalDays += 1;
    }
  }

  const confirmedModelSum = entries
    .filter((d) => d.isConfirmed)
    .reduce((acc, d) => acc + (Number(d.modeledAfterSoilingKwh) || 0), 0);

  return {
    idealClearSkyKwh: +idealClearSkyKwh.toFixed(1),
    modeledTargetKwh: +modeledTargetKwh.toFixed(1),
    deliveredRealKwh: +deliveredRealKwh.toFixed(1),
    weatherLossKwh: +weatherLossKwh.toFixed(1),
    hazeAndSoilingLossKwh: +hazeAndSoilingLossKwh.toFixed(1),
    outageGapKwh: +outageGapKwh.toFixed(1),
    capturePct:
      confirmedModelSum > 0.2 ? Math.round((deliveredRealKwh / confirmedModelSum) * 100) : null,
    confirmedDays,
    cloudRainDays,
    fogHazeDays,
    outageOrPendingDays,
    optimalDays,
    worstCloudLabel,
    pendingLabels,
  };
}

export function getDipCategoryBarColor(category?: DipAttributionCategory | null): {
  fill: string;
  badgeBg: string;
  badgeText: string;
  label: string;
} {
  switch (category) {
    case 'OPTIMAL':
      return {
        fill: '#059669',
        badgeBg: 'bg-emerald-50 border-emerald-200/70',
        badgeText: 'text-emerald-700',
        label: 'On Track',
      };
    case 'CLOUD_RAIN':
      return {
        fill: '#0284C7',
        badgeBg: 'bg-sky-50 border-sky-200/70',
        badgeText: 'text-sky-700',
        label: 'Cloud / Rain',
      };
    case 'FOG_HAZE':
      return {
        fill: '#D97706',
        badgeBg: 'bg-amber-50 border-amber-200/70',
        badgeText: 'text-amber-700',
        label: 'Fog / Haze',
      };
    case 'SOILING_DRIFT':
      return {
        fill: '#E11D48',
        badgeBg: 'bg-rose-50 border-rose-200/70',
        badgeText: 'text-rose-700',
        label: 'Soiling Drift',
      };
    case 'OUTAGE_GAP':
      return {
        fill: '#E11D48',
        badgeBg: 'bg-rose-50 border-rose-200/70',
        badgeText: 'text-rose-700',
        label: 'Inverter Gap',
      };
    case 'WIFI_OUTAGE_UNLOGGED':
      return {
        fill: '#D97706',
        badgeBg: 'bg-amber-50 border-amber-200/70',
        badgeText: 'text-amber-700',
        label: 'Wi-Fi Offline All Day',
      };
    case 'PENDING_SYNC':
      return {
        fill: '#94A3B8',
        badgeBg: 'bg-slate-100 border-slate-200/80',
        badgeText: 'text-slate-600',
        label: 'Awaiting Sync',
      };
    case 'BELOW_BASELINE':
    default:
      return {
        fill: '#64748B',
        badgeBg: 'bg-slate-100 border-slate-200/80',
        badgeText: 'text-slate-700',
        label: 'Below Target',
      };
  }
}

export function buildWeekDatesEndingAt(
  endYmd: string,
  minYmd: string,
  maxYmd: string
): string[] {
  let clampedEnd = endYmd;
  if (clampedEnd > maxYmd) clampedEnd = maxYmd;
  const minWeekEnd = shiftYmdDays(minYmd, 6);
  if (minWeekEnd <= maxYmd && clampedEnd < minWeekEnd) {
    clampedEnd = minWeekEnd;
  }
  const dates: string[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const d = shiftYmdDays(clampedEnd, offset);
    if (d >= minYmd && d <= maxYmd) dates.push(d);
  }
  if (dates.length < 7 && dates.length > 0) {
    const all7: string[] = [];
    for (let offset = -6; offset <= 0; offset++) {
      all7.push(shiftYmdDays(clampedEnd, offset));
    }
    return all7;
  }
  return dates;
}

export function formatWeekdayShort(ymd: string): string {
  const parts = parseYmdParts(ymd);
  if (!parts) return ymd;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const idx = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return names[idx] || '';
}
