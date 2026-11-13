import { formatMinutes12hUpper, parseIsoClockMinutes } from '../physics/astronomy.ts';
import { diffYmdDays, formatIstShortLabel, parseYmdParts, shiftYmdDays } from '../time/istDate.ts';
import type {
  CleaningEvent,
  DailyAtmosphereRecord,
  DayAtmosphereTag,
  WashEventSource,
} from '../types/intelligence.ts';

export const SOILING_THRESHOLDS = {
  rainFullDailyMm: 5.0,
  rainFullHourlyMm: 3.0,
  rainTorrentialMm: 10.0,
  rainPartialMm: 2.0,
  drizzleMinMm: 0.2,
  drizzleMaxMm: 1.99,
  dewSpreadMaxC: 2.0,
  dewRhMinPct: 88,
  fogVisibilityM: 1500,
  denseFogVisibilityM: 1000,
  washRecommendPct: 7.0,
  washRecommendStickyPct: 4.5,
  watchBuildupPct: 3.5,
  maxLossPct: 22.0,
  rainHoldLookaheadDays: 3,
  rainHoldDailyMm: 5.0,
  rainHoldProbDailyMm: 4.0,
  rainHoldProbPct: 65,
} as const;

export function isValidYmd(ymd: string | null | undefined): ymd is string {
  return typeof ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

export function shiftYmd(ymd: string, deltaDays: number): string {
  return shiftYmdDays(ymd, deltaDays);
}

export function diffDaysYmd(laterYmd: string, earlierYmd: string): number {
  return diffYmdDays(laterYmd, earlierYmd);
}

export function formatShortLabel(ymd: string): string {
  const parts = parseYmdParts(ymd);
  if (!parts) return String(ymd || '');
  return formatIstShortLabel(parts.day, parts.month);
}

export function formatClock12Upper(totalMinutes: number): string {
  return formatMinutes12hUpper(totalMinutes);
}

export function avgNums(arr: number[] | undefined, fallback: number, sliceStart = 0, sliceEnd?: number): number {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  const sub = sliceEnd !== undefined ? arr.slice(sliceStart, sliceEnd) : arr.slice(sliceStart);
  const valid = sub.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (valid.length === 0) return fallback;
  return valid.reduce((s, n) => s + n, 0) / valid.length;
}

export function maxNums(arr: number[] | undefined, fallback: number): number {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  const valid = arr.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (valid.length === 0) return fallback;
  return Math.max(...valid);
}

export function minNums(arr: number[] | undefined): number | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const valid = arr.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

export function sumNums(arr: number[] | undefined): number {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return arr.reduce((s, n) => s + (typeof n === 'number' && Number.isFinite(n) ? n : 0), 0);
}

/**
 * Evaluate online raw curve completeness inside the solar daylight window.
 * Distinguishes short telemetry gaps / afternoon Wi-Fi drops / grid outages
 * from weather dips so partial days never pollute clear-sky soiling baselines.
 */
export function evaluateDayRawCoverage(
  rawSeries: Array<{ variable?: string; data?: Array<{ time: string; value: number }> }> | undefined,
  sunriseIso: string | null | undefined,
  sunsetIso: string | null | undefined,
  ymd: string,
  todayYmd: string,
  nowMinutesIst: number
): { onlineCoveragePct: number | null; lastActiveLabel: string | null; lastActiveMin: number | null; note: string | null } {
  if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
    return { onlineCoveragePct: null, lastActiveLabel: null, lastActiveMin: null, note: null };
  }
  const genSeries = rawSeries.find((s) => s.variable === 'generationPower') || rawSeries[0];
  const points = Array.isArray(genSeries?.data) ? genSeries.data : [];
  if (points.length === 0) {
    return { onlineCoveragePct: 0, lastActiveLabel: null, lastActiveMin: null, note: 'No inverter curve points recorded' };
  }

  const srMin = parseIsoClockMinutes(sunriseIso) ?? 6 * 60 + 20;
  const ssMin = parseIsoClockMinutes(sunsetIso) ?? 17 * 60 + 25;
  const effectiveStart = srMin + 30;
  const rawEnd = ymd === todayYmd ? Math.min(ssMin - 30, nowMinutesIst) : ssMin - 30;
  const effectiveEnd = Math.max(effectiveStart + 30, rawEnd);
  const windowSpanMin = Math.max(60, effectiveEnd - effectiveStart);

  const parsed: Array<{ mins: number; kw: number }> = [];
  for (const pt of points) {
    const m = String(pt.time || '').match(/(\d{2}):(\d{2})/);
    if (!m) continue;
    const mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const kw = parseFloat(String(pt.value)) || 0;
    if (mins >= effectiveStart - 15 && mins <= effectiveEnd + 15) {
      parsed.push({ mins, kw });
    }
  }
  parsed.sort((a, b) => a.mins - b.mins);

  if (parsed.length === 0) {
    return { onlineCoveragePct: 0, lastActiveLabel: null, lastActiveMin: null, note: 'Zero daylight generation points' };
  }

  // Sum connected active intervals where dt <= 20 min and power > 0.03 kW
  let activeMinutes = 0;
  let lastActiveMin = -1;
  for (let i = 0; i < parsed.length; i++) {
    const cur = parsed[i];
    if (cur.kw > 0.03) {
      lastActiveMin = cur.mins;
      if (i > 0) {
        const dt = cur.mins - parsed[i - 1].mins;
        if (dt > 0 && dt <= 20 && parsed[i - 1].kw > 0.03) {
          activeMinutes += dt;
        } else if (dt > 0) {
          activeMinutes += Math.min(5, dt);
        }
      } else {
        activeMinutes += 5;
      }
    }
  }

  const coveragePct = Math.min(100, Math.max(0, Math.round((activeMinutes / windowSpanMin) * 100)));
  const lastActiveLabel = lastActiveMin >= 0 ? formatClock12Upper(lastActiveMin) : null;

  let note: string | null = null;
  if (coveragePct < 55) {
    note = `Only ${Math.round(activeMinutes / 60)}h (${coveragePct}%) inverter runtime logged`;
  } else if (ymd < todayYmd && lastActiveMin > 0 && lastActiveMin < effectiveEnd - 65) {
    note = `Telemetry ended early at ${lastActiveLabel} (${coveragePct}% daylight logged)`;
  } else if (coveragePct < 85) {
    note = `Partial telemetry coverage (${coveragePct}% of daylight)`;
  }

  return { onlineCoveragePct: coveragePct, lastActiveLabel, lastActiveMin: lastActiveMin >= 0 ? lastActiveMin : null, note };
}

export interface DailySoilingStep {
  pm10Avg: number;
  pm25Avg: number;
  dustAvg: number;
  aodAvg: number;
  usAqiMax: number;
  rainMm: number;
  maxHourlyRainMm: number;
  dewGlueHours: number;
  windAvgKmh: number;
  baseRatePct: number;
  dewMultiplier: number;
  windMultiplier: number;
  isDrizzleMud: boolean;
  isRainFullWash: boolean;
  isRainPartialRinse: boolean;
  isTorrentialRain: boolean;
  isDustSpike: boolean;
  dailyAdditionPct: number;
}

/**
 * Computes single-day surface particle & microclimate deposition metrics.
 */
export function evaluateSingleDaySoilingStep(
  day: DailyAtmosphereRecord,
  tiltDeg: number,
  rainFullDailyMmOverride?: number
): DailySoilingStep {
  const pm10Avg = +avgNums(day.hourlyPm10, 95).toFixed(1);
  const pm25Avg = +avgNums(day.hourlyPm25, 55).toFixed(1);
  const dustAvg = +avgNums(day.hourlyDust, 18).toFixed(1);
  const aodAvg = +avgNums(day.hourlyAod, 0.55, 7, 17).toFixed(2);
  const usAqiMax = Math.round(maxNums(day.hourlyUsAqi, 150));

  const hourlyRain =
    Array.isArray(day.hourlyRainMm) && day.hourlyRainMm.length > 0
      ? day.hourlyRainMm
      : Array.isArray(day.hourlyPrecipMm)
      ? day.hourlyPrecipMm
      : [];
  const rainFromHourly = sumNums(hourlyRain);
  const maxHourlyRainMm = +maxNums(hourlyRain, 0).toFixed(2);
  const dailySummaryRain =
    typeof day.rainSum === 'number' && day.rainSum >= 0
      ? day.rainSum
      : typeof day.precipitationSum === 'number' && day.precipitationSum >= 0
      ? day.precipitationSum
      : rainFromHourly;
  const rainMm = +Math.max(dailySummaryRain, rainFromHourly).toFixed(2);

  // Check night/early-morning dew condensation hours (00:00..08:00 IST)
  let dewGlueHours = 0;
  const hTemp = Array.isArray(day.hourlyTempC) ? day.hourlyTempC : [];
  const hDew = Array.isArray(day.hourlyDewPointC) ? day.hourlyDewPointC : [];
  const hRh = Array.isArray(day.hourlyRhPct) ? day.hourlyRhPct : [];
  const hVis = Array.isArray(day.hourlyVisibilityM) ? day.hourlyVisibilityM : [];
  const hCode = Array.isArray(day.hourlyWeatherCode) ? day.hourlyWeatherCode : [];
  for (let h = 0; h <= 8; h++) {
    const t = hTemp[h];
    const td = hDew[h];
    const rh = hRh[h];
    const vis = hVis[h];
    const wc = hCode[h];
    const spreadOk = typeof t === 'number' && typeof td === 'number' && t - td <= SOILING_THRESHOLDS.dewSpreadMaxC;
    const rhOk = typeof rh === 'number' && rh >= SOILING_THRESHOLDS.dewRhMinPct;
    const fogOk = (typeof vis === 'number' && vis < SOILING_THRESHOLDS.fogVisibilityM) || wc === 45 || wc === 48;
    if (spreadOk || rhOk || fogOk) {
      dewGlueHours += 1;
    }
  }

  const windAvgKmh = +avgNums(day.hourlyWindKmh, 5.5).toFixed(1);
  const maxWindKmh = maxNums(day.hourlyWindKmh, windAvgKmh);

  const rainFullThresholdMm =
    typeof rainFullDailyMmOverride === 'number' && Number.isFinite(rainFullDailyMmOverride) && rainFullDailyMmOverride > 0
      ? rainFullDailyMmOverride
      : SOILING_THRESHOLDS.rainFullDailyMm;
  const isTorrentialRain = rainMm >= SOILING_THRESHOLDS.rainTorrentialMm;
  const isRainFullWash =
    rainMm >= rainFullThresholdMm ||
    maxHourlyRainMm >= SOILING_THRESHOLDS.rainFullHourlyMm;
  const isRainPartialRinse =
    !isRainFullWash && rainMm >= SOILING_THRESHOLDS.rainPartialMm;
  const isDrizzleMud =
    !isRainFullWash &&
    !isRainPartialRinse &&
    rainMm >= SOILING_THRESHOLDS.drizzleMinMm &&
    rainMm <= SOILING_THRESHOLDS.drizzleMaxMm;

  const isDustSpike = dustAvg >= 80 || pm10Avg >= 220;

  // Tilt projection factor cos(26.5°) = 0.895
  const tiltCos = Math.cos((Math.max(0, Math.min(60, tiltDeg)) * Math.PI) / 180);

  // Separate Coarse Settling Dust (PM10 - PM2.5) from Sticky Fine Soot (PM2.5) and Mineral Dust
  const cCoarse = Math.max(0, pm10Avg - pm25Avg);
  const effectiveSurfaceLoad = 1.0 * cCoarse + 0.35 * pm25Avg + 0.45 * dustAvg;
  const baseRatePct = (0.10 + (effectiveSurfaceLoad / 180) * 0.24) * tiltCos;

  const dewMultiplier = dewGlueHours >= 2 ? 1.65 : dewGlueHours === 1 ? 1.3 : 1.0;

  let windMultiplier = 1.0;
  if (!isDrizzleMud && dewGlueHours === 0 && windAvgKmh > 18 && dustAvg < 80) {
    windMultiplier = 0.75; // dry wind blows away loose dust
  } else if (dustAvg >= 100 && maxWindKmh > 20) {
    windMultiplier = 1.35; // windborne dust storm transport
  }

  const drizzleMultiplier = isDrizzleMud ? 1.8 : 1.0;
  const dailyAdditionPct = +(baseRatePct * dewMultiplier * windMultiplier * drizzleMultiplier).toFixed(3);

  return {
    pm10Avg,
    pm25Avg,
    dustAvg,
    aodAvg,
    usAqiMax,
    rainMm,
    maxHourlyRainMm,
    dewGlueHours,
    windAvgKmh,
    baseRatePct,
    dewMultiplier,
    windMultiplier,
    isDrizzleMud,
    isRainFullWash,
    isRainPartialRinse,
    isTorrentialRain,
    isDustSpike,
    dailyAdditionPct,
  };
}

export function resolveInitialCleanYmd(
  ymds: string[],
  manualWashMap: Map<string, CleaningEvent>,
  fallbackYmd: string
): string {
  let cleanYmd = ymds[0] || fallbackYmd;
  const sortedManual = Array.from(manualWashMap.keys()).sort();
  if (sortedManual.length > 0 && sortedManual[sortedManual.length - 1] < cleanYmd) {
    cleanYmd = sortedManual[sortedManual.length - 1];
  }
  return cleanYmd;
}

export interface SoilingAccumulatorState {
  looseLoss: number;
  cementedLoss: number;
  stickyFilmActive: boolean;
  lastClean: { ymd: string; source: WashEventSource; precipMm?: number };
}

/**
 * Shared single-day hydrological & particulate soiling state transition used identically
 * by site calibration (pre-pass for dusty IAM / residual shading) and the main ledger loop.
 */
export function advanceSoilingDayState(
  state: SoilingAccumulatorState,
  params: {
    ymd: string;
    step: DailySoilingStep;
    manualWash?: CleaningEvent;
    fogHours: number;
  }
): {
  nextState: SoilingAccumulatorState;
  dailyDelta: number;
  totalParticleLossPct: number;
  eventTag: DayAtmosphereTag;
  eventLabel: string;
  cleaningEventToPush: CleaningEvent | null;
} {
  let { looseLoss, cementedLoss, stickyFilmActive, lastClean } = state;
  const { ymd, step, manualWash, fogHours } = params;

  let dailyDelta = step.dailyAdditionPct;
  let eventTag: DayAtmosphereTag = 'CLEAR';
  let eventLabel = 'Dry / Light Settling';
  let cleaningEventToPush: CleaningEvent | null = null;

  if (manualWash) {
    looseLoss = 0;
    cementedLoss = 0;
    stickyFilmActive = false;
    dailyDelta = 0;
    lastClean = { ymd, source: 'manual' };
    eventTag = 'MANUAL_WASH';
    eventLabel = manualWash.note || 'Manual panel wash logged';
    cleaningEventToPush = manualWash;
  } else if (step.isRainFullWash) {
    looseLoss = 0;
    cementedLoss = step.isTorrentialRain ? 0 : +(cementedLoss * 0.15).toFixed(2);
    stickyFilmActive = false;
    dailyDelta = 0;
    lastClean = { ymd, source: 'rain_auto', precipMm: step.rainMm };
    eventTag = 'RAIN_WASH';
    eventLabel = `Heavy rain wash (${step.rainMm.toFixed(1)} mm)`;
    cleaningEventToPush = {
      ymd,
      timestampIso: `${ymd}T12:00:00+05:30`,
      type: 'rain_auto',
      precipMm: step.rainMm,
      note: eventLabel,
    };
  } else if (step.isRainPartialRinse) {
    looseLoss = +(looseLoss * 0.45).toFixed(2);
    cementedLoss = +(cementedLoss * 0.7).toFixed(2);
    dailyDelta = 0;
    eventTag = 'PARTIAL_RINSE';
    eventLabel = `Moderate rain rinse (${step.rainMm.toFixed(1)} mm)`;
    cleaningEventToPush = {
      ymd,
      timestampIso: `${ymd}T12:00:00+05:30`,
      type: 'rain_partial',
      precipMm: step.rainMm,
      note: eventLabel,
    };
  } else if (step.isDrizzleMud) {
    stickyFilmActive = true;
    cementedLoss = +(cementedLoss + step.dailyAdditionPct).toFixed(3);
    eventTag = 'DRIZZLE_MUD';
    eventLabel = `Light drizzle (${step.rainMm.toFixed(1)} mm) trapped PM10 dust`;
  } else {
    if (stickyFilmActive) {
      cementedLoss = +(cementedLoss + step.dailyAdditionPct * 0.35).toFixed(3);
      looseLoss = +(looseLoss + step.dailyAdditionPct * 0.65).toFixed(3);
    } else {
      looseLoss = +(looseLoss + step.dailyAdditionPct).toFixed(3);
    }

    if (step.isDustSpike) {
      eventTag = 'DUST_SPIKE';
      eventLabel = `High dust/PM10 load (${Math.round(step.pm10Avg)} ug/m3)`;
    } else if (fogHours >= 2 || step.dewGlueHours >= 2) {
      eventTag = 'FOG_DEW';
      eventLabel =
        fogHours >= 2
          ? `Morning fog (${fogHours}h <1.5km) + dew glue`
          : `Nocturnal dew film (${step.dewGlueHours}h)`;
    } else if (step.aodAvg >= 0.65 || step.pm25Avg >= 70) {
      eventTag = 'DRY_HAZE';
      eventLabel = `Atmospheric smog haze (AOD ${step.aodAvg})`;
    } else {
      eventTag = 'CLEAR';
      eventLabel = 'Dry settling';
    }
  }

  const totalParticleLossPct = +Math.min(
    SOILING_THRESHOLDS.maxLossPct,
    Math.max(0, looseLoss + cementedLoss)
  ).toFixed(1);

  return {
    nextState: { looseLoss, cementedLoss, stickyFilmActive, lastClean },
    dailyDelta,
    totalParticleLossPct,
    eventTag,
    eventLabel,
    cleaningEventToPush,
  };
}
