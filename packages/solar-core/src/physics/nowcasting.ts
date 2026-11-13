import { getIstClockParts } from '../time/istDate.ts';
import { SOLAR_CONSTANTS } from './constants.ts';
import { parseTelemetryDate } from './truthEvaluator.ts';
import type {
  DailySolarPhysicsModel,
  DailySolarPhysicsPoint,
  HybridTodayStitchResult,
  LiveNowcastResult,
  LiveNowcastSkyMode,
} from '../types/physics.ts';
import { computeFlickerSigmaDeltaK, parseSeriesTimeMinutes, sampleHourlyStateAtMin } from './dailyModel.ts';

export type { HybridTodayStitchResult, LiveNowcastSkyMode, LiveNowcastResult };

/**
 * Today Hybrid Stitch Formula (Mid-Day Wi-Fi Dropout Guard):
 * When Wi-Fi drops mid-day AFTER syncing partial hardware generation earlier today,
 * stitches real confirmed yield + satellite accumulation since last sync minute so Today kWh
 * never drops backward or loses earlier real hardware production.
 */
export function computeHybridTodayStitch(params: {
  isTodayConfirmed: boolean;
  isPreSunrise: boolean;
  isAfterSunset: boolean;
  rawYieldTodayKwh: number;
  lastUpdateInput: string | number | undefined | null;
  truthIsFromToday: boolean;
  todayModel: DailySolarPhysicsModel;
  nowMinutesIst: number;
}): HybridTodayStitchResult {
  const {
    isTodayConfirmed,
    isPreSunrise,
    isAfterSunset,
    rawYieldTodayKwh,
    lastUpdateInput,
    truthIsFromToday,
    todayModel,
    nowMinutesIst,
  } = params;

  const safeYield = Math.max(0, Number.isFinite(rawYieldTodayKwh) ? rawYieldTodayKwh : 0);
  const satCumNow = isPreSunrise
    ? 0
    : isAfterSunset
    ? todayModel.targetDailyModelKwh
    : todayModel.lookupAtMinute(nowMinutesIst).cumKwh;

  if (isTodayConfirmed) {
    return {
      displayKwh: +safeYield.toFixed(1),
      fullDayTargetKwh: Math.max(todayModel.targetDailyModelKwh, +safeYield.toFixed(1)),
      confirmedPartKwh: +safeYield.toFixed(1),
      stitchedSatDeltaKwh: 0,
      isHybridStitched: false,
      lastSyncMinIst: nowMinutesIst,
    };
  }

  if (isPreSunrise) {
    return {
      displayKwh: 0,
      fullDayTargetKwh: todayModel.targetDailyModelKwh,
      confirmedPartKwh: 0,
      stitchedSatDeltaKwh: 0,
      isHybridStitched: false,
      lastSyncMinIst: null,
    };
  }

  if (truthIsFromToday && lastUpdateInput && safeYield > 0) {
    const syncClock = getIstClockParts(parseTelemetryDate(lastUpdateInput));
    const syncMin = syncClock.totalMinutes;
    if (syncMin > todayModel.sunriseMin) {
      const cumAtSync = todayModel.lookupAtMinute(syncMin).cumKwh;
      const effectiveNowMin = Math.max(syncMin, nowMinutesIst);
      const cumAtNow = isAfterSunset
        ? todayModel.targetDailyModelKwh
        : todayModel.lookupAtMinute(effectiveNowMin).cumKwh;
      const deltaSat = Math.max(0, cumAtNow - cumAtSync);
      const remainingSat = Math.max(0, todayModel.targetDailyModelKwh - cumAtSync);
      const displayKwh = +(safeYield + deltaSat).toFixed(1);
      const fullDayTargetKwh = Math.max(displayKwh, +(safeYield + remainingSat).toFixed(1));
      return {
        displayKwh,
        fullDayTargetKwh,
        confirmedPartKwh: +safeYield.toFixed(1),
        stitchedSatDeltaKwh: +deltaSat.toFixed(1),
        isHybridStitched: true,
        lastSyncMinIst: syncMin,
      };
    }
  }

  return {
    displayKwh: +satCumNow.toFixed(1),
    fullDayTargetKwh: todayModel.targetDailyModelKwh,
    confirmedPartKwh: 0,
    stitchedSatDeltaKwh: +satCumNow.toFixed(1),
    isHybridStitched: false,
    lastSyncMinIst: null,
  };
}

/**
 * Variance-Aware Live Sky-Adjusted Nowcasting Blend for Today.
 * Adapts decay half-life between monotonic haze veil (120m), passing clouds (30m), and cloud-edge lensing (25m).
 */
export function computeLiveNowcastingBlend(params: {
  baseModel: DailySolarPhysicsModel;
  rawSeries: Array<{ variable?: string; data?: Array<{ time?: string; value?: number | string }> }> | undefined | null;
  isOnline: boolean;
  isAfterSunset: boolean;
  nowMinutesIst: number;
  acCapacityKw?: number | null;
  hourlyCloudCover?: number[] | null;
}): LiveNowcastResult {
  const { baseModel, rawSeries, isOnline, isAfterSunset, nowMinutesIst, acCapacityKw, hourlyCloudCover } = params;
  const acCap =
    typeof acCapacityKw === 'number' && Number.isFinite(acCapacityKw) && acCapacityKw > 0
      ? acCapacityKw
      : Math.max(SOLAR_CONSTANTS.DEFAULT_AC_CAPACITY_KW, baseModel.peakKw);

  const clampedNow = Math.max(baseModel.sunriseMin, Math.min(baseModel.sunsetMin, nowMinutesIst));
  const nowLookup = baseModel.lookupAtMinute(clampedNow);
  const baseRemainingKwh = +Math.max(0, baseModel.targetDailyModelKwh - nowLookup.cumKwh).toFixed(2);

  const inactive = (): LiveNowcastResult => ({
    active: false,
    ratio: 1.0,
    samplesUsed: 0,
    lastPointMinIst: null,
    horizonMinutes: SOLAR_CONSTANTS.NOWCAST_HORIZON_MIN,
    halfLifeMinutes: 45,
    sigmaDeltaK: 0,
    skyMode: 'clear_nominal',
    skyBadge: null,
    baseRemainingKwh,
    blendedRemainingKwh: baseRemainingKwh,
    blendedFullDayTargetKwh: baseModel.targetDailyModelKwh,
    evaluateFactorAtMinute: () => 1.0,
    buildBlendedRemainingPoints: (fromMinIst = clampedNow) => {
      const startM = Math.max(baseModel.sunriseMin, Math.min(baseModel.sunsetMin, fromMinIst));
      const startVal = baseModel.lookupAtMinute(startM);
      return [
        { minutes: startM, gti: startVal.gti, dcKw: startVal.kw, kw: startVal.kw, etaPct: 93, cumKwh: startVal.cumKwh },
        ...baseModel.points.filter((p) => p.minutes > startM),
      ];
    },
  });

  if (!isOnline || isAfterSunset || clampedNow < baseModel.sunriseMin + 15 || !Array.isArray(rawSeries)) {
    return inactive();
  }

  const series =
    rawSeries.find((s) => s.variable === 'generationPower' && Array.isArray(s.data) && s.data.length > 0) ||
    rawSeries.find((s) => s.variable === 'pvPower' && Array.isArray(s.data) && s.data.length > 0);
  if (!series || !Array.isArray(series.data) || series.data.length < SOLAR_CONSTANTS.NOWCAST_MIN_SAMPLES) {
    return inactive();
  }

  const candidates: Array<{ min: number; realKw: number; modKw: number; ratio: number }> = [];
  for (const pt of series.data) {
    const min = parseSeriesTimeMinutes(pt.time);
    if (min === null) continue;
    if (min < nowMinutesIst - SOLAR_CONSTANTS.NOWCAST_WINDOW_MIN || min > nowMinutesIst + 5) continue;
    const realKw = Math.max(0, Number(pt.value) || 0);
    const modKw = baseModel.lookupAtMinute(min).kw;
    if (modKw < 0.18) continue;
    const ratio = Math.min(1.45, Math.max(0.35, realKw / modKw));
    candidates.push({ min, realKw, modKw, ratio });
  }

  candidates.sort((a, b) => a.min - b.min);
  const recent = candidates.slice(-7);
  if (recent.length < SOLAR_CONSTANTS.NOWCAST_MIN_SAMPLES) return inactive();

  const lastPointMinIst = recent[recent.length - 1].min;
  if (nowMinutesIst - lastPointMinIst > 30) return inactive();

  let weightSum = 0;
  let ratioSum = 0;
  for (let i = 0; i < recent.length; i++) {
    const w = 1 + i * 0.45;
    weightSum += w;
    ratioSum += recent[i].ratio * w;
  }
  const weightedRatio = weightSum > 0 ? ratioSum / weightSum : 1.0;
  const ratio = +Math.min(
    SOLAR_CONSTANTS.NOWCAST_RATIO_MAX,
    Math.max(SOLAR_CONSTANTS.NOWCAST_RATIO_MIN, weightedRatio)
  ).toFixed(3);

  const sigmaDeltaK = computeFlickerSigmaDeltaK(recent);
  const spanMin = recent[recent.length - 1].min - recent[0].min;
  const nowCloudPct = Array.isArray(hourlyCloudCover)
    ? sampleHourlyStateAtMin(hourlyCloudCover, lastPointMinIst, 0)
    : 0;
  const allBelow = recent.slice(-3).every((r) => r.ratio <= 0.96);
  const allAbove = recent.slice(-3).every((r) => r.ratio >= 1.04);
  const consistentDeviation = allBelow || allAbove || Math.abs(ratio - 1) >= 0.05 || sigmaDeltaK >= SOLAR_CONSTANTS.NOWCAST_FLICKER_CLOUD_SIGMA;
  if (!consistentDeviation || (Math.abs(ratio - 1) < 0.035 && sigmaDeltaK < SOLAR_CONSTANTS.NOWCAST_FLICKER_CLOUD_SIGMA)) {
    return inactive();
  }

  let skyMode: LiveNowcastSkyMode = ratio < 0.95 ? 'mild_attenuation' : 'clear_nominal';
  let halfLifeMinutes = 45;
  let tau: number = SOLAR_CONSTANTS.NOWCAST_DECAY_TAU_MIN;
  let horizon: number = SOLAR_CONSTANTS.NOWCAST_HORIZON_MIN;
  let skyBadge: string | null = null;

  const isMonotonicHazeVeil =
    recent.length >= 4 &&
    spanMin >= 14 &&
    sigmaDeltaK < SOLAR_CONSTANTS.NOWCAST_SMOOTH_HAZE_SIGMA &&
    ratio < 0.90 &&
    recent.every((r) => r.ratio < 0.97);

  if (ratio >= SOLAR_CONSTANTS.CLOUD_LENSING_RATIO_THRESHOLD && (sigmaDeltaK >= 0.04 || nowCloudPct >= 15 || ratio >= 1.14)) {
    skyMode = 'cloud_lensing';
    halfLifeMinutes = 25;
    tau = 36;
    horizon = 60;
    const boostPct = Math.round((ratio - 1) * 100);
    skyBadge = `⚡ Cloud-Edge Lensing (+${boostPct}%)`;
  } else if (isMonotonicHazeVeil) {
    skyMode = 'haze_veil';
    halfLifeMinutes = 120;
    tau = SOLAR_CONSTANTS.NOWCAST_HAZE_TAU_MIN;
    horizon = Math.max(180, Math.round(baseModel.sunsetMin - clampedNow));
    const dropPct = Math.round((1 - ratio) * 100);
    skyBadge = `🌫️ Unforecasted Local Haze/Veil (-${dropPct}%)`;
  } else if (sigmaDeltaK >= SOLAR_CONSTANTS.NOWCAST_FLICKER_CLOUD_SIGMA) {
    skyMode = 'passing_clouds';
    halfLifeMinutes = 30;
    tau = SOLAR_CONSTANTS.NOWCAST_CLOUD_TAU_MIN;
    horizon = 90;
    skyBadge = `⛅ Sub-Grid Passing Clouds`;
  } else if (ratio < 0.92) {
    const dropPct = Math.round((1 - ratio) * 100);
    skyBadge = `Haze / Attenuation (-${dropPct}%)`;
  } else if (ratio >= 1.05) {
    skyBadge = `Strong Sky (+${Math.round((ratio - 1) * 100)}%)`;
  }

  const tailFloor = Math.exp(-horizon / tau);
  const anchorMin = Math.min(clampedNow, lastPointMinIst);

  const evaluateFactorAtMinute = (targetMin: number): number => {
    const dt = targetMin - anchorMin;
    if (dt < 0 || dt >= horizon) return 1.0;
    const weight = Math.max(0, (Math.exp(-dt / tau) - tailFloor) / Math.max(0.01, 1 - tailFloor));
    return +(1 + (ratio - 1) * weight).toFixed(4);
  };

  const buildBlendedRemainingPoints = (fromMinIst = clampedNow): DailySolarPhysicsPoint[] => {
    const startM = Math.max(baseModel.sunriseMin, Math.min(baseModel.sunsetMin, fromMinIst));
    const startBase = baseModel.lookupAtMinute(startM);
    const startFactor = evaluateFactorAtMinute(startM);
    const startKw = +Math.min(acCap, Math.max(0, startBase.kw * startFactor)).toFixed(2);
    const out: DailySolarPhysicsPoint[] = [
      {
        minutes: startM,
        gti: startBase.gti,
        dcKw: startBase.kw,
        kw: startKw,
        etaPct: 93,
        cumKwh: startBase.cumKwh,
      },
    ];
    let runCum = startBase.cumKwh;
    for (const pt of baseModel.points) {
      if (pt.minutes <= startM) continue;
      const factor = evaluateFactorAtMinute(pt.minutes);
      const adjKw = +Math.min(acCap, Math.max(0, pt.kw * factor)).toFixed(2);
      const prev = out[out.length - 1];
      const dtH = (pt.minutes - prev.minutes) / 60;
      runCum += ((prev.kw + adjKw) / 2) * dtH;
      out.push({
        ...pt,
        kw: adjKw,
        cumKwh: +runCum.toFixed(2),
      });
    }
    return out;
  };

  const futurePts = buildBlendedRemainingPoints(clampedNow);
  const blendedRemainingKwh = +Math.max(
    0,
    (futurePts[futurePts.length - 1]?.cumKwh ?? nowLookup.cumKwh) - nowLookup.cumKwh
  ).toFixed(2);
  const blendedFullDayTargetKwh = +(nowLookup.cumKwh + blendedRemainingKwh).toFixed(1);

  return {
    active: true,
    ratio,
    samplesUsed: recent.length,
    lastPointMinIst: Math.round(lastPointMinIst),
    horizonMinutes: horizon,
    halfLifeMinutes,
    sigmaDeltaK,
    skyMode,
    skyBadge,
    baseRemainingKwh,
    blendedRemainingKwh,
    blendedFullDayTargetKwh,
    evaluateFactorAtMinute,
    buildBlendedRemainingPoints,
  };
}
