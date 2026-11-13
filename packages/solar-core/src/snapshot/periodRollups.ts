import {
  calculateDiscomBillingCycleYield,
  cleanDayCurveGaps,
  formatINR,
} from '../formatters/solarFormatter.ts';
import {
  calculateNormalizedMonthlyAverage,
  computeDailySolarPhysicsModel,
  formatMinutes12hUpper,
  parseIsoClockMinutes,
} from '../physics/index.ts';
import {
  type IstClockParts,
  formatIstShortLabel,
  parseYmdParts,
  shiftIstFromYmd,
} from '../time/istDate.ts';
import type { SolarIntelligenceReport } from '../types/intelligence.ts';
import type { CanonicalSolarSnapshot, CanonicalSnapshotDayRow } from '../types/snapshot.ts';
import type { HistoryReportDataPoint, LiveSyncLastSyncedDay, RawSeries, SinglePlantSummary } from '../types/telemetry.ts';
import type { SolarWeatherResponse } from '../types/weather.ts';

export function getSeriesNumericValue(
  seriesList: RawSeries[] | null | undefined,
  preferredNames: string[]
): number {
  if (!Array.isArray(seriesList) || seriesList.length === 0) return 0;
  for (const name of preferredNames) {
    const found = seriesList.find((s) => s.variable === name || s.name === name);
    if (found && Array.isArray(found.data) && found.data.length > 0) {
      for (let i = found.data.length - 1; i >= 0; i--) {
        const val = Number(found.data[i]?.value);
        if (Number.isFinite(val) && val > 0) return val;
      }
    }
  }
  return 0;
}

export function computeTrapezoidalCurveWindow(
  seriesList: RawSeries[] | null | undefined,
  acCapacityKw: number,
  sunriseMin: number
): {
  curveKwh: number;
  startMin: number | null;
  endMin: number | null;
  startLabel: string | null;
  endLabel: string | null;
} {
  if (!Array.isArray(seriesList) || seriesList.length === 0) {
    return { curveKwh: 0, startMin: null, endMin: null, startLabel: null, endLabel: null };
  }
  const genSeries =
    seriesList.find((s) => s.variable === 'generationPower') ||
    seriesList.find((s) => s.variable === 'pvPower') ||
    seriesList.find((s) => s.name === 'generationPower');
  if (!genSeries || !Array.isArray(genSeries.data) || genSeries.data.length === 0) {
    return { curveKwh: 0, startMin: null, endMin: null, startLabel: null, endLabel: null };
  }

  const cleaned = cleanDayCurveGaps(
    genSeries.data.map((pt) => ({
      time: String(pt.time || ''),
      value: Math.min(acCapacityKw, Math.max(0, Number(pt.value) || 0)),
    }))
  );

  let energyKwh = 0;
  let startMin: number | null = null;
  let endMin: number | null = null;
  for (let i = 0; i < cleaned.length; i++) {
    const currMin = parseIsoClockMinutes(cleaned[i].time);
    if (currMin !== null && currMin >= Math.max(240, sunriseMin - 45) && (cleaned[i].value > 0.005 || startMin !== null)) {
      if (startMin === null) startMin = currMin;
      endMin = currMin;
    }
    if (i > 0) {
      const prevMin = parseIsoClockMinutes(cleaned[i - 1].time);
      if (prevMin !== null && currMin !== null) {
        const dtMin = currMin - prevMin;
        if (dtMin > 0 && dtMin <= 16) {
          const avgKw = (cleaned[i - 1].value + cleaned[i].value) / 2;
          energyKwh += avgKw * (dtMin / 60);
        }
      }
    }
  }
  return {
    curveKwh: +energyKwh.toFixed(2),
    startMin,
    endMin,
    startLabel: startMin !== null ? formatMinutes12hUpper(startMin) : null,
    endLabel: endMin !== null ? formatMinutes12hUpper(endMin) : null,
  };
}

export function buildYesterdayRollup(params: {
  clock: IstClockParts;
  monthDays: HistoryReportDataPoint[];
  prevMonthDays?: HistoryReportDataPoint[];
  summary?: SinglePlantSummary | null;
  baseTruthIsFromToday: boolean;
  baseTruthYesterdayFinalYieldKwh?: number;
  rep?: SolarIntelligenceReport | null;
  weatherData?: SolarWeatherResponse | null;
  capacityKwp: number;
  lat: number;
  lon: number;
  surfaceLossPct: number;
  aodNow: number;
  fullDayTargetKwh: number;
  physicsOverrides: CanonicalSolarSnapshot['config']['physicsOverrides'];
  tariffPerKwh: number;
  lastSyncedDay?: LiveSyncLastSyncedDay | null;
}): {
  ymdYest: string;
  yestIsConfirmed: boolean;
  yesterday: CanonicalSolarSnapshot['yesterday'];
} {
  const yestClock = shiftIstFromYmd(params.clock.ymd, -1);
  const ymdYest = yestClock.ymd;
  const yestDayNum = yestClock.day;
  const yestMonthNum = yestClock.month;

  const yestFromMonth =
    yestMonthNum === params.clock.month
      ? params.monthDays.find((d) => d.index === yestDayNum)?.value
      : params.prevMonthDays?.find((d) => d.index === yestDayNum)?.value;
  const yestSummaryVal =
    params.baseTruthIsFromToday || params.baseTruthYesterdayFinalYieldKwh !== undefined
      ? Math.max(
          Number(params.summary?.generationYesterday || 0),
          Number(params.baseTruthYesterdayFinalYieldKwh || 0)
        )
      : 0;
  const yestRealKwh = Math.max(Number(yestFromMonth || 0), yestSummaryVal);

  const ledgerYest = params.rep?.dailyLedger?.find((d) => d.ymd === ymdYest);
  const pastDaysContainer = params.weatherData?.pastDays as unknown;
  const pastYest = Array.isArray(pastDaysContainer)
    ? (pastDaysContainer as Array<{ dateYmd?: string; radiationMjM2?: number; maxTemp?: number; sunrise?: string; sunset?: string }>).find(
        (d) => d.dateYmd === ymdYest
      )
    : (pastDaysContainer as Record<string, { dateYmd?: string; radiationMjM2?: number; maxTemp?: number; sunrise?: string; sunset?: string }> | undefined)?.[ymdYest];

  const yestExpectedKwh =
    ledgerYest?.modeledAfterSoilingKwh ??
    (pastYest
      ? computeDailySolarPhysicsModel({
          ymd: ymdYest,
          lat: params.lat,
          lon: params.lon,
          capacityKwp: params.capacityKwp,
          radiationMjM2: pastYest.radiationMjM2 ?? 15,
          ambientTempC: pastYest.maxTemp ?? 28,
          windSpeedKmh: 6,
          surfaceLossPct: params.surfaceLossPct,
          aod: params.aodNow,
          sunriseIso: pastYest.sunrise,
          sunsetIso: pastYest.sunset,
          ...params.physicsOverrides,
        }).targetDailyModelKwh
      : params.fullDayTargetKwh);

  const yestIsConfirmed = yestRealKwh > 0.05 || Boolean(ledgerYest?.isConfirmed);
  const yestDisplayKwh = yestIsConfirmed ? +yestRealKwh.toFixed(1) : +yestExpectedKwh.toFixed(1);
  const yestVsModelPct =
    yestIsConfirmed && yestExpectedKwh > 0 ? Math.round((yestDisplayKwh / yestExpectedKwh) * 100) : null;

  return {
    ymdYest,
    yestIsConfirmed,
    yesterday: {
      ymd: ymdYest,
      shortLabel: yestClock.shortLabel,
      displayKwh: yestDisplayKwh,
      isEstimated: !yestIsConfirmed,
      isConfirmed: yestIsConfirmed,
      savingsInr: +(yestDisplayKwh * params.tariffPerKwh).toFixed(0),
      expectedKwh: +yestExpectedKwh.toFixed(1),
      vsModelPct: yestVsModelPct,
      lastSyncedLabel: params.lastSyncedDay?.shortLabel || null,
      lastSyncedKwh: params.lastSyncedDay?.yieldKwh ? +params.lastSyncedDay.yieldKwh.toFixed(1) : null,
    },
  };
}

export function buildMonthMetricsRollup(params: {
  clock: IstClockParts;
  monthDays: HistoryReportDataPoint[];
  summary?: SinglePlantSummary | null;
  isTodayConfirmed: boolean;
  rawYieldTodayKwh: number;
  commissioningYmd: string;
  commissioningDisplay: string;
  fullDayTargetKwh: number;
  lastSyncedDay?: LiveSyncLastSyncedDay | null;
}) {
  const { clock, monthDays, summary, isTodayConfirmed, rawYieldTodayKwh, commissioningYmd, commissioningDisplay, fullDayTargetKwh, lastSyncedDay } = params;
  const monthDayTodayVal = monthDays.find((d) => d.index === clock.day)?.value ?? 0;
  const monthDaysSum = monthDays.reduce((acc, d) => acc + (Number(d.value) || 0), 0);

  let mtdKwh = Math.max(monthDaysSum, Number(summary?.generationMonth || 0));
  if (isTodayConfirmed && rawYieldTodayKwh > monthDayTodayVal) {
    mtdKwh = Math.max(mtdKwh, +(monthDaysSum - monthDayTodayVal + rawYieldTodayKwh).toFixed(2));
  }
  const resolvedMonthCloudKwh = +mtdKwh.toFixed(2);
  mtdKwh = +resolvedMonthCloudKwh.toFixed(1);

  const commParts = parseYmdParts(commissioningYmd);
  const commDayInThisMonth =
    commParts && commParts.year === clock.year && commParts.month === clock.month ? commParts.day : 1;

  const completedActiveDays = monthDays.filter(
    (d) => d.index >= commDayInThisMonth && d.index < clock.day && Number(d.value) > 0.05
  );
  const activeSyncedDaysCount =
    completedActiveDays.length +
    (isTodayConfirmed && (rawYieldTodayKwh > 0.05 || monthDayTodayVal > 0.05) ? 1 : 0);

  const avgDenomCount =
    completedActiveDays.length > 0 && isTodayConfirmed && rawYieldTodayKwh < 3
      ? completedActiveDays.length
      : activeSyncedDaysCount;
  const completedSumOnly = completedActiveDays.reduce((acc, d) => acc + Number(d.value), 0);
  const avgBasisKwh =
    avgDenomCount === completedActiveDays.length && completedActiveDays.length > 0 ? completedSumOnly : mtdKwh;

  const monthlyAvgRes = calculateNormalizedMonthlyAverage(
    avgBasisKwh,
    clock.year,
    clock.month,
    commissioningYmd,
    avgDenomCount > 0 ? avgDenomCount : undefined
  );
  const dailyAvgKwh = monthlyAvgRes.avgKwhPerDay;

  let bestDayNum: number | null = null;
  let bestDayKwh = 0;
  for (const d of monthDays) {
    const val = Number(d.value) || 0;
    if (d.index <= clock.day && val > bestDayKwh) {
      bestDayKwh = +val.toFixed(1);
      bestDayNum = d.index;
    }
  }
  if (isTodayConfirmed && rawYieldTodayKwh > bestDayKwh) {
    bestDayKwh = +rawYieldTodayKwh.toFixed(1);
    bestDayNum = clock.day;
  }

  let maxSyncedDayIdx = 0;
  for (const d of monthDays) {
    if (d.index <= clock.day && Number(d.value) > 0.05 && d.index > maxSyncedDayIdx) {
      maxSyncedDayIdx = d.index;
    }
  }
  if (isTodayConfirmed && rawYieldTodayKwh > 0.05) {
    maxSyncedDayIdx = clock.day;
  }
  const syncedThroughLabel =
    maxSyncedDayIdx > 0
      ? `${clock.monthShort} ${maxSyncedDayIdx}`
      : lastSyncedDay?.shortLabel || commissioningDisplay;
  const elapsedDaysInMonth = Math.max(1, clock.day - commDayInThisMonth + 1);
  const pendingDaysCount = Math.max(0, elapsedDaysInMonth - activeSyncedDaysCount);
  const bestDayLabel = bestDayNum ? `${clock.monthShort} ${bestDayNum}` : '--';

  const projectedMonthRemainingDays = Math.max(0, clock.daysInMonth - clock.day);
  const projectedKwh = +(
    mtdKwh +
    fullDayTargetKwh * (isTodayConfirmed ? 0.5 : 1) +
    dailyAvgKwh * Math.max(0, projectedMonthRemainingDays - 1)
  ).toFixed(0);

  return {
    monthDayTodayVal,
    monthDaysSum,
    resolvedMonthCloudKwh,
    mtdKwh,
    dailyAvgKwh,
    activeSyncedDaysCount,
    elapsedDaysInMonth,
    pendingDaysCount,
    syncedThroughLabel,
    maxSyncedDayIdx,
    bestDayNum,
    bestDayLabel,
    bestDayKwh,
    projectedKwh,
  };
}

export function buildDiscomAndRoiRollup(params: {
  clock: IstClockParts;
  monthDays: HistoryReportDataPoint[];
  prevMonthDays?: HistoryReportDataPoint[];
  billingCycleDay: number;
  tariffPerKwh: number;
  commissioningYmd: string;
  monthDayTodayVal: number;
  todayCloudKwh: number;
  isTodayConfirmed: boolean;
  dailyAvgKwh: number;
  reconciledBufferByYmd: Record<string, number>;
  systemCost: number;
  confirmedLifetimeKwh: number;
  physicalLifetimeSavingsInr: number;
  capacityKwp: number;
}): {
  discomCycle: CanonicalSolarSnapshot['discomCycle'];
  roi: CanonicalSolarSnapshot['roi'];
} {
  const {
    clock,
    monthDays,
    prevMonthDays,
    billingCycleDay,
    tariffPerKwh,
    commissioningYmd,
    monthDayTodayVal,
    todayCloudKwh,
    isTodayConfirmed,
    dailyAvgKwh,
    reconciledBufferByYmd,
    systemCost,
    confirmedLifetimeKwh,
    physicalLifetimeSavingsInr,
    capacityKwp,
  } = params;

  const todayNotInMonthDaysExtra =
    monthDayTodayVal < 0.05 && todayCloudKwh > 0.05 && isTodayConfirmed ? todayCloudKwh : 0;

  const discomRaw = calculateDiscomBillingCycleYield(
    monthDays.map((d) => ({ day: d.index, yield: Number(d.value) || 0 })),
    billingCycleDay,
    tariffPerKwh,
    {
      prevMonthDays: (prevMonthDays || []).map((d) => ({
        day: d.index,
        yield: Number(d.value) || 0,
      })),
      commissioningYmd,
      todayYmd: clock.ymd,
      todayExtraKwh: todayNotInMonthDaysExtra,
    }
  );
  const discomCycleBillInr = Math.round(discomRaw.cycleUnitsKwh * tariffPerKwh);
  let unloggedCycleRaw = 0;
  for (const [ymdKey, bufVal] of Object.entries(reconciledBufferByYmd)) {
    if (ymdKey >= discomRaw.cycleStartYmd && ymdKey <= clock.ymd) {
      unloggedCycleRaw += bufVal;
    }
  }
  const unloggedCycleKwh = +unloggedCycleRaw.toFixed(2);
  const physicalCycleYieldKwh = +(discomRaw.cycleUnitsKwh + unloggedCycleKwh).toFixed(2);
  const physicalCycleBillInr = Math.round(physicalCycleYieldKwh * tariffPerKwh);
  const dailyCycleAvgKwh =
    discomRaw.daysElapsedInCycle > 0
      ? +(discomRaw.cycleUnitsKwh / discomRaw.daysElapsedInCycle).toFixed(1)
      : dailyAvgKwh;
  const projectedCycleKwh = +(discomRaw.cycleUnitsKwh + dailyCycleAvgKwh * discomRaw.daysRemainingInCycle).toFixed(1);

  const totalSavedInr = Math.round(confirmedLifetimeKwh * tariffPerKwh);
  const paybackPct = systemCost > 0 ? +Math.min(100, (totalSavedInr / systemCost) * 100).toFixed(1) : 0;
  const physicalPaybackPct =
    systemCost > 0 ? +Math.min(100, (physicalLifetimeSavingsInr / systemCost) * 100).toFixed(1) : 0;
  const remainingInr = Math.max(0, systemCost - totalSavedInr);
  const physicalRemainingInr = Math.max(0, systemCost - physicalLifetimeSavingsInr);
  const isPaybackComplete = totalSavedInr >= systemCost;
  const monthlyProjectedInr = Math.round(dailyAvgKwh * clock.daysInMonth * tariffPerKwh);
  const annualProjectedInr = Math.round(dailyAvgKwh * 365 * tariffPerKwh);
  const paybackYearsRemaining =
    annualProjectedInr > 0 && remainingInr > 0
      ? +(remainingInr / annualProjectedInr).toFixed(1)
      : isPaybackComplete
        ? 0
        : null;

  return {
    discomCycle: {
      billingCycleDay: discomRaw.billingCycleDay,
      cyclePeriodText: discomRaw.cyclePeriodText,
      cycleYieldKwh: discomRaw.cycleUnitsKwh,
      unloggedCycleKwh,
      physicalCycleYieldKwh,
      physicalCycleBillInr,
      cycleEstimatedBillInr: discomCycleBillInr,
      cycleBillFormatted: discomRaw.cycleBillSavingsINR,
      cycleStartYmd: discomRaw.cycleStartYmd,
      cycleEndYmd: discomRaw.cycleEndYmd,
      cycleStartLabel: (() => {
        const p = parseYmdParts(discomRaw.cycleStartYmd);
        return p ? formatIstShortLabel(p.day, p.month) : discomRaw.cycleStartYmd;
      })(),
      cycleEndLabel: (() => {
        const p = parseYmdParts(discomRaw.cycleEndYmd);
        return p ? formatIstShortLabel(p.day, p.month) : discomRaw.cycleEndYmd;
      })(),
      cycleTotalDays: discomRaw.cycleTotalDays,
      daysElapsedInCycle: discomRaw.daysElapsedInCycle,
      daysRemainingInCycle: discomRaw.daysRemainingInCycle,
      dailyCycleAvgKwh,
      projectedCycleKwh,
      projectedCycleBillInr: Math.round(projectedCycleKwh * tariffPerKwh),
    },
    roi: {
      systemCost,
      totalSavedInr,
      physicalSavedInr: physicalLifetimeSavingsInr,
      paybackPct,
      physicalPaybackPct,
      remainingInr,
      physicalRemainingInr,
      isPaybackComplete,
      monthlyProjectedInr,
      annualProjectedInr,
      paybackYearsRemaining,
      specificYieldKwhPerKwp: capacityKwp > 0 ? +(confirmedLifetimeKwh / capacityKwp).toFixed(1) : 0,
      specificYieldDailyAvg: capacityKwp > 0 ? +(dailyAvgKwh / capacityKwp).toFixed(2) : 0,
    },
  };
}

export function buildRecent7AndSunScore(params: {
  clock: IstClockParts;
  rep?: SolarIntelligenceReport | null;
  reconciledBufferByYmd: Record<string, number>;
  todayCloudKwh: number;
  todayDisplayKwh: number;
  todayIsEstimated: boolean;
  monthDays: HistoryReportDataPoint[];
  prevMonthDays?: HistoryReportDataPoint[];
  fullDayTargetKwh: number;
  tariffPerKwh: number;
  capacityKwp: number;
}): {
  recent7Daily: CanonicalSnapshotDayRow[];
  sunEfficiencyScore: CanonicalSolarSnapshot['sunEfficiencyScore'];
} {
  const {
    clock,
    rep,
    reconciledBufferByYmd,
    todayCloudKwh,
    todayDisplayKwh,
    todayIsEstimated,
    monthDays,
    prevMonthDays,
    fullDayTargetKwh,
    tariffPerKwh,
    capacityKwp,
  } = params;

  const recent7Daily: CanonicalSnapshotDayRow[] = [];
  if (Array.isArray(rep?.dailyLedger) && rep!.dailyLedger.length > 0) {
    const slice = rep!.dailyLedger.slice(-7);
    for (const row of slice) {
      const buf = reconciledBufferByYmd[row.ymd] ?? 0;
      const cloudPart =
        row.ymd === clock.ymd
          ? todayCloudKwh
          : row.isConfirmed && row.realKwh !== null
            ? row.realKwh
            : 0;
      const kwh = cloudPart > 0 || buf > 0 ? +(cloudPart + buf).toFixed(2) : row.modeledAfterSoilingKwh;
      recent7Daily.push({
        ymd: row.ymd,
        shortLabel: row.shortLabel,
        kwh: +kwh.toFixed(1),
        cloudKwh: +cloudPart.toFixed(2),
        bufferKwh: +buf.toFixed(2),
        isEstimated: (!row.isConfirmed || row.realKwh === null) && buf <= 0,
        modeledKwh: +row.modeledAfterSoilingKwh.toFixed(1),
        savingsInr: Math.round(kwh * tariffPerKwh),
        peakKwEst: kwh > 0 ? +Math.min(capacityKwp, kwh / 5.4).toFixed(2) : 0,
        conditionLabel: row.eventLabel,
      });
    }
  } else {
    for (let offset = 6; offset >= 0; offset--) {
      const targetClock = shiftIstFromYmd(clock.ymd, -offset);
      const mdVal =
        targetClock.month === clock.month
          ? monthDays.find((d) => d.index === targetClock.day)?.value
          : prevMonthDays?.find((d) => d.index === targetClock.day)?.value;
      const isTodayRow = targetClock.ymd === clock.ymd;
      const kwh = isTodayRow
        ? todayDisplayKwh
        : mdVal && mdVal > 0
          ? +mdVal.toFixed(1)
          : +fullDayTargetKwh.toFixed(1);
      const isEst = isTodayRow ? todayIsEstimated : !(mdVal && mdVal > 0);
      recent7Daily.push({
        ymd: targetClock.ymd,
        shortLabel: targetClock.shortLabel,
        kwh,
        isEstimated: isEst,
        modeledKwh: +fullDayTargetKwh.toFixed(1),
        savingsInr: Math.round(kwh * tariffPerKwh),
        peakKwEst: kwh > 0 ? +Math.min(capacityKwp, kwh / 5.4).toFixed(2) : 0,
        conditionLabel: isEst ? 'Modeled' : 'Confirmed',
      });
    }
  }

  let sumRealConfirmed = 0;
  let sumExpectedSynced = 0;
  let syncedDaysEvaluated = 0;
  if (Array.isArray(rep?.dailyLedger)) {
    for (const row of rep!.dailyLedger) {
      if (row.isConfirmed && row.realKwh !== null && row.realKwh > 0.2 && row.weatherCleanKwh > 0.2) {
        sumRealConfirmed += row.realKwh;
        sumExpectedSynced += row.weatherCleanKwh;
        syncedDaysEvaluated++;
      }
    }
  }
  const sunScorePct =
    sumExpectedSynced > 0 ? Math.round((sumRealConfirmed / sumExpectedSynced) * 100) : null;
  const sunScoreGrade =
    sunScorePct === null
      ? 'Awaiting Sync'
      : sunScorePct >= 95
        ? 'Optimal Harvest'
        : sunScorePct >= 82
          ? 'Nominal Tracking'
          : 'Soiling / Derate Watch';

  return {
    recent7Daily,
    sunEfficiencyScore: {
      scorePct: sunScorePct,
      totalRealKwh: +sumRealConfirmed.toFixed(1),
      totalExpectedKwh: +sumExpectedSynced.toFixed(1),
      syncedDaysEvaluated,
      gradeLabel: sunScoreGrade,
      note:
        syncedDaysEvaluated > 0
          ? `Real confirmed harvest across ${syncedDaysEvaluated} synced days vs local weather model`
          : 'Awaiting confirmed synced inverter days to score weather efficiency',
    },
  };
}

export { formatINR };
