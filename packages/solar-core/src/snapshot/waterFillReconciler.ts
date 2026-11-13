import { formatINR } from '../formatters/solarFormatter.ts';
import { computeEnvironmentEquivalents } from '../physics/index.ts';
import type { IstClockParts } from '../time/istDate.ts';
import type { DayGapClassificationResult } from '../types/gap.ts';
import type { SolarIntelligenceReport } from '../types/intelligence.ts';
import type { EnvironmentEquivalents } from '../types/physics.ts';
import type { SinglePlantSummary } from '../types/telemetry.ts';

export interface WaterFillReconciliationParams {
  clock: IstClockParts;
  ymdYest: string;
  yestIsConfirmed: boolean;
  isTodayConfirmed: boolean;
  todayBufferKwh: number;
  todayCloudKwh: number;
  todayGapClassification: DayGapClassificationResult | null;
  rep: SolarIntelligenceReport | null | undefined;
  summary: SinglePlantSummary | null | undefined;
  monthDaysSum: number;
  resolvedMonthCloudKwh: number;
  mtdKwh: number;
  tariffPerKwh: number;
  co2FactorKgPerKwh: number;
  manualGridOffSet: Set<string>;
  physicalEmonthKwh: number | null;
  physicalEmonthCloudRefKwh: number | null;
  physicalEmonthYm: string | null;
  physicalEmonthSetAtYmd: string | null;
  physicalEmonthSetAtMin: number | null;
  physicalEtotalKwh: number | null;
  physicalEtotalCloudRefKwh: number | null;
  physicalEtotalSetAtYmd: string | null;
  physicalEtotalSetAtMin: number | null;
}

export interface WaterFillReconciliationResult {
  reconciledBufferByYmd: Record<string, number>;
  effectiveTodayBufferKwh: number;
  effectiveTodayDisplayKwh: number;
  unloggedMonthKwh: number;
  physicalMonthTotalKwh: number;
  physicalMonthSavingsInr: number;
  physicalMonthSavingsFormatted: string;
  isEmonthAnchored: boolean;
  effMonthSource: 'waaree-api' | 'manual' | null;
  effMonthKwh: number | null;
  eMonthAnchorDeltaKwh: number;
  effMonthSetAtYmd: string | null;
  effMonthSyncedLabel: string | null;
  confirmedLifetimeCloudKwh: number;
  confirmedLifetimeKwh: number;
  unloggedLifetimeKwh: number;
  physicalLifetimeKwh: number;
  physicalLifetimeSavingsInr: number;
  physicalLifetimeSavingsFormatted: string;
  isEtotalAnchored: boolean;
  effTotalSource: 'waaree-api' | 'manual' | null;
  effTotalKwh: number | null;
  eTotalAnchorDeltaKwh: number;
  effTotalSetAtYmd: string | null;
  effTotalSyncedLabel: string | null;
  lifetimeEnv: EnvironmentEquivalents;
  lifetimePhysicalEnv: EnvironmentEquivalents;
  monthEnv: EnvironmentEquivalents;
}

/**
 * Reconciles unlogged Wi-Fi outage pockets against dual EMonth and ETotal hardware register
 * anchors (Waaree Cloud `hardwareMonthKwh` / `hardwareTotalKwh` or manual LCD override)
 * without double-counting holes occurring strictly before vs. after the anchor timestamp.
 */
export function reconcileWaterFillBuffers(
  params: WaterFillReconciliationParams
): WaterFillReconciliationResult {
  const {
    clock,
    ymdYest,
    yestIsConfirmed,
    isTodayConfirmed,
    todayBufferKwh,
    todayCloudKwh,
    todayGapClassification,
    rep,
    summary,
    monthDaysSum,
    resolvedMonthCloudKwh,
    mtdKwh,
    tariffPerKwh,
    co2FactorKgPerKwh,
    manualGridOffSet,
    physicalEmonthKwh,
    physicalEmonthCloudRefKwh,
    physicalEmonthYm,
    physicalEmonthSetAtYmd,
    physicalEmonthSetAtMin,
    physicalEtotalKwh,
    physicalEtotalCloudRefKwh,
    physicalEtotalSetAtYmd,
    physicalEtotalSetAtMin,
  } = params;

  const monthCloudLagDelta = Math.max(0, resolvedMonthCloudKwh - (Number(summary?.generationMonth) || monthDaysSum));
  const baseLifetimeTotal = Number(summary?.generationTotal || 0);
  const confirmedLifetimeCloudKwh = +Math.max(
    baseLifetimeTotal + (baseLifetimeTotal > 0 ? monthCloudLagDelta : 0),
    resolvedMonthCloudKwh
  ).toFixed(2);
  const confirmedLifetimeKwh = +confirmedLifetimeCloudKwh.toFixed(1);

  const apiMonthKwh =
    Number.isFinite(Number(summary?.hardwareMonthKwh)) && Number(summary?.hardwareMonthKwh) > 0
      ? +Number(summary?.hardwareMonthKwh).toFixed(2)
      : null;
  const apiTotalKwh =
    Number.isFinite(Number(summary?.hardwareTotalKwh)) && Number(summary?.hardwareTotalKwh) > 0
      ? +Number(summary?.hardwareTotalKwh).toFixed(2)
      : null;
  const apiSyncedYmd =
    typeof summary?.hardwareSyncedYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(summary.hardwareSyncedYmd)
      ? summary.hardwareSyncedYmd
      : null;
  const apiSyncedMin = Number.isFinite(Number(summary?.hardwareSyncedMin))
    ? Math.max(0, Math.min(1440, Math.round(Number(summary?.hardwareSyncedMin))))
    : null;
  const apiSyncedLabel =
    typeof summary?.hardwareSyncedLabel === 'string' && summary.hardwareSyncedLabel.trim()
      ? summary.hardwareSyncedLabel.trim()
      : null;

  const getRawRowBufferKwh = (row: NonNullable<SolarIntelligenceReport['dailyLedger']>[number]): number => {
    if (manualGridOffSet.has(row.ymd)) return 0;
    if (row.ymd === clock.ymd) return todayBufferKwh;
    if (row.ymd > clock.ymd) return 0;
    if (row.ymd === ymdYest && yestIsConfirmed && (!row.isConfirmed || row.dipCategory === 'WIFI_OUTAGE_UNLOGGED')) {
      return 0;
    }
    if (typeof row.bufferKwh === 'number' && row.bufferKwh >= 0) {
      return row.bufferKwh;
    }
    if (typeof row.unloggedEstimatedKwh === 'number' && row.unloggedEstimatedKwh > 0) {
      return row.unloggedEstimatedKwh;
    }
    if (!row.isConfirmed && row.dipCategory === 'WIFI_OUTAGE_UNLOGGED') {
      return Math.max(0, row.modeledAfterSoilingKwh);
    }
    return 0;
  };

  const rawBufferByYmd: Record<string, number> = {};
  for (const row of rep?.dailyLedger || []) {
    if (row.ymd > clock.ymd) continue;
    const rawU = getRawRowBufferKwh(row);
    if (rawU > 0) rawBufferByYmd[row.ymd] = +rawU.toFixed(2);
  }
  if (todayBufferKwh > 0) {
    rawBufferByYmd[clock.ymd] = +todayBufferKwh.toFixed(2);
  }

  const manualMonthValid = Boolean(
    physicalEmonthKwh !== null &&
      physicalEmonthKwh > 0 &&
      (!physicalEmonthYm || physicalEmonthYm === clock.ym)
  );
  const preferManualMonth = Boolean(
    manualMonthValid &&
      (apiMonthKwh === null ||
        (physicalEmonthSetAtYmd && apiSyncedYmd && physicalEmonthSetAtYmd > apiSyncedYmd) ||
        ((!apiSyncedYmd || physicalEmonthSetAtYmd === apiSyncedYmd) &&
          (physicalEmonthKwh as number) > (apiMonthKwh as number) + 0.05))
  );
  const effMonthSource: 'waaree-api' | 'manual' | null = preferManualMonth
    ? 'manual'
    : apiMonthKwh !== null
      ? 'waaree-api'
      : null;
  const effMonthKwh =
    effMonthSource === 'manual' ? physicalEmonthKwh : effMonthSource === 'waaree-api' ? apiMonthKwh : null;
  const effMonthSetAtYmd =
    effMonthSource === 'manual'
      ? physicalEmonthSetAtYmd
      : effMonthSource === 'waaree-api'
        ? apiSyncedYmd || (isTodayConfirmed ? clock.ymd : null)
        : null;
  const effMonthSetAtMin =
    effMonthSource === 'manual'
      ? physicalEmonthSetAtMin
      : effMonthSource === 'waaree-api'
        ? apiSyncedMin
        : null;
  const effMonthSyncedLabel = effMonthSource === 'waaree-api' ? apiSyncedLabel : effMonthSetAtYmd;
  const isEmonthAnchored = effMonthSource !== null && effMonthKwh !== null && effMonthKwh > 0;
  const effMonthCloudRef = isEmonthAnchored
    ? effMonthSource === 'manual' && physicalEmonthCloudRefKwh !== null
      ? physicalEmonthCloudRefKwh
      : resolvedMonthCloudKwh
    : 0;
  const eMonthAnchorDeltaKwh = isEmonthAnchored
    ? +Math.max(0, (effMonthKwh as number) - effMonthCloudRef).toFixed(2)
    : 0;

  // Split month holes around (effMonthSetAtYmd, effMonthSetAtMin) so pre-anchor vs post-anchor never double count
  const reconciledBufferByYmd: Record<string, number> = { ...rawBufferByYmd };
  let preAnchorMonthEstSum = 0;
  let postAnchorMonthEstSum = 0;
  const preAnchorMonthSplits: Record<string, number> = {};
  const postAnchorMonthSplits: Record<string, number> = {};

  for (const [ymdKey, rawU] of Object.entries(rawBufferByYmd)) {
    if (!ymdKey.startsWith(`${clock.ym}-`)) continue;
    if (!isEmonthAnchored || !effMonthSetAtYmd) {
      preAnchorMonthSplits[ymdKey] = rawU;
      preAnchorMonthEstSum += rawU;
      continue;
    }
    if (ymdKey < effMonthSetAtYmd) {
      preAnchorMonthSplits[ymdKey] = rawU;
      preAnchorMonthEstSum += rawU;
    } else if (ymdKey > effMonthSetAtYmd) {
      postAnchorMonthSplits[ymdKey] = rawU;
      postAnchorMonthEstSum += rawU;
    } else {
      const row = rep?.dailyLedger?.find((d) => d.ymd === ymdKey);
      const holes =
        ymdKey === clock.ymd && todayGapClassification
          ? todayGapClassification.holes
          : row?.gapHoles || [];
      if (holes.length > 0 && effMonthSetAtMin !== null) {
        let prePart = 0;
        let postPart = 0;
        for (const h of holes) {
          if (h.kind === 'BUFFER_ESTIMATED' && h.allocatedKwh > 0) {
            if (h.endMin <= effMonthSetAtMin + 5) prePart += h.allocatedKwh;
            else postPart += h.allocatedKwh;
          }
        }
        const splitSum = prePart + postPart;
        if (splitSum > 0.05) {
          const preScaled = +(rawU * (prePart / splitSum)).toFixed(2);
          const postScaled = +Math.max(0, rawU - preScaled).toFixed(2);
          if (preScaled > 0) preAnchorMonthSplits[ymdKey] = preScaled;
          if (postScaled > 0) postAnchorMonthSplits[ymdKey] = postScaled;
          preAnchorMonthEstSum += preScaled;
          postAnchorMonthEstSum += postScaled;
          continue;
        }
      }
      preAnchorMonthSplits[ymdKey] = rawU;
      preAnchorMonthEstSum += rawU;
    }
  }

  if (isEmonthAnchored && preAnchorMonthEstSum > 0.2) {
    const rawLambda = eMonthAnchorDeltaKwh / preAnchorMonthEstSum;
    const waterLambda = Math.max(0.8, Math.min(1.2, rawLambda));
    const effectiveLambda = rawLambda >= 0.5 && rawLambda <= 1.5 ? rawLambda : waterLambda;
    for (const [ymdKey, preVal] of Object.entries(preAnchorMonthSplits)) {
      const postVal = postAnchorMonthSplits[ymdKey] || 0;
      reconciledBufferByYmd[ymdKey] = +(preVal * effectiveLambda + postVal).toFixed(2);
    }
  }

  const manualTotalValid = Boolean(physicalEtotalKwh !== null && physicalEtotalKwh > 0);
  const preferManualTotal = Boolean(
    manualTotalValid &&
      (apiTotalKwh === null ||
        (physicalEtotalSetAtYmd && apiSyncedYmd && physicalEtotalSetAtYmd > apiSyncedYmd) ||
        ((!apiSyncedYmd || physicalEtotalSetAtYmd === apiSyncedYmd) &&
          (physicalEtotalKwh as number) > (apiTotalKwh as number) + 0.05))
  );
  const effTotalSource: 'waaree-api' | 'manual' | null = preferManualTotal
    ? 'manual'
    : apiTotalKwh !== null
      ? 'waaree-api'
      : null;
  const effTotalKwh =
    effTotalSource === 'manual' ? physicalEtotalKwh : effTotalSource === 'waaree-api' ? apiTotalKwh : null;
  const effTotalSetAtYmd =
    effTotalSource === 'manual'
      ? physicalEtotalSetAtYmd
      : effTotalSource === 'waaree-api'
        ? apiSyncedYmd || (isTodayConfirmed ? clock.ymd : null)
        : null;
  const effTotalSetAtMin =
    effTotalSource === 'manual'
      ? physicalEtotalSetAtMin
      : effTotalSource === 'waaree-api'
        ? apiSyncedMin
        : null;
  const effTotalSyncedLabel = effTotalSource === 'waaree-api' ? apiSyncedLabel : effTotalSetAtYmd;

  let reconciledMonthBufSum = 0;
  let priorMonthsBufSum = 0;
  let postEtotalAnchorUnlogged = 0;
  for (const [ymdKey, val] of Object.entries(reconciledBufferByYmd)) {
    if (ymdKey.startsWith(`${clock.ym}-`)) {
      reconciledMonthBufSum += val;
    } else {
      priorMonthsBufSum += val;
    }
    if (effTotalSetAtYmd) {
      if (ymdKey > effTotalSetAtYmd) {
        postEtotalAnchorUnlogged += val;
      } else if (ymdKey === effTotalSetAtYmd && effTotalSetAtMin !== null) {
        const row = rep?.dailyLedger?.find((d) => d.ymd === ymdKey);
        const holes =
          ymdKey === clock.ymd && todayGapClassification
            ? todayGapClassification.holes
            : row?.gapHoles || [];
        for (const h of holes) {
          if (h.kind === 'BUFFER_ESTIMATED' && h.allocatedKwh > 0 && h.endMin > effTotalSetAtMin + 5) {
            postEtotalAnchorUnlogged += h.allocatedKwh;
          }
        }
      }
    }
  }

  const effectiveTodayBufferKwh = +(reconciledBufferByYmd[clock.ymd] ?? todayBufferKwh).toFixed(2);
  const effectiveTodayDisplayKwh = +(todayCloudKwh + effectiveTodayBufferKwh).toFixed(2);

  const unloggedMonthKwh = isEmonthAnchored
    ? +(eMonthAnchorDeltaKwh + postAnchorMonthEstSum).toFixed(2)
    : +reconciledMonthBufSum.toFixed(2);
  const physicalMonthTotalKwh = +(resolvedMonthCloudKwh + unloggedMonthKwh).toFixed(2);
  const physicalMonthSavingsInr = Math.round(physicalMonthTotalKwh * tariffPerKwh);

  const isEtotalAnchored = effTotalSource !== null && effTotalKwh !== null && effTotalKwh > 0;
  const effectiveCloudRef = isEtotalAnchored
    ? effTotalSource === 'manual' && physicalEtotalCloudRefKwh !== null
      ? physicalEtotalCloudRefKwh
      : confirmedLifetimeCloudKwh
    : 0;
  const eTotalAnchorDeltaKwh = isEtotalAnchored
    ? +Math.max(0, (effTotalKwh as number) - effectiveCloudRef).toFixed(2)
    : 0;
  const unloggedLifetimeKwh = isEtotalAnchored
    ? +(eTotalAnchorDeltaKwh + postEtotalAnchorUnlogged).toFixed(2)
    : +(unloggedMonthKwh + priorMonthsBufSum).toFixed(2);
  const physicalLifetimeKwh = +(confirmedLifetimeCloudKwh + unloggedLifetimeKwh).toFixed(2);
  const physicalLifetimeSavingsInr = Math.round(physicalLifetimeKwh * tariffPerKwh);

  return {
    reconciledBufferByYmd,
    effectiveTodayBufferKwh,
    effectiveTodayDisplayKwh,
    unloggedMonthKwh,
    physicalMonthTotalKwh,
    physicalMonthSavingsInr,
    physicalMonthSavingsFormatted: formatINR(physicalMonthSavingsInr),
    isEmonthAnchored,
    effMonthSource,
    effMonthKwh,
    eMonthAnchorDeltaKwh,
    effMonthSetAtYmd,
    effMonthSyncedLabel,
    confirmedLifetimeCloudKwh,
    confirmedLifetimeKwh,
    unloggedLifetimeKwh,
    physicalLifetimeKwh,
    physicalLifetimeSavingsInr,
    physicalLifetimeSavingsFormatted: formatINR(physicalLifetimeSavingsInr),
    isEtotalAnchored,
    effTotalSource,
    effTotalKwh,
    eTotalAnchorDeltaKwh,
    effTotalSetAtYmd,
    effTotalSyncedLabel,
    lifetimeEnv: computeEnvironmentEquivalents(confirmedLifetimeKwh, co2FactorKgPerKwh),
    lifetimePhysicalEnv: computeEnvironmentEquivalents(physicalLifetimeKwh, co2FactorKgPerKwh),
    monthEnv: computeEnvironmentEquivalents(mtdKwh, co2FactorKgPerKwh),
  };
}
