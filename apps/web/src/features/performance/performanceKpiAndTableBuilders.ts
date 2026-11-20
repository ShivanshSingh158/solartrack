import {
  formatIndianDate,
  formatIndianMonthYear,
  formatMinutes12hUpper,
  formatWeekdayShort,
  getDipCategoryBarColor,
  type CanonicalSolarSnapshot,
  type DailyPerformanceLedgerEntry,
  type DailySolarPhysicsModel,
  type ParsedDayTelemetry,
  type PeriodEnergyAttribution,
  type RawSeries,
  type ReconstructedGapCurveResult,
  type TableRowData,
  type TimescaleMode,
  type WeightedEfficiencyResult,
} from '@solar-track/core';
import type { PerformanceKpiColumn } from './PerformanceKpiStrip';
import type { PerformanceBulletBarItem, PerformanceYearMonthItem } from './performanceStageTypes';
import type { MonthSummaryStats, YearSummaryStats } from './performancePeriodBuilders';

export interface PerformanceCsvPayload {
  filename?: string;
  headers: string[];
  rows: string[][];
}

export function buildPerformanceKpiColumns(params: {
  timescale: TimescaleMode;
  primaryPhysicsModel: DailySolarPhysicsModel;
  isTodaySelected: boolean;
  canonicalSnapshot: CanonicalSolarSnapshot;
  primaryDayEepromKwh: number;
  primaryParsed: ParsedDayTelemetry;
  primaryGapCurve: ReconstructedGapCurveResult;
  hasOutageGap: boolean;
  primaryLedger: DailyPerformanceLedgerEntry | null;
  selectedDate: string;
  primarySurfaceLossPct: number;
  safeCapacity: number;
  dcAcCapLabel: string;
  syncedAtIstLabel?: string;
  isCombined: boolean;
  dayWeightedEfficiency: WeightedEfficiencyResult;
  weekBulletBars: PerformanceBulletBarItem[];
  periodAttribution: PeriodEnergyAttribution | null;
  monthSummaryStats: MonthSummaryStats;
  selectedMonth: string;
  currentYm: string;
  activeYear: number;
  yearSummaryStats: YearSummaryStats;
  resolvedCommissioningYmd: string;
}): [PerformanceKpiColumn, PerformanceKpiColumn, PerformanceKpiColumn, PerformanceKpiColumn] {
  const {
    timescale,
    primaryPhysicsModel,
    isTodaySelected,
    canonicalSnapshot,
    primaryDayEepromKwh,
    primaryParsed,
    primaryGapCurve: _primaryGapCurve,
    hasOutageGap: _hasOutageGap,
    primaryLedger,
    selectedDate,
    primarySurfaceLossPct: _primarySurfaceLossPct,
    safeCapacity,
    dcAcCapLabel: _dcAcCapLabel,
    syncedAtIstLabel: _syncedAtIstLabel,
    isCombined: _isCombined,
    dayWeightedEfficiency,
    weekBulletBars,
    periodAttribution,
    monthSummaryStats,
    selectedMonth,
    currentYm,
    activeYear,
    yearSummaryStats,
    resolvedCommissioningYmd,
  } = params;

  if (timescale === 'day') {
    const dayStatsModel = primaryPhysicsModel;
    const isDaylightToday = isTodaySelected && canonicalSnapshot.sun.isDaylightWindow;
    const modelHorizonKwh = isDaylightToday
      ? canonicalSnapshot.today.expectedSoFarKwh
      : dayStatsModel.targetDailyModelKwh;
    const cleanSkyKwh =
      primaryLedger?.idealClearSkyKwh ?? +(dayStatsModel.targetDailyModelKwh * 1.12).toFixed(1);

    const realVsModelPct =
      isDaylightToday && modelHorizonKwh > 0.15 && canonicalSnapshot.today.isConfirmed
        ? Math.round((primaryDayEepromKwh / modelHorizonKwh) * 100)
        : !isDaylightToday && dayStatsModel.targetDailyModelKwh > 0.2 && primaryDayEepromKwh > 0.05
          ? Math.round((primaryDayEepromKwh / dayStatsModel.targetDailyModelKwh) * 100)
          : null;

    const col1: PerformanceKpiColumn = isTodaySelected
      ? canonicalSnapshot.today.isConfirmed
        ? {
            eyebrow: 'Solar Generation',
            accentDot: 'emerald',
            primary: `${canonicalSnapshot.today.displayKwh.toFixed(1)} kWh`,
            primaryUnit: 'generated today',
            rightMeta: realVsModelPct !== null ? `${realVsModelPct}% of goal` : undefined,
            subtitle: `Live solar power: ${canonicalSnapshot.today.liveKw.toFixed(2)} kW`,
          }
        : {
            eyebrow: canonicalSnapshot.sun.isNight ? 'Solar Generation (Night)' : 'Solar Generation (Syncing)',
            accentDot: canonicalSnapshot.sun.isNight ? 'slate' : 'amber',
            primary: canonicalSnapshot.sun.isNight
              ? `${canonicalSnapshot.today.displayKwh.toFixed(1)} kWh`
              : 'Syncing',
            primaryTone: canonicalSnapshot.sun.isNight ? 'slate' : 'amber',
            rightMeta: canonicalSnapshot.sun.isNight ? 'Night' : 'In Progress',
            subtitle: canonicalSnapshot.sun.isNight
              ? `Day concluded · Next dawn ${dayStatsModel.sunriseText}`
              : 'Connecting to inverter to fetch latest readings',
          }
      : {
          eyebrow: 'Solar Generation',
          accentDot: primaryDayEepromKwh > 0.05 ? 'emerald' : 'slate',
          primary: primaryDayEepromKwh > 0.05 ? `${primaryDayEepromKwh.toFixed(1)} kWh` : '0.0 kWh',
          primaryUnit: 'total recorded',
          rightMeta: realVsModelPct !== null ? `${realVsModelPct}% of target` : undefined,
          subtitle: formatIndianDate(selectedDate, 'weekday'),
        };

    const col2: PerformanceKpiColumn = isDaylightToday
      ? {
          eyebrow: 'Expected Target',
          accentDot: 'sky',
          primary: `~${canonicalSnapshot.today.expectedSoFarKwh.toFixed(1)} kWh`,
          primaryUnit: 'expected by now',
          primaryTone: 'sky',
          rightMeta: `${dayStatsModel.effectivePr ? (dayStatsModel.effectivePr * 100).toFixed(0) : canonicalSnapshot.effectivePrBreakdown.prPct}% efficiency`,
          subtitle: `Full day clear-sky target: ~${canonicalSnapshot.today.fullDayTargetKwh.toFixed(1)} kWh`,
        }
      : {
          eyebrow: 'Expected Target',
          accentDot: 'sky',
          primary: `~${dayStatsModel.targetDailyModelKwh.toFixed(1)} kWh`,
          primaryUnit: 'sunny day goal',
          primaryTone: 'sky',
          rightMeta: 'Clear sky goal',
          subtitle: `Clear sky target: ${cleanSkyKwh.toFixed(1)} kWh`,
        };

    const measuredPeakKw = primaryParsed.hasData ? primaryParsed.peakKw : 0;
    const peakLabelKw = measuredPeakKw > 0.05 ? measuredPeakKw : dayStatsModel.peakKw;
    const peakTimeDisplay =
      measuredPeakKw > 0.05
        ? formatMinutes12hUpper(primaryParsed.peakMinutes)
        : dayStatsModel.peakTimeText;

    const col3: PerformanceKpiColumn = {
      eyebrow: 'Peak Power Output',
      primary: `${peakLabelKw.toFixed(2)} kW`,
      primaryUnit: `@ ${peakTimeDisplay}`,
      rightMeta: `Array ${safeCapacity.toFixed(1)} kW`,
      subtitle: isDaylightToday ? 'Highest solar output reached today' : 'Maximum generation rate achieved',
    };

    let etaPrimary = 'Good';
    let etaSubtitle = 'Normal sunlight conditions';

    if (isTodaySelected && canonicalSnapshot.sun.isNight) {
      etaPrimary = 'Standby';
      etaSubtitle = `Night · Next dawn ${dayStatsModel.sunriseText}`;
    } else if (dayWeightedEfficiency.etaPct !== null) {
      etaPrimary = `${dayWeightedEfficiency.etaPct.toFixed(0)}%`;
      etaSubtitle = 'Inverter conversion efficiency';
    }

    const col4: PerformanceKpiColumn = {
      eyebrow: 'System Health',
      primary: etaPrimary,
      primaryTone: 'emerald',
      rightMeta: isTodaySelected ? canonicalSnapshot.weatherNow.conditionLabel : undefined,
      subtitle: etaSubtitle,
    };

    return [col1, col2, col3, col4];
  }

  if (timescale === 'week') {
    const confirmedItems = weekBulletBars.filter((b) => b.isConfirmed && !b.isFuture);
    const totalCloud = confirmedItems.reduce((acc, b) => acc + b.realKwh, 0);
    const totalBuffer = weekBulletBars.filter((b) => !b.isFuture).reduce((acc, b) => acc + (b.bufferKwh || 0), 0);
    const totalReconciled = totalCloud + totalBuffer;
    const totalModel = confirmedItems.reduce((acc, b) => acc + b.modelKwh, 0);
    const activeOrBufferedDays = weekBulletBars.filter(
      (b) => !b.isFuture && (b.isConfirmed || (b.bufferKwh || 0) > 1),
    ).length;
    const avgDaily = activeOrBufferedDays > 0 ? totalReconciled / activeOrBufferedDays : 0;
    const capturePct = totalModel > 0.3 ? Math.round((totalReconciled / totalModel) * 100) : null;
    const bestDayItem =
      confirmedItems.toSorted(
        (a, b) => b.realKwh + (b.bufferKwh || 0) - (a.realKwh + (a.bufferKwh || 0)),
      )[0] || null;

    return [
      {
        eyebrow: '7-Day Solar Generation',
        accentDot: 'emerald',
        primary: `${(totalBuffer > 0.05 ? totalReconciled : totalCloud).toFixed(1)} kWh`,
        primaryUnit: 'total produced',
        rightMeta: capturePct !== null ? `${capturePct}% captured` : undefined,
        subtitle: `Electricity value: ₹${Math.round(totalCloud * canonicalSnapshot.config.tariffPerKwh).toLocaleString('en-IN')}`,
      },
      {
        eyebrow: 'Sunny Day Potential',
        accentDot: 'sky',
        primary: `~${totalModel.toFixed(1)} kWh`,
        primaryTone: 'sky',
        primaryUnit: 'expected',
        rightMeta: '7-day target',
        subtitle: `Ideal sunny target: ${weekBulletBars.reduce((a, b) => a + b.idealClearSkyKwh, 0).toFixed(1)} kWh`,
      },
      {
        eyebrow: 'Daily Average',
        primary: `${avgDaily.toFixed(1)} kWh`,
        primaryUnit: 'per day',
        rightMeta: bestDayItem ? `Best: ${bestDayItem.shortLabel}` : undefined,
        subtitle: bestDayItem
          ? `Peak day achieved ${(bestDayItem.realKwh + (bestDayItem.bufferKwh || 0)).toFixed(1)} kWh`
          : '7 verified days in range',
      },
      {
        eyebrow: 'Weather Impact',
        primary: capturePct !== null ? `${capturePct}%` : '—',
        primaryUnit: 'of potential',
        rightMeta: `${weekBulletBars.filter((b) => b.dipCategory === 'OPTIMAL').length}/7 clear days`,
        subtitle:
          periodAttribution && periodAttribution.weatherLossKwh > 0.2
            ? `Clouds: -${periodAttribution.weatherLossKwh.toFixed(1)} kWh · Dust: -${periodAttribution.hazeAndSoilingLossKwh.toFixed(1)} kWh`
            : 'Minimal cloud or atmospheric loss',
      },
    ];
  }

  if (timescale === 'month') {
    const mTotal = monthSummaryStats.totalRealKwh;
    const mBuffer = monthSummaryStats.totalBufferKwh ?? 0;
    const mReconciled = monthSummaryStats.totalPhysicalKwh ?? +(mTotal + mBuffer).toFixed(2);
    const mModel = monthSummaryStats.totalModelConfirmedKwh;
    const isCurrentMonth = selectedMonth === currentYm;
    const mAnchored = isCurrentMonth && canonicalSnapshot.month.isEmonthAnchored;
    const mHeadline = mAnchored
      ? canonicalSnapshot.month.physicalTotalKwh
      : Math.max(mTotal, mReconciled, isCurrentMonth ? canonicalSnapshot.month.physicalTotalKwh : 0);
    const projected = isCurrentMonth ? canonicalSnapshot.month.projectedKwh : mReconciled;

    return [
      {
        eyebrow: isCurrentMonth ? 'Monthly Generation' : 'Total Generated',
        accentDot: 'emerald',
        primary: `${mHeadline.toFixed(1)} kWh`,
        primaryUnit: isCurrentMonth ? `${monthSummaryStats.confirmedDays} days tracked` : 'full month',
        rightMeta:
          monthSummaryStats.capturePct !== null ? `${monthSummaryStats.capturePct}% captured` : undefined,
        subtitle: `Estimated savings: ₹${Math.round(mHeadline * canonicalSnapshot.config.tariffPerKwh).toLocaleString('en-IN')}`,
      },
      {
        eyebrow: 'Expected Target',
        accentDot: 'sky',
        primary: mModel > 0 ? `~${mModel.toFixed(1)} kWh` : '—',
        primaryTone: 'sky',
        primaryUnit: 'target',
        rightMeta: `${monthSummaryStats.confirmedDays} days`,
        subtitle: isCurrentMonth
          ? `Projected month-end: ~${projected} kWh`
          : `${formatIndianMonthYear(selectedMonth)} target`,
      },
      {
        eyebrow: 'Daily Average',
        primary:
          monthSummaryStats.avgKwh !== null ? `${monthSummaryStats.avgKwh.toFixed(1)} kWh` : '—',
        primaryUnit: 'per day',
        rightMeta: monthSummaryStats.bestDay ? monthSummaryStats.bestDay.shortLabel : undefined,
        subtitle: monthSummaryStats.bestDay
          ? `Best day was ${monthSummaryStats.bestDay.realKwh.toFixed(1)} kWh`
          : 'Consistent generation throughout month',
      },
      {
        eyebrow: 'Estimated Savings',
        primary: `₹${Math.round(mHeadline * canonicalSnapshot.config.tariffPerKwh).toLocaleString('en-IN')}`,
        primaryUnit: 'saved',
        rightMeta: `${Math.round(mHeadline * 0.85)} kg CO₂`,
        subtitle: `Avoided ${Math.round(mHeadline * 0.85)} kg carbon emissions`,
      },
    ];
  }

  return [
    {
      eyebrow: `${activeYear} Annual Output`,
      accentDot: 'emerald',
      primary: `${yearSummaryStats.totalYearKwh.toFixed(1)} kWh`,
      primaryUnit: `${yearSummaryStats.activeMonthsCount} active months`,
      subtitle: `System commissioned ${formatIndianDate(resolvedCommissioningYmd, 'medium')}`,
    },
    {
      eyebrow: 'Energy per Installed kW',
      accentDot: 'sky',
      primary: `${yearSummaryStats.specificYieldYear.toFixed(1)}`,
      primaryUnit: 'kWh per kWp',
      primaryTone: 'sky',
      subtitle: `Rooftop system: ${safeCapacity.toFixed(2)} kWp capacity`,
    },
    {
      eyebrow: 'Best Month',
      primary: yearSummaryStats.bestMonth ? `${yearSummaryStats.bestMonth.realKwh.toFixed(1)} kWh` : '—',
      rightMeta: yearSummaryStats.bestMonth?.label,
      subtitle: yearSummaryStats.bestMonth?.dailyAvgKwh
        ? `Avg ${yearSummaryStats.bestMonth.dailyAvgKwh.toFixed(1)} kWh/d over ${yearSummaryStats.bestMonth.activeDays}d`
        : 'Active generation period',
    },
    {
      eyebrow: 'Estimated Annual Savings',
      primary: `₹${yearSummaryStats.savingsInr.toLocaleString('en-IN')}`,
      rightMeta: `${yearSummaryStats.co2Kg} kg CO₂`,
      subtitle: `Electricity bill reduction at ₹${canonicalSnapshot.config.tariffPerKwh.toFixed(2)}/kWh`,
    },
  ];
}

export function buildPerformanceTableRows(params: {
  timescale: TimescaleMode;
  isCombined: boolean;
  parentTableRows: TableRowData[];
  primaryRawSeries: RawSeries[];
  selectedDate: string;
  primaryPhysicsModel: DailySolarPhysicsModel;
  weekBulletBars: PerformanceBulletBarItem[];
  monthBulletBars: PerformanceBulletBarItem[];
  yearMonths: PerformanceYearMonthItem[];
}): TableRowData[] {
  const {
    timescale,
    isCombined,
    parentTableRows,
    primaryRawSeries,
    selectedDate,
    primaryPhysicsModel,
    weekBulletBars,
    monthBulletBars,
    yearMonths,
  } = params;

  if (timescale === 'day') {
    if (isCombined && parentTableRows.length > 0) return parentTableRows;
    const genSeries = primaryRawSeries.find((s) => s.variable === 'generationPower');
    const pvSeries = primaryRawSeries.find((s) => s.variable === 'pvPower');
    const feedSeries = primaryRawSeries.find((s) => s.variable === 'feedinPower');
    const genData = Array.isArray(genSeries?.data) ? genSeries.data : [];
    if (genData.length === 0) return parentTableRows;

    const pvData = Array.isArray(pvSeries?.data) ? pvSeries.data : [];
    const feedData = Array.isArray(feedSeries?.data) ? feedSeries.data : [];
    const pvByTime = new Map(pvData.map((p) => [String(p.time), Number(p.value) || 0]));
    const feedByTime = new Map(feedData.map((p) => [String(p.time), Number(p.value) || 0]));

    return genData.map((pt) => {
      const timeStr = String(pt.time || selectedDate);
      const matchMin = timeStr.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
      const min = matchMin ? parseInt(matchMin[1], 10) * 60 + parseInt(matchMin[2], 10) : 0;
      const modelAt = primaryPhysicsModel.lookupAtMinute(min);
      const acVal = Number(pt.value) || 0;
      const pvVal = pvByTime.get(timeStr) ?? 0;
      const feedVal = feedByTime.get(timeStr) ?? 0;
      const capPct =
        modelAt.kw > 0.08 && acVal > 0 ? `${Math.round((acVal / modelAt.kw) * 100)}%` : '—';

      return {
        time: timeStr,
        output: `${acVal.toFixed(3)} kW`,
        model: `~${modelAt.kw.toFixed(3)} kW`,
        capturePct: capPct,
        pv: `${pvVal.toFixed(3)} kW`,
        feedin: `${feedVal.toFixed(3)} kW`,
        status: acVal > 0.02 ? 'Generating' : 'Standby',
        note:
          pvVal >= 0.08 && acVal > 0.01
            ? `η ${Math.min(98.5, Math.max(45.0, (acVal / pvVal) * 100)).toFixed(1)}%`
            : '—',
      };
    });
  }

  if (timescale === 'week' || timescale === 'month') {
    const source = timescale === 'week' ? weekBulletBars : monthBulletBars;
    return source.map((b) => {
      const palette = getDipCategoryBarColor(b.dipCategory);
      const atmParts: string[] = [];
      if (typeof b.pm10Avg === 'number' && b.pm10Avg > 0) atmParts.push(`PM10 ${Math.round(b.pm10Avg)}`);
      if (typeof b.aodAvg === 'number' && b.aodAvg > 0) atmParts.push(`AOD ${b.aodAvg.toFixed(2)}`);
      if (typeof b.rainMm === 'number' && b.rainMm >= 0.3) atmParts.push(`Rain ${b.rainMm.toFixed(1)}mm`);

      return {
        time: `${b.ymd} (${formatWeekdayShort(b.ymd)})`,
        output: `${b.realKwh.toFixed(2)} kWh`,
        model: b.modelKwh > 0 ? `~${b.modelKwh.toFixed(2)} kWh` : '—',
        capturePct: b.capturePct !== null ? `${b.capturePct}%` : '—',
        pv: '---',
        feedin: '---',
        status: b.isFuture ? 'Upcoming' : b.dipReasonLabel || palette.label,
        note: atmParts.length > 0 ? atmParts.join(' · ') : `Clear sky ~${b.idealClearSkyKwh.toFixed(1)} kWh`,
      };
    });
  }

  return yearMonths.map((m) => ({
    time: m.label,
    output: m.isPreCommissioning ? '—' : `${m.realKwh.toFixed(2)} kWh`,
    model: m.isPreCommissioning ? 'Pre-Install' : m.dailyAvgKwh ? `${m.dailyAvgKwh.toFixed(1)} kWh/d` : '—',
    capturePct: m.activeDays > 0 ? `${m.activeDays}d` : '—',
    pv: '---',
    feedin: '---',
    status: m.isPreCommissioning
      ? 'Pre-Commissioning'
      : m.isFutureMonth
        ? 'Upcoming'
        : m.realKwh > 0
          ? m.isPartialCommissioning
            ? 'Commissioned Month'
            : 'Active Production'
          : 'No Yield',
    note: m.ym,
  }));
}

export function buildPerformanceCsvPayload(params: {
  timescale: TimescaleMode;
  selectedDate: string;
  activeWeekEndYmd: string;
  selectedMonth: string;
  activeYear: number;
  enrichedTableRows: TableRowData[];
  weekBulletBars: PerformanceBulletBarItem[];
  monthBulletBars: PerformanceBulletBarItem[];
  yearMonths: PerformanceYearMonthItem[];
}): PerformanceCsvPayload {
  const {
    timescale,
    selectedDate,
    activeWeekEndYmd,
    selectedMonth,
    activeYear,
    enrichedTableRows,
    weekBulletBars,
    monthBulletBars,
    yearMonths,
  } = params;

  if (timescale === 'day') {
    return {
      filename: `solartrack_day_${selectedDate}.csv`,
      headers: ['Timestamp_IST', 'AC_Output_kW', 'Physics_Model_kW', 'Capture_Pct', 'PV_DC_kW', 'Grid_Export_kW', 'Status', 'Inverter_Eta'],
      rows: enrichedTableRows.map((r) => [
        r.time,
        r.output,
        r.model || '—',
        r.capturePct || '—',
        r.pv,
        r.feedin,
        r.status,
        r.note || '—',
      ]),
    };
  }

  if (timescale === 'week' || timescale === 'month') {
    const bars = timescale === 'week' ? weekBulletBars : monthBulletBars;
    return {
      filename: `solartrack_${timescale}_${timescale === 'week' ? activeWeekEndYmd : selectedMonth}.csv`,
      headers: ['Date_IST', 'Day', 'Real_kWh', 'Physics_Model_kWh', 'Clear_Sky_kWh', 'Capture_Pct', 'Attribution', 'Weather_Notes'],
      rows: bars.map((b) => [
        b.ymd,
        formatWeekdayShort(b.ymd),
        b.realKwh.toFixed(2),
        b.modelKwh.toFixed(2),
        b.idealClearSkyKwh.toFixed(2),
        b.capturePct !== null ? `${b.capturePct}%` : '—',
        b.dipReasonLabel,
        typeof b.pm10Avg === 'number' ? `PM10 ${Math.round(b.pm10Avg)} / AOD ${b.aodAvg?.toFixed(2) || '—'}` : '—',
      ]),
    };
  }

  return {
    filename: `solartrack_year_${activeYear}.csv`,
    headers: ['Month', 'Verified_kWh', 'Active_Days', 'Daily_Avg_kWh', 'Est_Savings_INR', 'Status'],
    rows: yearMonths.map((m) => [
      m.label,
      m.realKwh.toFixed(2),
      String(m.activeDays),
      m.dailyAvgKwh !== null ? m.dailyAvgKwh.toFixed(2) : '—',
      String(m.savingsInr),
      m.isPreCommissioning ? 'Pre-Commissioning' : m.isFutureMonth ? 'Upcoming' : 'Active',
    ]),
  };
}

export function buildPerformanceAuditSummary(params: {
  timescale: TimescaleMode;
  selectedDate: string;
  primaryDayEepromKwh: number;
  targetDailyModelKwh: number;
  parsedPointCount: number;
  primaryDipReasonLabel?: string;
  isTodaySelected: boolean;
  weekBulletBars: PerformanceBulletBarItem[];
  monthBulletBars: PerformanceBulletBarItem[];
  weekDates: string[];
  activeWeekEndYmd: string;
  selectedMonth: string;
  yearMonths: PerformanceYearMonthItem[];
  activeYear: number;
  yearSummaryStats: YearSummaryStats;
}) {
  const {
    timescale,
    selectedDate,
    primaryDayEepromKwh,
    targetDailyModelKwh,
    parsedPointCount,
    primaryDipReasonLabel,
    isTodaySelected,
    weekBulletBars,
    monthBulletBars,
    weekDates,
    activeWeekEndYmd,
    selectedMonth,
    yearMonths,
    activeYear,
    yearSummaryStats,
  } = params;

  if (timescale === 'day') {
    return {
      title: formatIndianDate(selectedDate, 'weekday'),
      realKwh: primaryDayEepromKwh,
      modelKwh: targetDailyModelKwh,
      capturePct:
        targetDailyModelKwh > 0.2
          ? Math.round((primaryDayEepromKwh / targetDailyModelKwh) * 100)
          : null,
      count: parsedPointCount || 1,
      rows: [
        {
          label: formatIndianDate(selectedDate, 'medium'),
          real: `${primaryDayEepromKwh.toFixed(2)} kWh`,
          model: `~${targetDailyModelKwh.toFixed(2)} kWh`,
          capture:
            targetDailyModelKwh > 0.2
              ? `${Math.round((primaryDayEepromKwh / targetDailyModelKwh) * 100)}%`
              : '—',
          reason: primaryDipReasonLabel || (isTodaySelected ? 'Live Day' : 'Confirmed Day'),
        },
      ],
    };
  }

  if (timescale === 'week' || timescale === 'month') {
    const bars = (timescale === 'week' ? weekBulletBars : monthBulletBars).filter((b) => !b.isFuture);
    const rSum = bars.reduce((a, b) => a + b.realKwh, 0);
    const mSum = bars.reduce((a, b) => a + b.modelKwh, 0);
    return {
      title:
        timescale === 'week'
          ? `${formatIndianDate(weekDates[0] || activeWeekEndYmd, 'short')} – ${formatIndianDate(weekDates[weekDates.length - 1] || activeWeekEndYmd, 'medium')}`
          : formatIndianMonthYear(selectedMonth),
      realKwh: +rSum.toFixed(1),
      modelKwh: +mSum.toFixed(1),
      capturePct: mSum > 0.3 ? Math.round((rSum / mSum) * 100) : null,
      count: bars.filter((b) => b.isConfirmed).length,
      rows: bars.map((b) => ({
        label: `${formatWeekdayShort(b.ymd)} · ${b.shortLabel}`,
        real: `${b.realKwh.toFixed(1)} kWh`,
        model: `~${b.modelKwh.toFixed(1)} kWh`,
        capture: b.capturePct !== null ? `${b.capturePct}%` : '—',
        reason: b.dipReasonLabel,
      })),
    };
  }

  const activeMos = yearMonths.filter((m) => !m.isPreCommissioning && !m.isFutureMonth);
  return {
    title: `Year ${activeYear}`,
    realKwh: yearSummaryStats.totalYearKwh,
    modelKwh: null,
    capturePct: null,
    count: yearSummaryStats.activeMonthsCount,
    rows: activeMos.map((m) => ({
      label: m.label,
      real: `${m.realKwh.toFixed(1)} kWh`,
      model: m.dailyAvgKwh ? `${m.dailyAvgKwh.toFixed(1)} kWh/d` : '—',
      capture: `${m.activeDays}d active`,
      reason: m.isPartialCommissioning ? 'Commissioning Month' : 'Verified Month',
    })),
  };
}
