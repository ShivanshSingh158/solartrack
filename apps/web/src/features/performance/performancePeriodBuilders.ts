import {
  daysInIstMonth,
  formatIndianDate,
  formatWeekdayShort,
  shiftYmdDays,
  type CanonicalSolarSnapshot,
  type DailyPerformanceLedgerEntry,
  type DayComparisonCalendarDay,
  type DayComparisonResponse,
  type DipAttributionCategory,
  type IstClockParts,
  type LiveSyncLastSyncedDay,
  type RawSeries,
  type SolarIntelligenceReport,
  type SolarWeatherResponse,
} from '@solar-track/core';
import type { PerformanceBulletBarItem, PerformanceYearMonthItem } from './performanceStageTypes';
import type { WeekSparkDayItem } from './WeeklyEnvelopeStrip';

export function hasNonEmptyRaw(series?: RawSeries[] | null): boolean {
  return Array.isArray(series) && series.some((s) => Array.isArray(s?.data) && s.data.length > 0);
}

export function synthesizeRawFromCombined(
  pts: Array<{ time: string; value: number; isInterpolated?: boolean }>,
): RawSeries[] {
  if (!Array.isArray(pts) || pts.length === 0) return [];
  return [
    {
      variable: 'generationPower',
      data: pts.map((p) => ({ time: p.time, value: p.value })),
    },
  ];
}

export function buildWeekBulletBars(params: {
  weekDates: string[];
  ledgerByYmd: Map<string, DailyPerformanceLedgerEntry>;
  currentMonthDaysData: Array<{ day: number; yield: number }>;
  monthlyDaysData: Array<{ day: number; yield: number }>;
  istYm: string;
  selectedMonth: string;
  monthAvailabilityByYm: Record<string, DayComparisonCalendarDay[]>;
  todayYmd: string;
  canonicalSnapshot: CanonicalSolarSnapshot;
  manualGridOffSet: Set<string>;
}): PerformanceBulletBarItem[] {
  const {
    weekDates,
    ledgerByYmd,
    currentMonthDaysData,
    monthlyDaysData,
    istYm,
    selectedMonth,
    monthAvailabilityByYm,
    todayYmd,
    canonicalSnapshot,
    manualGridOffSet,
  } = params;

  const mapCurrentMonth = new Map(currentMonthDaysData.map((d) => [d.day, d.yield]));
  const mapSelectedMonth = new Map(monthlyDaysData.map((d) => [d.day, d.yield]));

  return weekDates.map((ymd) => {
    const entry = ledgerByYmd.get(ymd);
    const prevYmd = shiftYmdDays(ymd, -7);
    const prevEntry = ledgerByYmd.get(prevYmd);
    const dayNum = parseInt(ymd.slice(8, 10), 10);
    const ym = ymd.slice(0, 7);

    let realKwh = Number(entry?.realKwh || 0);
    if (ymd === todayYmd) {
      realKwh = canonicalSnapshot.today.cloudKwh;
    } else if (ym === istYm && (mapCurrentMonth.get(dayNum) || 0) > realKwh) {
      realKwh = mapCurrentMonth.get(dayNum) || 0;
    } else if (ym === selectedMonth && (mapSelectedMonth.get(dayNum) || 0) > realKwh) {
      realKwh = mapSelectedMonth.get(dayNum) || 0;
    } else {
      const calHit = (monthAvailabilityByYm[ym] || []).find((d) => d.ymd === ymd);
      if (calHit && calHit.kwh > realKwh) realKwh = calHit.kwh;
    }

    const isManualGridOff = manualGridOffSet.has(ymd) || Boolean(entry?.isManualGridOff);
    const bufferKwh =
      isManualGridOff || ymd > todayYmd
        ? 0
        : Math.max(
            0,
            +(
              canonicalSnapshot.reconciledBufferByYmd[ymd] ??
              (ymd === todayYmd ? canonicalSnapshot.today.bufferKwh : 0)
            ).toFixed(2),
          );
    const physicalDayKwh = +(realKwh + bufferKwh).toFixed(2);

    const modelKwh =
      ymd === todayYmd
        ? canonicalSnapshot.today.fullDayTargetKwh
        : Number(entry?.modeledAfterSoilingKwh || 0);
    const idealClearSkyKwh =
      Number(entry?.idealClearSkyKwh || 0) || +(modelKwh * 1.12).toFixed(1);

    const isConfirmed =
      ymd === todayYmd
        ? canonicalSnapshot.today.isConfirmed && realKwh > 0.05
        : Boolean(entry?.isConfirmed || realKwh > 0.05);

    const capturePct =
      ymd === todayYmd &&
      canonicalSnapshot.today.expectedSoFarKwh > 0.2 &&
      (canonicalSnapshot.today.isConfirmed || bufferKwh > 0.05)
        ? Math.round((physicalDayKwh / canonicalSnapshot.today.expectedSoFarKwh) * 100)
        : entry?.realVsModelPct ??
          (modelKwh > 0.2 && (isConfirmed || bufferKwh > 0.05)
            ? Math.round((physicalDayKwh / modelKwh) * 100)
            : null);

    const dipCategory: DipAttributionCategory =
      entry?.dipCategory ||
      (ymd === todayYmd
        ? canonicalSnapshot.today.isConfirmed
          ? 'OPTIMAL'
          : 'PENDING_SYNC'
        : isConfirmed
          ? 'OPTIMAL'
          : ymd < todayYmd && canonicalSnapshot.today.isConfirmed
            ? 'WIFI_OUTAGE_UNLOGGED'
            : 'PENDING_SYNC');

    return {
      ymd,
      shortLabel: entry?.shortLabel || formatIndianDate(ymd, 'short'),
      axisLabel: `${formatWeekdayShort(ymd)} ${dayNum}`,
      realKwh: +realKwh.toFixed(2),
      cloudKwh: +realKwh.toFixed(2),
      bufferKwh,
      isManualGridOff,
      modelKwh: +modelKwh.toFixed(2),
      idealClearSkyKwh: +idealClearSkyKwh.toFixed(2),
      prevPeriodKwh: prevEntry?.isConfirmed ? prevEntry.realKwh : null,
      capturePct,
      dipCategory,
      dipReasonLabel:
        ymd === todayYmd
          ? canonicalSnapshot.today.isConfirmed
            ? bufferKwh > 0.05
              ? `Cloud ${realKwh.toFixed(1)} + ${bufferKwh.toFixed(1)} Buffer = ${physicalDayKwh.toFixed(1)} kWh`
              : `Live (${canonicalSnapshot.today.displayKwh.toFixed(1)} kWh so far)`
            : 'Live Forecast'
          : entry?.dipReasonLabel ||
            (isConfirmed
              ? 'Verified'
              : ymd < todayYmd && canonicalSnapshot.today.isConfirmed
                ? 'Wi-Fi offline all day (unlogged)'
                : 'Awaiting Cloud sync'),
      isToday: ymd === todayYmd,
      isFuture: ymd > todayYmd,
      isConfirmed,
      todayTargetTotalKwh: ymd === todayYmd ? canonicalSnapshot.today.fullDayTargetKwh : undefined,
      pm10Avg: entry?.pm10Avg,
      aodAvg: entry?.aodAvg,
      rainMm: entry?.rainMm,
    };
  });
}

export function buildWeekSparkDays(params: {
  weekBulletBars: PerformanceBulletBarItem[];
  ledgerByYmd: Map<string, DailyPerformanceLedgerEntry>;
  dayComparisonByYmd: Record<string, DayComparisonResponse>;
  todayYmd: string;
  yesterdayYmd: string;
  todayRawSeries: RawSeries[];
  yesterdayRawSeries: RawSeries[];
  lastSyncedDay: LiveSyncLastSyncedDay | null;
  weatherData?: SolarWeatherResponse | null;
  sunriseMin: number;
  sunsetMin: number;
}): WeekSparkDayItem[] {
  const {
    weekBulletBars,
    ledgerByYmd,
    dayComparisonByYmd,
    todayYmd,
    yesterdayYmd,
    todayRawSeries,
    yesterdayRawSeries,
    lastSyncedDay,
    weatherData,
    sunriseMin,
    sunsetMin,
  } = params;

  return weekBulletBars.map((b) => {
    const entry = ledgerByYmd.get(b.ymd) || null;
    const cmp = dayComparisonByYmd[b.ymd];
    const rawSeries =
      b.ymd === todayYmd
        ? todayRawSeries
        : cmp?.waaree?.rawSeries && hasNonEmptyRaw(cmp.waaree.rawSeries)
          ? cmp.waaree.rawSeries
          : b.ymd === yesterdayYmd && hasNonEmptyRaw(yesterdayRawSeries)
            ? yesterdayRawSeries
            : lastSyncedDay?.ymd === b.ymd && hasNonEmptyRaw(lastSyncedDay.raw)
              ? lastSyncedDay.raw
              : null;

    const hourlyGti =
      b.ymd === todayYmd
        ? weatherData?.hourly?.globalTiltedIrradiance?.slice(0, 24)
        : cmp?.weather?.hourlyGti || weatherData?.pastDays?.[b.ymd]?.hourlyGti;

    return {
      ymd: b.ymd,
      ledgerEntry: entry,
      rawSeries,
      hourlyGti,
      sunriseMin,
      sunsetMin,
      eepromKwh: b.realKwh,
      isToday: b.isToday,
    };
  });
}

export interface MonthSummaryStats {
  totalRealKwh: number;
  totalBufferKwh: number;
  totalPhysicalKwh: number;
  totalModelConfirmedKwh: number;
  confirmedDays: number;
  totalRenderedDays: number;
  avgKwh: number | null;
  bestDay: { ymd: string; shortLabel: string; realKwh: number } | null;
  capturePct: number | null;
}

export function buildMonthBulletBarsAndStats(params: {
  selectedMonth: string;
  istClock: IstClockParts;
  resolvedCommissioningYmd: string;
  monthlyDaysData: Array<{ day: number; yield: number }>;
  monthAvailabilityByYm: Record<string, DayComparisonCalendarDay[]>;
  todayYmd: string;
  ledgerByYmd: Map<string, DailyPerformanceLedgerEntry>;
  canonicalSnapshot: CanonicalSolarSnapshot;
  manualGridOffSet: Set<string>;
}): {
  monthBulletBars: PerformanceBulletBarItem[];
  monthAvgKwh: number | null;
  monthSummaryStats: MonthSummaryStats;
} {
  const {
    selectedMonth,
    istClock,
    resolvedCommissioningYmd,
    monthlyDaysData,
    monthAvailabilityByYm,
    todayYmd,
    ledgerByYmd,
    canonicalSnapshot,
    manualGridOffSet,
  } = params;

  const [y, m] = selectedMonth.split('-').map(Number);
  const totalDays = daysInIstMonth(y || istClock.year, m || istClock.month);
  const commYm = resolvedCommissioningYmd.slice(0, 7);
  const commDay = selectedMonth === commYm ? parseInt(resolvedCommissioningYmd.slice(8, 10), 10) : 1;
  const startDay = selectedMonth === commYm ? Math.max(1, commDay) : 1;

  const mapFromMonthly = new Map(monthlyDaysData.map((d) => [d.day, d.yield]));
  const mapFromCal = new Map((monthAvailabilityByYm[selectedMonth] || []).map((d) => [d.day, d.kwh]));

  const items: PerformanceBulletBarItem[] = [];
  let sumConfirmed = 0;
  let sumBuffer = 0;
  let sumPhysicalConfirmedOrBuffered = 0;
  let countConfirmed = 0;
  let sumModelConfirmed = 0;
  let bestDay: { ymd: string; shortLabel: string; realKwh: number } | null = null;

  for (let day = startDay; day <= totalDays; day++) {
    const ymd = `${selectedMonth}-${String(day).padStart(2, '0')}`;
    const isToday = ymd === todayYmd;
    const isFuture = ymd > todayYmd;
    const entry = ledgerByYmd.get(ymd);

    let realKwh = Number(entry?.realKwh || 0);
    if (isToday) {
      realKwh = canonicalSnapshot.today.cloudKwh;
    } else if ((mapFromMonthly.get(day) || 0) > realKwh) {
      realKwh = mapFromMonthly.get(day) || 0;
    } else if ((mapFromCal.get(day) || 0) > realKwh) {
      realKwh = mapFromCal.get(day) || 0;
    }

    const isManualGridOff = manualGridOffSet.has(ymd) || Boolean(entry?.isManualGridOff);
    const bufferKwh =
      isManualGridOff || isFuture
        ? 0
        : Math.max(
            0,
            +(
              canonicalSnapshot.reconciledBufferByYmd[ymd] ??
              (isToday ? canonicalSnapshot.today.bufferKwh : 0)
            ).toFixed(2),
          );
    const physicalDayKwh = +(realKwh + bufferKwh).toFixed(2);

    const modelKwh = isToday
      ? canonicalSnapshot.today.fullDayTargetKwh
      : Number(entry?.modeledAfterSoilingKwh || 0);
    const idealClearSkyKwh =
      Number(entry?.idealClearSkyKwh || 0) || (modelKwh > 0 ? +(modelKwh * 1.12).toFixed(1) : 0);

    const isConfirmed = isToday
      ? canonicalSnapshot.today.isConfirmed && realKwh > 0.05
      : !isFuture && Boolean(entry?.isConfirmed || realKwh > 0.05);

    if (!isFuture && (isConfirmed || bufferKwh > 0.05)) {
      if (isConfirmed) {
        sumConfirmed += realKwh;
        countConfirmed += 1;
      }
      sumBuffer += bufferKwh;
      sumPhysicalConfirmedOrBuffered += physicalDayKwh;
      if (isToday && canonicalSnapshot.today.expectedSoFarKwh > 0.2) {
        sumModelConfirmed += canonicalSnapshot.today.expectedSoFarKwh;
      } else if (modelKwh > 0) {
        sumModelConfirmed += modelKwh;
      }
      if (!bestDay || physicalDayKwh > bestDay.realKwh) {
        bestDay = { ymd, shortLabel: formatIndianDate(ymd, 'short'), realKwh: physicalDayKwh };
      }
    }

    const capturePct =
      isToday &&
      canonicalSnapshot.today.expectedSoFarKwh > 0.2 &&
      (canonicalSnapshot.today.isConfirmed || bufferKwh > 0.05)
        ? Math.round((physicalDayKwh / canonicalSnapshot.today.expectedSoFarKwh) * 100)
        : entry?.realVsModelPct ??
          (modelKwh > 0.2 && (isConfirmed || bufferKwh > 0.05)
            ? Math.round((physicalDayKwh / modelKwh) * 100)
            : null);

    const dipCategory: DipAttributionCategory = isFuture
      ? 'PENDING_SYNC'
      : entry?.dipCategory ||
        (isConfirmed
          ? 'OPTIMAL'
          : ymd < todayYmd && canonicalSnapshot.today.isConfirmed
            ? 'WIFI_OUTAGE_UNLOGGED'
            : 'PENDING_SYNC');

    items.push({
      ymd,
      shortLabel: entry?.shortLabel || formatIndianDate(ymd, 'short'),
      axisLabel: `${day}`,
      realKwh: +realKwh.toFixed(2),
      cloudKwh: +realKwh.toFixed(2),
      bufferKwh,
      isManualGridOff,
      modelKwh: +modelKwh.toFixed(2),
      idealClearSkyKwh: +idealClearSkyKwh.toFixed(2),
      capturePct,
      dipCategory,
      dipReasonLabel: isFuture
        ? 'Upcoming'
        : isToday
          ? canonicalSnapshot.today.isConfirmed
            ? bufferKwh > 0.05
              ? `Cloud ${realKwh.toFixed(1)} + ${bufferKwh.toFixed(1)} Buffer`
              : 'Live Today'
            : 'Est. Today'
          : entry?.dipReasonLabel ||
            (isConfirmed
              ? 'Verified'
              : ymd < todayYmd && canonicalSnapshot.today.isConfirmed
                ? 'Wi-Fi offline all day (unlogged)'
                : 'Awaiting Cloud sync'),
      isToday,
      isFuture,
      isConfirmed,
      todayTargetTotalKwh: isToday ? canonicalSnapshot.today.fullDayTargetKwh : undefined,
      pm10Avg: entry?.pm10Avg,
      aodAvg: entry?.aodAvg,
      rainMm: entry?.rainMm,
    });
  }

  const avg = countConfirmed > 0 ? +(sumConfirmed / countConfirmed).toFixed(1) : null;
  const periodCapture =
    sumModelConfirmed > 0.3 ? Math.round((sumPhysicalConfirmedOrBuffered / sumModelConfirmed) * 100) : null;

  return {
    monthBulletBars: items,
    monthAvgKwh: avg,
    monthSummaryStats: {
      totalRealKwh: +sumConfirmed.toFixed(1),
      totalBufferKwh: +sumBuffer.toFixed(2),
      totalPhysicalKwh: +(sumConfirmed + sumBuffer).toFixed(2),
      totalModelConfirmedKwh: +sumModelConfirmed.toFixed(1),
      confirmedDays: countConfirmed,
      totalRenderedDays: items.filter((d) => !d.isFuture).length,
      avgKwh: avg,
      bestDay,
      capturePct: periodCapture,
    },
  };
}

export interface YearSummaryStats {
  totalYearKwh: number;
  activeMonthsCount: number;
  bestMonth: PerformanceYearMonthItem | null;
  specificYieldYear: number;
  savingsInr: number;
  co2Kg: number;
}

export function buildYearMonthsAndStats(params: {
  yearlyMonthsData: Array<{ month: number; ym: string; label: string; realKwh: number }>;
  activeYear: number;
  resolvedCommissioningYmd: string;
  currentYm: string;
  tariffPerKwh: number;
  co2FactorKgPerKwh: number;
  currentMonthKwh: number;
  currentMonthActiveDays: number;
  intelligenceReport?: SolarIntelligenceReport | null;
  safeCapacity: number;
}): {
  yearMonths: PerformanceYearMonthItem[];
  yearSummaryStats: YearSummaryStats;
} {
  const {
    yearlyMonthsData,
    activeYear,
    resolvedCommissioningYmd,
    currentYm,
    tariffPerKwh,
    co2FactorKgPerKwh,
    currentMonthKwh,
    currentMonthActiveDays,
    intelligenceReport,
    safeCapacity,
  } = params;

  const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const commYm = resolvedCommissioningYmd.slice(0, 7);

  const ledgerMonthlySums = new Map<string, { sum: number; activeDays: number }>();
  if (intelligenceReport?.dailyLedger) {
    for (const entry of intelligenceReport.dailyLedger) {
      if (!entry.isConfirmed) continue;
      const ym = entry.ymd.slice(0, 7);
      const cur = ledgerMonthlySums.get(ym) || { sum: 0, activeDays: 0 };
      cur.sum += Number(entry.realKwh) || 0;
      cur.activeDays += 1;
      ledgerMonthlySums.set(ym, cur);
    }
  }

  const apiMonthMap = new Map(yearlyMonthsData.map((m) => [m.month, m.realKwh]));
  let totalYearKwh = 0;
  let activeMonthsCount = 0;
  let bestMonth: PerformanceYearMonthItem | null = null;
  const rows: PerformanceYearMonthItem[] = [];

  for (let idx = 0; idx < 12; idx++) {
    const mo = idx + 1;
    const ym = `${activeYear}-${String(mo).padStart(2, '0')}`;
    const isPreCommissioning = ym < commYm;
    const isFutureMonth = ym > currentYm;
    const isPartialCommissioning = ym === commYm;

    const ledgerRec = ledgerMonthlySums.get(ym);
    const apiVal = apiMonthMap.get(mo) || 0;
    const currentMtdVal = ym === currentYm ? currentMonthKwh : 0;
    const realKwh =
      isPreCommissioning || isFutureMonth
        ? 0
        : +Math.max(apiVal, currentMtdVal, ledgerRec?.sum || 0).toFixed(1);

    const daysInMo = daysInIstMonth(activeYear, mo);
    const commDay = isPartialCommissioning ? parseInt(resolvedCommissioningYmd.slice(8, 10), 10) : 1;
    const activeDays =
      isPreCommissioning || isFutureMonth
        ? 0
        : ym === currentYm
          ? Math.max(currentMonthActiveDays, ledgerRec?.activeDays || 0)
          : ledgerRec?.activeDays || (realKwh > 0 ? Math.max(1, daysInMo - commDay + 1) : 0);

    const item: PerformanceYearMonthItem = {
      month: mo,
      ym,
      shortMonth: shortNames[idx],
      label: `${shortNames[idx]} ${activeYear}`,
      realKwh,
      isPreCommissioning,
      isFutureMonth,
      isPartialCommissioning,
      activeDays,
      dailyAvgKwh: activeDays > 0 && realKwh > 0 ? +(realKwh / activeDays).toFixed(1) : null,
      savingsInr: Math.round(realKwh * tariffPerKwh),
    };

    if (realKwh > 0.05) {
      totalYearKwh += realKwh;
      activeMonthsCount += 1;
      if (!bestMonth || realKwh > bestMonth.realKwh) bestMonth = item;
    }

    rows.push(item);
  }

  return {
    yearMonths: rows,
    yearSummaryStats: {
      totalYearKwh: +totalYearKwh.toFixed(1),
      activeMonthsCount,
      bestMonth,
      specificYieldYear: safeCapacity > 0 ? +(totalYearKwh / safeCapacity).toFixed(1) : 0,
      savingsInr: Math.round(totalYearKwh * tariffPerKwh),
      co2Kg: +(totalYearKwh * co2FactorKgPerKwh).toFixed(1),
    },
  };
}
