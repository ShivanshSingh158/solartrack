import { SOLAR_CONSTANTS } from './constants.ts';
import { formatMinutes12hUpper } from './astronomy.ts';
import { computeFlickerSigmaDeltaK, parseSeriesTimeMinutes, sampleHourlyStateAtMin } from './dailyModel.ts';
import type {
  DailySolarPhysicsModel,
  DaySkyAnomalyReport,
  SkyAnomalyPeakLensing,
  UnforecastedSkyEvent,
} from '../types/physics.ts';

export type { SkyAnomalyPeakLensing, UnforecastedSkyEvent, DaySkyAnomalyReport };

/**
 * Shared classifier for historical & today 5-min telemetry anomalies:
 * 1) Cloud-Edge Lensing peaks (K_sky > 1.08 during broken cumulus / high flicker)
 * 2) Unforecasted Local Haze/Veil vs Sub-Grid Passing Clouds (clear Open-Meteo <15% cloud yet >=20% sustained attenuation)
 */
export function detectSkyAnomalyEvents(params: {
  rawSeries: Array<{ variable?: string; data?: Array<{ time?: string; value?: number | string }> }> | undefined | null;
  baseModel: DailySolarPhysicsModel;
  hourlyCloudCover?: number[] | null;
  dayCloudAvgPct?: number | null;
}): DaySkyAnomalyReport {
  const { rawSeries, baseModel, hourlyCloudCover, dayCloudAvgPct } = params;
  const empty: DaySkyAnomalyReport = {
    hasCloudLensing: false,
    peakLensing: null,
    lensingMinutes: [],
    unforecastedEvent: null,
    isLensingAtMinute: () => null,
  };
  if (!Array.isArray(rawSeries) || rawSeries.length === 0) return empty;

  const series =
    rawSeries.find((s) => s.variable === 'generationPower' && Array.isArray(s.data) && s.data.length > 0) ||
    rawSeries.find((s) => s.variable === 'pvPower' && Array.isArray(s.data) && s.data.length > 0);
  if (!series || !Array.isArray(series.data) || series.data.length < 3) return empty;

  const matched: Array<{
    min: number;
    realKw: number;
    modKw: number;
    ratio: number;
    cloudPct: number;
  }> = [];

  for (const pt of series.data) {
    const min = parseSeriesTimeMinutes(pt.time);
    if (min === null || min < baseModel.sunriseMin + 20 || min > baseModel.sunsetMin - 20) continue;
    const realKw = Math.max(0, Number(pt.value) || 0);
    const modKw = baseModel.lookupAtMinute(min).kw;
    if (modKw < 0.25) continue;
    const ratio = realKw / modKw;
    const cloudPct = Array.isArray(hourlyCloudCover) && hourlyCloudCover.length >= 12
      ? sampleHourlyStateAtMin(hourlyCloudCover, min, dayCloudAvgPct ?? 0)
      : Number(dayCloudAvgPct ?? 0);
    matched.push({ min, realKw, modKw, ratio, cloudPct });
  }

  matched.sort((a, b) => a.min - b.min);
  if (matched.length < 3) return empty;

  const lensingEvents: SkyAnomalyPeakLensing[] = [];
  for (let i = 0; i < matched.length; i++) {
    const cur = matched[i];
    if (cur.modKw < 0.75 || cur.realKw < 1.5) continue;
    if (cur.ratio < SOLAR_CONSTANTS.CLOUD_LENSING_RATIO_THRESHOLD) continue;
    const winStart = Math.max(0, i - 2);
    const winEnd = Math.min(matched.length, i + 3);
    const localSigma = computeFlickerSigmaDeltaK(matched.slice(winStart, winEnd));
    const hasCloudContext =
      cur.cloudPct >= 15 ||
      Number(dayCloudAvgPct ?? 0) >= 15 ||
      (localSigma >= 0.08 && cur.ratio >= 1.15);
    if (!hasCloudContext) continue;
    const boostPct = Math.round((cur.ratio - 1) * 100);
    lensingEvents.push({
      minutes: Math.round(cur.min),
      timeText: formatMinutes12hUpper(cur.min),
      realKw: +cur.realKw.toFixed(2),
      modelKw: +cur.modKw.toFixed(2),
      boostPct,
      ratio: +cur.ratio.toFixed(2),
      badge: `⚡ Cloud-Edge Lensing (+${boostPct}% cumulus reflection boost)`,
    });
  }

  const peakLensing =
    lensingEvents.length > 0
      ? lensingEvents.reduce((best, item) =>
          item.realKw - item.modelKw > best.realKw - best.modelKw ? item : best
        )
      : null;

  let bestRun: typeof matched = [];
  let curRun: typeof matched = [];
  for (let i = 0; i < matched.length; i++) {
    const pt = matched[i];
    const isUnforecastedDrop =
      pt.cloudPct < 15 && pt.modKw >= 0.25 && pt.realKw > 0.03 && pt.ratio >= 0.08 && pt.ratio < 0.80;
    const prev = curRun[curRun.length - 1];
    if (isUnforecastedDrop && (!prev || pt.min - prev.min <= 16)) {
      curRun.push(pt);
    } else {
      if (curRun.length > bestRun.length) bestRun = curRun;
      curRun = isUnforecastedDrop ? [pt] : [];
    }
  }
  if (curRun.length > bestRun.length) bestRun = curRun;

  let unforecastedEvent: UnforecastedSkyEvent | null = null;
  if (bestRun.length >= 4 && bestRun[bestRun.length - 1].min - bestRun[0].min >= 20) {
    const runSigma = computeFlickerSigmaDeltaK(bestRun);
    const avgRatio = bestRun.reduce((s, p) => s + p.ratio, 0) / bestRun.length;
    const avgDropPct = Math.max(10, Math.round((1 - avgRatio) * 100));
    const startMin = Math.round(bestRun[0].min);
    const endMin = Math.round(bestRun[bestRun.length - 1].min);
    const startTimeText = formatMinutes12hUpper(startMin);
    if (runSigma < 0.035) {
      unforecastedEvent = {
        kind: 'unforecasted_haze_veil',
        startMin,
        endMin,
        startTimeText,
        avgDropPct,
        sigmaDeltaK: runSigma,
        badge: `🌫️ Unforecasted Local Haze/Veil (-${avgDropPct}% from ${startTimeText})`,
        reasonLabel: `Smooth unforecasted local haze/veil from ${startTimeText} (~-${avgDropPct}%, missed by satellite/NWP)`,
      };
    } else {
      unforecastedEvent = {
        kind: 'unforecasted_clouds',
        startMin,
        endMin,
        startTimeText,
        avgDropPct,
        sigmaDeltaK: runSigma,
        badge: `⛅ Unforecasted Sub-Grid Clouds (-${avgDropPct}% from ${startTimeText})`,
        reasonLabel: `Unforecasted sub-grid passing clouds from ${startTimeText} (~-${avgDropPct}%)`,
      };
    }
  }

  return {
    hasCloudLensing: peakLensing !== null,
    peakLensing,
    lensingMinutes: lensingEvents.map((e) => e.minutes),
    unforecastedEvent,
    isLensingAtMinute: (minute: number, toleranceMin = 7) =>
      lensingEvents.find((e) => Math.abs(e.minutes - minute) <= toleranceMin) || null,
  };
}
