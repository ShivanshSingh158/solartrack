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
    primaryGapCurve,
    hasOutageGap,
    primaryLedger,
    selectedDate,
    primarySurfaceLossPct,
    safeCapacity,
    dcAcCapLabel,
    syncedAtIstLabel,
    isCombined,
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
            eyebrow: 'Actual Production',
            accentDot: 'emerald',
            primary: `${canonicalSnapshot.today.displayKwh.toFixed(1)} kWh`,
            primaryUnit: 'till now',
            rightMeta: realVsModelPct !== null ? `${realVsModelPct}% capture` : undefined,
            subtitle: `Live AC ${canonicalSnapshot.today.liveKw.toFixed(2)} kW · Synced ${syncedAtIstLabel || 'IST'}`,
          }
        : {
            eyebrow: canonicalSnapshot.sun.isNight ? 'Actual Production (Night)' : 'Actual Production (Pending)',
            accentDot: canonicalSnapshot.sun.isNight ? 'slate' : 'amber',
            primary: canonicalSnapshot.sun.isNight
              ? `${canonicalSnapshot.today.displayKwh.toFixed(1)} kWh`
              : 'Awaiting Upload',
            primaryTone: canonicalSnapshot.sun.isNight ? 'slate' : 'amber',
            rightMeta: canonicalSnapshot.sun.isNight ? 'Night' : 'Pending',
            subtitle: canonicalSnapshot.sun.isNight
              ? `Sunset archive · Sunrise ${dayStatsModel.sunriseText}`
              : 'Upload pending — data will sync when Wi-Fi reconnects',
          }
      : primaryLedger?.dipCategory === 'WIFI_OUTAGE_UNLOGGED' && primaryDayEepromKwh <= 0.05
        ? {
            eyebrow: 'Actual Production (Wi-Fi Gap)',
            accentDot: 'amber',
            primary: '0.0 kWh',
            primaryUnit: 'Wi-Fi Offline',
            primaryTone: 'amber',
            rightMeta: `Twin ~${dayStatsModel.targetDailyModelKwh.toFixed(1)} kWh`,
            subtitle:
              primaryLedger?.dipReasonLabel ||
              `Wi-Fi offline past 00:00 · Model estimate ~${(primaryLedger?.unloggedEstimatedKwh ?? dayStatsModel.targetDailyModelKwh).toFixed(1)} kWh`,
          }
        : {
            eyebrow: 'Actual Production',
            accentDot: primaryDayEepromKwh > 0.05 ? 'emerald' : 'slate',
            primary: primaryDayEepromKwh > 0.05 ? `${primaryDayEepromKwh.toFixed(1)} kWh` : '0.0 kWh',
            primaryUnit: primaryParsed.hasData ? '5-min + EDay' : 'Daily meter',
            rightMeta: realVsModelPct !== null ? `${realVsModelPct}% vs model` : undefined,
            subtitle: primaryGapCurve.hasBridgedGaps
              ? `Online ${primaryParsed.onlineIntegratedKwh.toFixed(1)} + ${primaryGapCurve.recoveredKwh.toFixed(1)} kWh EDay bridge`
              : hasOutageGap
                ? `Online curve: ${primaryParsed.onlineIntegratedKwh.toFixed(1)} kWh (Wi-Fi gap)`
                : primaryLedger?.dipReasonLabel || formatIndianDate(selectedDate, 'weekday'),
          };

    const col2: PerformanceKpiColumn = isDaylightToday
      ? {
          eyebrow: 'Expected Target',
          accentDot: 'sky',
          primary: `~${canonicalSnapshot.today.expectedSoFarKwh.toFixed(1)} kWh`,
          primaryUnit: 'till now',
          primaryTone: 'sky',
          rightMeta: `${dayStatsModel.effectivePr ? (dayStatsModel.effectivePr * 100).toFixed(0) : canonicalSnapshot.effectivePrBreakdown.prPct}% target`,
          subtitle: `Full day target: ~${canonicalSnapshot.today.fullDayTargetKwh.toFixed(1)} kWh (Clean Sky ${cleanSkyKwh.toFixed(1)})`,
        }
      : {
          eyebrow: 'Expected Target (Full Day)',
          accentDot: 'sky',
          primary: `~${dayStatsModel.targetDailyModelKwh.toFixed(1)} kWh`,
          primaryUnit: 'target',
          primaryTone: 'sky',
          rightMeta: `-${primarySurfaceLossPct.toFixed(1)}% dust`,
          subtitle: `Clean Sky ceiling: ${cleanSkyKwh.toFixed(1)} kWh`,
        };

    const measuredPeakKw = primaryParsed.hasData ? primaryParsed.peakKw : 0;
    const peakLabelKw = measuredPeakKw > 0.05 ? measuredPeakKw : dayStatsModel.peakKw;
    const peakTimeDisplay =
      measuredPeakKw > 0.05
        ? formatMinutes12hUpper(primaryParsed.peakMinutes)
        : dayStatsModel.peakTimeText;
    const specSoFar = safeCapacity > 0 ? (primaryDayEepromKwh / safeCapacity).toFixed(2) : '0.00';
    const specFull =
      safeCapacity > 0 ? (dayStatsModel.targetDailyModelKwh / safeCapacity).toFixed(2) : '0.00';

    const col3: PerformanceKpiColumn = {
      eyebrow: 'Peak Power & Efficiency',
      primary:
        measuredPeakKw > 0.05
          ? `${peakLabelKw.toFixed(2)} kW`
          : `~${peakLabelKw.toFixed(2)} kW`,
      primaryUnit: `@ ${peakTimeDisplay}`,
      rightMeta: dcAcCapLabel,
      subtitle: isDaylightToday
        ? `${specSoFar} → ~${specFull} units/kWp today`
        : `${specSoFar} units/kWp confirmed`,
    };

    let etaPrimary = 'Standby';
    let etaUnit = '';
    let etaSubtitle = `${canonicalSnapshot.directDiffuse.directPct}% Direct Sun · ${canonicalSnapshot.directDiffuse.diffusePct}% Scattered Light`;

    if (isCombined) {
      etaPrimary = `${canonicalSnapshot.effectivePrBreakdown.prPct.toFixed(1)}%`;
      etaUnit = 'fleet efficiency';
      etaSubtitle = 'Select single plant for inverter efficiency';
    } else if (isTodaySelected && canonicalSnapshot.sun.isNight) {
      etaPrimary = 'Standby';
      etaUnit = 'night';
      etaSubtitle = `Zero solar flux · Next dawn ${dayStatsModel.sunriseText}`;
    } else if (isTodaySelected && canonicalSnapshot.truth.isStale && dayWeightedEfficiency.etaPct === null) {
      etaPrimary = 'Pending Upload';
      etaSubtitle = 'Awaiting daytime power samples';
    } else if (dayWeightedEfficiency.etaPct !== null) {
      etaPrimary = `${dayWeightedEfficiency.etaPct.toFixed(1)}%`;
      etaUnit = 'efficiency';
      etaSubtitle = isTodaySelected
        ? `${dayWeightedEfficiency.sampleCount} data points · ${canonicalSnapshot.directDiffuse.directPct}% Direct / ${canonicalSnapshot.directDiffuse.diffusePct}% Scattered`
        : `${dayWeightedEfficiency.sumDcKw.toFixed(1)} → ${dayWeightedEfficiency.sumAcKw.toFixed(1)} kW (${dayWeightedEfficiency.sampleCount} pts)`;
    } else {
      etaPrimary = `${(dayStatsModel.effectivePr * 100).toFixed(1)}%`;
      etaUnit = 'efficiency';
      etaSubtitle = isTodaySelected
        ? `${canonicalSnapshot.directDiffuse.directPct}% Direct Sun · ${canonicalSnapshot.directDiffuse.diffusePct}% Scattered Light`
        : 'DC register archive unavailable';
    }

    const col4: PerformanceKpiColumn = {
      eyebrow: 'Sun & Inverter Efficiency',
      primary: etaPrimary,
      primaryUnit: etaUnit || undefined,
      rightMeta:
        isTodaySelected && canonicalSnapshot.directDiffuse.available
          ? `${canonicalSnapshot.weatherNow.gtiWm2} W/m²`
          : undefined,
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
    const totalPrior = weekBulletBars.reduce((acc, b) => acc + (b.prevPeriodKwh || 0), 0);
    const activeOrBufferedDays = weekBulletBars.filter(
      (b) => !b.isFuture && (b.isConfirmed || (b.bufferKwh || 0) > 1),
    ).length;
    const avgDaily = activeOrBufferedDays > 0 ? totalReconciled / activeOrBufferedDays : 0;
    const capturePct = totalModel > 0.3 ? Math.round((totalReconciled / totalModel) * 100) : null;
    const bestDayItem =
      confirmedItems.toSorted(
        (a, b) => b.realKwh + (b.bufferKwh || 0) - (a.realKwh + (a.bufferKwh || 0)),
      )[0] || null;
    const deltaPriorPct =
      totalPrior > 1 ? Math.round(((totalCloud - totalPrior) / totalPrior) * 100) : null;

    return [
      {
        eyebrow: '7-Day Real Output',
        accentDot: 'emerald',
        primary: `${(totalBuffer > 0.05 ? totalReconciled : totalCloud).toFixed(1)} kWh`,
        primaryUnit: totalBuffer > 0.05 ? 'incl. buffer' : `${confirmedItems.length}d cloud`,
        rightMeta: capturePct !== null ? `${capturePct}% capture` : undefined,
        subtitle:
          totalBuffer > 0.05
            ? `${totalCloud.toFixed(1)} kWh Cloud + ${totalBuffer.toFixed(1)} kWh Outage Buffer`
            : deltaPriorPct !== null
              ? `${deltaPriorPct >= 0 ? '+' : ''}${deltaPriorPct}% vs prior 7 days (${totalPrior.toFixed(1)} kWh)`
              : `₹${Math.round(totalCloud * canonicalSnapshot.config.tariffPerKwh).toLocaleString('en-IN')} est. value`,
      },
      {
        eyebrow: 'Week Physics Target',
        accentDot: 'sky',
        primary: `~${totalModel.toFixed(1)} kWh`,
        primaryTone: 'sky',
        primaryUnit: 'weather-adj',
        subtitle: `Clear-sky ceiling ${weekBulletBars.reduce((a, b) => a + b.idealClearSkyKwh, 0).toFixed(1)} kWh`,
      },
      {
        eyebrow: 'Daily Avg & Best Day',
        primary: `${avgDaily.toFixed(1)} kWh/d`,
        rightMeta: bestDayItem ? `Best ${bestDayItem.shortLabel}` : undefined,
        subtitle: bestDayItem
          ? `Peak day: ${(bestDayItem.realKwh + (bestDayItem.bufferKwh || 0)).toFixed(1)} kWh (${((bestDayItem.realKwh + (bestDayItem.bufferKwh || 0)) / safeCapacity).toFixed(1)}/kWp)`
          : 'No verified days in range',
      },
      {
        eyebrow: 'Attribution Health',
        primary: capturePct !== null ? `${capturePct}%` : '—',
        primaryUnit: 'vs weather',
        rightMeta: `${weekBulletBars.filter((b) => b.dipCategory === 'OPTIMAL').length}/7 optimal`,
        subtitle:
          periodAttribution && periodAttribution.weatherLossKwh > 0.2
            ? `Cloud -${periodAttribution.weatherLossKwh.toFixed(1)} · Dirt -${periodAttribution.hazeAndSoilingLossKwh.toFixed(1)} kWh`
            : `Soiling surface -${canonicalSnapshot.soiling.surfaceLossPct.toFixed(1)}%`,
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
    const mHardwareSynced = isCurrentMonth && canonicalSnapshot.month.hardwareSource === 'waaree-api';
    const mHeadline = mAnchored
      ? canonicalSnapshot.month.physicalTotalKwh
      : Math.max(mTotal, mReconciled, isCurrentMonth ? canonicalSnapshot.month.physicalTotalKwh : 0);
    const mDelta = Math.max(0, +(mHeadline - mTotal).toFixed(2));
    const projected = isCurrentMonth ? canonicalSnapshot.month.projectedKwh : mReconciled;

    return [
      {
        eyebrow: isCurrentMonth ? 'Month-to-Date Output' : 'Monthly Verified Output',
        accentDot: 'emerald',
        primary: `${mAnchored ? mHeadline.toFixed(2) : mHeadline.toFixed(1)} kWh`,
        primaryUnit: mAnchored
          ? mHardwareSynced
            ? 'inverter synced'
            : 'lcd synced'
          : mDelta > 0.05
            ? 'incl. buffer'
            : `${monthSummaryStats.confirmedDays}d cloud`,
        rightMeta:
          monthSummaryStats.capturePct !== null ? `${monthSummaryStats.capturePct}% capture` : undefined,
        subtitle:
          mDelta > 0.05
            ? `${mTotal.toFixed(1)} kWh Cloud + ${mDelta.toFixed(mAnchored ? 2 : 1)} kWh ${mAnchored ? (mHardwareSynced ? 'Inverter Register' : 'LCD Synced') : 'Outage Buffer'}`
            : isCurrentMonth
              ? `Proj: ~${projected} kWh · ₹${Math.round(mHeadline * canonicalSnapshot.config.tariffPerKwh).toLocaleString('en-IN')}`
              : `₹${Math.round(mHeadline * canonicalSnapshot.config.tariffPerKwh).toLocaleString('en-IN')} monthly value`,
      },
      {
        eyebrow: 'Month Physics Model',
        accentDot: 'sky',
        primary: mModel > 0 ? `~${mModel.toFixed(1)} kWh` : 'Archive',
        primaryTone: 'sky',
        primaryUnit: mModel > 0 ? 'verified span' : undefined,
        subtitle: periodAttribution
          ? `Weather -${periodAttribution.weatherLossKwh.toFixed(1)} · Haze/Dirt -${periodAttribution.hazeAndSoilingLossKwh.toFixed(1)} kWh`
          : `${formatIndianMonthYear(selectedMonth)} weather baseline`,
      },
      {
        eyebrow: 'Daily Avg & Best Day',
        primary:
          monthSummaryStats.avgKwh !== null ? `${monthSummaryStats.avgKwh.toFixed(1)} kWh/d` : '—',
        rightMeta: monthSummaryStats.bestDay ? monthSummaryStats.bestDay.shortLabel : undefined,
        subtitle: monthSummaryStats.bestDay
          ? `Best: ${monthSummaryStats.bestDay.realKwh.toFixed(1)} kWh (${(monthSummaryStats.bestDay.realKwh / safeCapacity).toFixed(1)}/kWp)`
          : 'Click any synced day bar to drill in',
      },
      {
        eyebrow: 'Period Capture & Coverage',
        primary:
          monthSummaryStats.capturePct !== null ? `${monthSummaryStats.capturePct}%` : '—',
        primaryUnit: 'capture',
        rightMeta: `${monthSummaryStats.confirmedDays}/${monthSummaryStats.totalRenderedDays} days`,
        subtitle: `Specific ${(mHeadline / Math.max(0.1, safeCapacity)).toFixed(1)} kWh/kWp`,
      },
    ];
  }

  return [
    {
      eyebrow: `${activeYear} Annual Output`,
      accentDot: 'emerald',
      primary: `${yearSummaryStats.totalYearKwh.toFixed(1)} kWh`,
      primaryUnit: `${yearSummaryStats.activeMonthsCount} active mo`,
      subtitle: `Commissioned ${formatIndianDate(resolvedCommissioningYmd, 'medium')}`,
    },
    {
      eyebrow: 'Annual Specific Yield',
      accentDot: 'sky',
      primary: `${yearSummaryStats.specificYieldYear.toFixed(1)}`,
      primaryUnit: 'kWh/kWp',
      primaryTone: 'sky',
      subtitle: `Across ${safeCapacity.toFixed(2)} kWp installed array`,
    },
    {
      eyebrow: 'Peak Production Month',
      primary: yearSummaryStats.bestMonth ? `${yearSummaryStats.bestMonth.realKwh.toFixed(1)} kWh` : '—',
      rightMeta: yearSummaryStats.bestMonth?.label,
      subtitle: yearSummaryStats.bestMonth?.dailyAvgKwh
        ? `Avg ${yearSummaryStats.bestMonth.dailyAvgKwh.toFixed(1)} kWh/d over ${yearSummaryStats.bestMonth.activeDays}d`
        : 'Select an active month bar to inspect',
    },
    {
      eyebrow: 'Estimated Annual Savings',
      primary: `₹${yearSummaryStats.savingsInr.toLocaleString('en-IN')}`,
      rightMeta: `${yearSummaryStats.co2Kg} kg CO₂`,
      subtitle: `@ ₹${canonicalSnapshot.config.tariffPerKwh.toFixed(2)}/kWh · 0.85 kg/kWh CO₂`,
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
