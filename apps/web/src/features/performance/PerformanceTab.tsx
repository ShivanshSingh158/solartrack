import React, { useCallback, useMemo, useState } from 'react';
import type { ChartData } from 'chart.js';
import {
  SOLAR_CONSTANTS,
  buildPhysicsModelForDate,
  buildWeekDatesEndingAt,
  computeOnlineWindowOverlapMatch,
  computePeriodEnergyAttribution,
  computeWeightedInverterEfficiency,
  formatIndianDate,
  formatIndianMonthYear,
  getIstClockParts,
  parseRawTelemetry,
  reconstructConfirmedGapCurve,
  shiftYmdDays,
  type CanonicalSolarSnapshot,
  type DailyPerformanceLedgerEntry,
  type IstClockParts,
  type LiveSyncLastSyncedDay,
  type PersistedAppSettings,
  type RawSeries,
  type SolarIntelligenceReport,
  type SolarWeatherResponse,
  type TableRowData,
  type TimescaleMode,
} from '@solar-track/core';
import { PerformanceControlHeader } from './PerformanceControlHeader';
import { PerformanceKpiStrip } from './PerformanceKpiStrip';
import { PerformanceChartStage } from './PerformanceChartStage';
import { WeeklyEnvelopeStrip } from './WeeklyEnvelopeStrip';
import { PerformanceFooterLedgers } from './PerformanceFooterLedgers';
import { PrintPeriodAuditModal } from './PrintPeriodAuditModal';
import { usePerformanceComparisonCache } from './usePerformanceComparisonCache';
import {
  buildMonthBulletBarsAndStats,
  buildWeekBulletBars,
  buildWeekSparkDays,
  buildYearMonthsAndStats,
  hasNonEmptyRaw,
  synthesizeRawFromCombined,
} from './performancePeriodBuilders';
import {
  buildPerformanceAuditSummary,
  buildPerformanceCsvPayload,
  buildPerformanceKpiColumns,
  buildPerformanceTableRows,
  type PerformanceCsvPayload,
} from './performanceKpiAndTableBuilders';

export type { PerformanceCsvPayload };

export interface PerformanceTabProps {
  timescale: TimescaleMode;
  onChangeTimescale: (mode: TimescaleMode) => void;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  selectedWeekEndYmd?: string;
  onChangeWeekEndYmd?: (ymd: string) => void;
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  selectedYear?: number;
  onChangeYear?: (year: number) => void;
  onExportCSV: (customPayload?: PerformanceCsvPayload) => void;
  chartData: ChartData<'line' | 'bar'>;
  tableRows: TableRowData[];
  isLoading: boolean;
  proMode: boolean;
  onToggleProMode: () => void;
  liveAcPower?: number;
  liveDcPower?: number;
  weatherData?: SolarWeatherResponse | null;
  canonicalSnapshot: CanonicalSolarSnapshot;
  intelligenceReport?: SolarIntelligenceReport | null;
  onIntelligenceReportChange?: (report: SolarIntelligenceReport) => void;
  todayRawSeries?: RawSeries[];
  yesterdayRawSeries?: RawSeries[];
  lastSyncedDay?: LiveSyncLastSyncedDay | null;
  monthlyDaysData?: Array<{ day: number; yield: number }>;
  currentMonthDaysData?: Array<{ day: number; yield: number }>;
  prevMonthDaysData?: Array<{ index: number; value: number }>;
  yearlyMonthsData?: Array<{ month: number; ym: string; label: string; realKwh: number }>;
  combinedDayRaw?: Array<{ time: string; value: number; isInterpolated?: boolean }>;
  stationId?: string;
  isCombined?: boolean;
  commissioningYmd?: string;
  istClock?: IstClockParts;
  syncMeta?: {
    syncedAtIstLabel?: string;
    sseConnected?: boolean;
  };
  location?: { name: string; lat: number; lon: number };
  plantCapacity?: number;
  onNavigateToHealth?: () => void;
  onUpdateSettings?: (partial: Partial<PersistedAppSettings>) => Promise<PersistedAppSettings | null>;
  manualGridOffDates?: string[];
}

/**
 * Multi-timescale solar telemetry cockpit: Day 5-min curves, 7-day rolling bullets,
 * Monthly daily audit, and Annual progression.
 */
export const PerformanceTab: React.FC<PerformanceTabProps> = ({
  timescale,
  onChangeTimescale,
  selectedDate,
  onChangeDate,
  selectedWeekEndYmd,
  onChangeWeekEndYmd,
  selectedMonth,
  onChangeMonth,
  selectedYear,
  onChangeYear,
  onExportCSV,
  tableRows: parentTableRows,
  isLoading,
  proMode,
  onToggleProMode,
  weatherData,
  canonicalSnapshot,
  intelligenceReport,
  todayRawSeries = [],
  yesterdayRawSeries = [],
  lastSyncedDay = null,
  monthlyDaysData = [],
  currentMonthDaysData = [],
  prevMonthDaysData = [],
  yearlyMonthsData = [],
  combinedDayRaw = [],
  stationId = '',
  isCombined = false,
  commissioningYmd = '',
  istClock: istClockProp,
  syncMeta,
  location,
  plantCapacity,
  onNavigateToHealth,
  onUpdateSettings: _onUpdateSettings,
  manualGridOffDates = [],
}) => {
  const manualGridOffSet = useMemo(() => new Set(manualGridOffDates), [manualGridOffDates]);
  const istClock = istClockProp || canonicalSnapshot.clock || getIstClockParts();
  const todayYmd = istClock.ymd;
  const yesterdayYmd = shiftYmdDays(todayYmd, -1);
  const safeCapacity =
    plantCapacity && plantCapacity > 0
      ? plantCapacity
      : canonicalSnapshot.config.dcCapacityKwp || canonicalSnapshot.config.capacityKwp;
  const dcCapacityKwp =
    canonicalSnapshot.config.dcCapacityKwp > 0 ? canonicalSnapshot.config.dcCapacityKwp : safeCapacity;
  const acCapacityKw =
    canonicalSnapshot.config.acInverterCapacityKw > 0
      ? canonicalSnapshot.config.acInverterCapacityKw
      : dcCapacityKwp;
  const dcAcCapLabel =
    Math.abs(dcCapacityKwp - acCapacityKw) >= 0.05
      ? `${dcCapacityKwp.toFixed(2)} kWp DC / ${acCapacityKw.toFixed(2)} kW AC`
      : `${dcCapacityKwp.toFixed(2)} kWp`;
  const lat = Number(location?.lat ?? canonicalSnapshot.config.lat) || SOLAR_CONSTANTS.DEFAULT_LAT;
  const lon = Number(location?.lon ?? canonicalSnapshot.config.lon) || SOLAR_CONSTANTS.DEFAULT_LON;
  const resolvedCommissioningYmd =
    commissioningYmd || canonicalSnapshot.config.commissioningYmd || '2026-10-28';

  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [compareDateYmd, setCompareDateYmd] = useState<string | null>(null);
  const [localWeekEndYmd, setLocalWeekEndYmd] = useState<string>(todayYmd);
  const activeWeekEndYmd = selectedWeekEndYmd || localWeekEndYmd;
  const handleWeekEndChange = useCallback(
    (nextYmd: string) => {
      if (onChangeWeekEndYmd) onChangeWeekEndYmd(nextYmd);
      else setLocalWeekEndYmd(nextYmd);
    },
    [onChangeWeekEndYmd],
  );
  const activeYear = selectedYear || istClock.year;
  const handleYearChange = useCallback(
    (y: number) => {
      if (onChangeYear) onChangeYear(y);
    },
    [onChangeYear],
  );

  const [showModelOverlay, setShowModelOverlay] = useState<boolean>(true);
  const showPvDcOverlay = proMode;
  const [showPriorWeekOverlay, setShowPriorWeekOverlay] = useState<boolean>(true);
  const [showClearSkyTicks, setShowClearSkyTicks] = useState<boolean>(true);
  const [showCaptureLineOverlay, setShowCaptureLineOverlay] = useState<boolean>(false);
  const [hoveredWeekYmd, setHoveredWeekYmd] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const {
    dayComparisonByYmd,
    monthAvailabilityByYm,
    requestMonthAvailability,
    isFetchingComparison,
  } = usePerformanceComparisonCache({
    stationId,
    isCombined,
    timescale,
    selectedDate,
    compareDateYmd,
    todayYmd,
    istClock,
    currentMonthDaysData,
    prevMonthDaysData,
  });

  const ledgerByYmd = useMemo(() => {
    const map = new Map<string, DailyPerformanceLedgerEntry>();
    if (intelligenceReport?.dailyLedger) {
      for (const entry of intelligenceReport.dailyLedger) {
        map.set(entry.ymd, entry);
      }
    }
    return map;
  }, [intelligenceReport]);

  const isTodaySelected = selectedDate === todayYmd;
  const primaryLedger = ledgerByYmd.get(selectedDate) || null;
  const primarySurfaceLossPct = isTodaySelected
    ? canonicalSnapshot.soiling.surfaceLossPct
    : primaryLedger?.particleSurfaceLossPct ?? canonicalSnapshot.soiling.surfaceLossPct;

  const primaryPhysicsModel = useMemo(
    () =>
      buildPhysicsModelForDate({
        ymd: selectedDate,
        todayYmd,
        lat,
        lon,
        capacityKwp: safeCapacity,
        ...(canonicalSnapshot.config.physicsOverrides || {}),
        canonicalTodayModel: canonicalSnapshot.todayPhysics.model,
        weatherData,
        histWeather: !isTodaySelected ? dayComparisonByYmd[selectedDate]?.weather : null,
        surfaceLossPct: primarySurfaceLossPct,
      }),
    [
      selectedDate,
      todayYmd,
      lat,
      lon,
      safeCapacity,
      canonicalSnapshot.config.physicsOverrides,
      canonicalSnapshot.todayPhysics.model,
      weatherData,
      isTodaySelected,
      dayComparisonByYmd,
      primarySurfaceLossPct,
    ],
  );

  const primaryRawSeries = useMemo<RawSeries[]>(() => {
    if (isCombined) return synthesizeRawFromCombined(combinedDayRaw);
    if (isTodaySelected) return todayRawSeries;
    const histRaw = dayComparisonByYmd[selectedDate]?.waaree?.rawSeries;
    if (hasNonEmptyRaw(histRaw)) return histRaw!;
    if (selectedDate === yesterdayYmd && hasNonEmptyRaw(yesterdayRawSeries)) return yesterdayRawSeries;
    if (lastSyncedDay?.ymd === selectedDate && hasNonEmptyRaw(lastSyncedDay.raw)) return lastSyncedDay.raw;
    return [];
  }, [
    isCombined,
    combinedDayRaw,
    isTodaySelected,
    todayRawSeries,
    dayComparisonByYmd,
    selectedDate,
    yesterdayYmd,
    yesterdayRawSeries,
    lastSyncedDay,
  ]);

  const primaryParsed = useMemo(
    () => parseRawTelemetry(primaryRawSeries, primaryPhysicsModel.sunriseMin, primaryPhysicsModel.sunsetMin),
    [primaryRawSeries, primaryPhysicsModel.sunriseMin, primaryPhysicsModel.sunsetMin],
  );

  const pvDcParsed = useMemo(() => {
    if (isCombined || !showPvDcOverlay) return null;
    const pvSeries = primaryRawSeries.find((s) => s.variable === 'pvPower');
    if (!pvSeries || !Array.isArray(pvSeries.data) || pvSeries.data.length === 0) return null;
    return parseRawTelemetry(
      [{ variable: 'generationPower', data: pvSeries.data }],
      primaryPhysicsModel.sunriseMin,
      primaryPhysicsModel.sunsetMin,
    );
  }, [isCombined, showPvDcOverlay, primaryRawSeries, primaryPhysicsModel.sunriseMin, primaryPhysicsModel.sunsetMin]);

  const dayWeightedEfficiency = useMemo(
    () => computeWeightedInverterEfficiency(primaryRawSeries),
    [primaryRawSeries],
  );

  const compareRawSeries = useMemo<RawSeries[]>(() => {
    if (!compareDateYmd || isCombined) return [];
    if (compareDateYmd === todayYmd) return todayRawSeries;
    const histRaw = dayComparisonByYmd[compareDateYmd]?.waaree?.rawSeries;
    if (hasNonEmptyRaw(histRaw)) return histRaw!;
    if (compareDateYmd === yesterdayYmd && hasNonEmptyRaw(yesterdayRawSeries)) return yesterdayRawSeries;
    if (lastSyncedDay?.ymd === compareDateYmd && hasNonEmptyRaw(lastSyncedDay.raw)) return lastSyncedDay.raw;
    return [];
  }, [
    compareDateYmd,
    isCombined,
    todayYmd,
    todayRawSeries,
    dayComparisonByYmd,
    yesterdayYmd,
    yesterdayRawSeries,
    lastSyncedDay,
  ]);

  const compareParsed = useMemo(() => {
    if (!compareDateYmd || !hasNonEmptyRaw(compareRawSeries)) return null;
    return parseRawTelemetry(compareRawSeries, primaryPhysicsModel.sunriseMin, primaryPhysicsModel.sunsetMin);
  }, [compareDateYmd, compareRawSeries, primaryPhysicsModel.sunriseMin, primaryPhysicsModel.sunsetMin]);

  const primaryDayEepromKwh: number = useMemo(() => {
    if (isTodaySelected) return Number(canonicalSnapshot.today.displayKwh) || 0;
    const cmpEeprom = dayComparisonByYmd[selectedDate]?.waaree?.eepromKwh;
    if (typeof cmpEeprom === 'number' && cmpEeprom > 0.05) return cmpEeprom;
    if (primaryLedger && typeof primaryLedger.realKwh === 'number' && primaryLedger.realKwh > 0.05) {
      return primaryLedger.realKwh;
    }
    const calList = monthAvailabilityByYm[selectedDate.slice(0, 7)] || [];
    const calHit = calList.find((d) => d.ymd === selectedDate);
    if (calHit && calHit.kwh > 0.05) return calHit.kwh;
    if (primaryParsed.hasData) return primaryParsed.onlineIntegratedKwh;
    return 0;
  }, [
    isTodaySelected,
    canonicalSnapshot.today.displayKwh,
    dayComparisonByYmd,
    selectedDate,
    primaryLedger,
    monthAvailabilityByYm,
    primaryParsed,
  ]);

  const primaryOverlapStats = useMemo(
    () => computeOnlineWindowOverlapMatch(primaryParsed, primaryPhysicsModel),
    [primaryParsed, primaryPhysicsModel],
  );

  const primaryGapCurve = useMemo(() => {
    const isManualGridOff = manualGridOffSet.has(selectedDate) || Boolean(primaryLedger?.isManualGridOff);
    const reconciledBuf = isManualGridOff
      ? 0
      : (canonicalSnapshot.reconciledBufferByYmd[selectedDate] ?? null);
    const eepromForBridge = isTodaySelected ? canonicalSnapshot.today.cloudKwh : primaryDayEepromKwh;

    return reconstructConfirmedGapCurve({
      parsed: primaryParsed,
      physicsModel: primaryPhysicsModel,
      eepromKwh: eepromForBridge,
      acCapacityKw,
      targetBufferOverrideKwh: reconciledBuf,
      ymd: selectedDate,
      todayYmd,
      nowMinutesIst: istClock.totalMinutes,
      isManualGridOff,
    });
  }, [
    primaryParsed,
    primaryPhysicsModel,
    isTodaySelected,
    canonicalSnapshot.today.cloudKwh,
    canonicalSnapshot.reconciledBufferByYmd,
    primaryDayEepromKwh,
    acCapacityKw,
    selectedDate,
    todayYmd,
    istClock.totalMinutes,
    manualGridOffSet,
    primaryLedger?.isManualGridOff,
  ]);

  const bestDayYmd = useMemo(() => {
    let best: { ymd: string; kwh: number } | null = null;
    const pool = monthAvailabilityByYm[selectedDate.slice(0, 7)] || [];
    for (const d of pool) {
      if (d.ymd !== selectedDate && (!best || d.kwh > best.kwh)) {
        best = { ymd: d.ymd, kwh: d.kwh };
      }
    }
    if (!best && canonicalSnapshot.month.bestDayNum) {
      best = {
        ymd: `${istClock.ym}-${String(canonicalSnapshot.month.bestDayNum).padStart(2, '0')}`,
        kwh: canonicalSnapshot.month.bestDayKwh,
      };
    }
    return best && best.kwh > 0.5 ? best.ymd : null;
  }, [monthAvailabilityByYm, selectedDate, canonicalSnapshot.month.bestDayNum, canonicalSnapshot.month.bestDayKwh, istClock.ym]);

  const weekDates = useMemo(
    () => buildWeekDatesEndingAt(activeWeekEndYmd, resolvedCommissioningYmd, todayYmd),
    [activeWeekEndYmd, resolvedCommissioningYmd, todayYmd],
  );

  const weekBulletBars = useMemo(
    () =>
      buildWeekBulletBars({
        weekDates,
        ledgerByYmd,
        currentMonthDaysData,
        monthlyDaysData,
        istYm: istClock.ym,
        selectedMonth,
        monthAvailabilityByYm,
        todayYmd,
        canonicalSnapshot,
        manualGridOffSet,
      }),
    [
      weekDates,
      ledgerByYmd,
      currentMonthDaysData,
      monthlyDaysData,
      istClock.ym,
      selectedMonth,
      monthAvailabilityByYm,
      todayYmd,
      canonicalSnapshot,
      manualGridOffSet,
    ],
  );

  const sparkSunriseMin = canonicalSnapshot.sun.sunriseMin ?? primaryPhysicsModel.sunriseMin;
  const sparkSunsetMin = canonicalSnapshot.sun.sunsetMin ?? primaryPhysicsModel.sunsetMin;
  const weekSparkDays = useMemo(
    () =>
      buildWeekSparkDays({
        weekBulletBars,
        ledgerByYmd,
        dayComparisonByYmd,
        todayYmd,
        yesterdayYmd,
        todayRawSeries,
        yesterdayRawSeries,
        lastSyncedDay,
        weatherData,
        sunriseMin: sparkSunriseMin,
        sunsetMin: sparkSunsetMin,
      }),
    [
      weekBulletBars,
      ledgerByYmd,
      dayComparisonByYmd,
      todayYmd,
      yesterdayYmd,
      todayRawSeries,
      yesterdayRawSeries,
      lastSyncedDay,
      weatherData,
      sparkSunriseMin,
      sparkSunsetMin,
    ],
  );

  const { monthBulletBars, monthAvgKwh, monthSummaryStats } = useMemo(
    () =>
      buildMonthBulletBarsAndStats({
        selectedMonth,
        istClock,
        resolvedCommissioningYmd,
        monthlyDaysData,
        monthAvailabilityByYm,
        todayYmd,
        ledgerByYmd,
        canonicalSnapshot,
        manualGridOffSet,
      }),
    [
      selectedMonth,
      istClock,
      resolvedCommissioningYmd,
      monthlyDaysData,
      monthAvailabilityByYm,
      todayYmd,
      ledgerByYmd,
      canonicalSnapshot,
      manualGridOffSet,
    ],
  );

  const tariffPerKwh = canonicalSnapshot.config.tariffPerKwh;
  const co2FactorKgPerKwh = canonicalSnapshot.config.co2FactorKgPerKwh;
  const currentMonthKwh = Math.max(canonicalSnapshot.month.mtdKwh, canonicalSnapshot.month.physicalTotalKwh);
  const currentMonthActiveDays = canonicalSnapshot.month.activeSyncedDaysCount;

  const { yearMonths, yearSummaryStats } = useMemo(
    () =>
      buildYearMonthsAndStats({
        yearlyMonthsData,
        activeYear,
        resolvedCommissioningYmd,
        currentYm: istClock.ym,
        tariffPerKwh,
        co2FactorKgPerKwh,
        currentMonthKwh,
        currentMonthActiveDays,
        intelligenceReport,
        safeCapacity,
      }),
    [
      yearlyMonthsData,
      activeYear,
      resolvedCommissioningYmd,
      istClock.ym,
      tariffPerKwh,
      co2FactorKgPerKwh,
      currentMonthKwh,
      currentMonthActiveDays,
      intelligenceReport,
      safeCapacity,
    ],
  );

  const periodAttribution = useMemo(() => {
    if (isCombined || !intelligenceReport?.dailyLedger) return null;
    let slice: DailyPerformanceLedgerEntry[] = [];
    if (timescale === 'day') {
      slice = intelligenceReport.dailyLedger.filter((d) => d.ymd === selectedDate);
    } else if (timescale === 'week') {
      const set = new Set(weekDates);
      slice = intelligenceReport.dailyLedger.filter((d) => set.has(d.ymd));
    } else if (timescale === 'month') {
      slice = intelligenceReport.dailyLedger.filter((d) => d.ymd.startsWith(selectedMonth));
    } else {
      const yearStr = String(activeYear);
      slice = intelligenceReport.dailyLedger.filter((d) => d.ymd.startsWith(yearStr));
    }
    if (slice.length === 0) return null;
    return computePeriodEnergyAttribution(slice);
  }, [isCombined, intelligenceReport, timescale, selectedDate, weekDates, selectedMonth, activeYear]);

  const syncedAtIstLabel = syncMeta?.syncedAtIstLabel;
  const hasOutageGap = primaryOverlapStats.hasOutageGap;

  const kpiColumns = useMemo(
    () =>
      buildPerformanceKpiColumns({
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
        currentYm: istClock.ym,
        activeYear,
        yearSummaryStats,
        resolvedCommissioningYmd,
      }),
    [
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
      istClock.ym,
      activeYear,
      yearSummaryStats,
      resolvedCommissioningYmd,
    ],
  );

  const enrichedTableRows = useMemo(
    () =>
      buildPerformanceTableRows({
        timescale,
        isCombined,
        parentTableRows,
        primaryRawSeries,
        selectedDate,
        primaryPhysicsModel,
        weekBulletBars,
        monthBulletBars,
        yearMonths,
      }),
    [
      timescale,
      isCombined,
      parentTableRows,
      primaryRawSeries,
      selectedDate,
      primaryPhysicsModel,
      weekBulletBars,
      monthBulletBars,
      yearMonths,
    ],
  );

  const handleDownloadStructuredCSV = () => {
    onExportCSV(
      buildPerformanceCsvPayload({
        timescale,
        selectedDate,
        activeWeekEndYmd,
        selectedMonth,
        activeYear,
        enrichedTableRows,
        weekBulletBars,
        monthBulletBars,
        yearMonths,
      }),
    );
  };

  const periodKey =
    timescale === 'day'
      ? `${selectedDate}:${compareDateYmd || ''}`
      : timescale === 'week'
        ? activeWeekEndYmd
        : timescale === 'month'
          ? selectedMonth
          : String(activeYear);

  const dayHistWeather = !isTodaySelected ? dayComparisonByYmd[selectedDate]?.weather : null;
  const chartTitle =
    timescale === 'day'
      ? `${formatIndianDate(selectedDate, 'weekday')} · 5-Min Telemetry vs Weather Physics`
      : timescale === 'week'
        ? `7-Day Rolling Comparison · ${formatIndianDate(weekDates[0] || activeWeekEndYmd, 'short')} – ${formatIndianDate(weekDates[weekDates.length - 1] || activeWeekEndYmd, 'medium')}`
        : timescale === 'month'
          ? `${formatIndianMonthYear(selectedMonth)} · Model-Normalized Daily Yield`
          : `${activeYear} Annual Progression`;

  const chartSubtitle =
    timescale === 'day'
      ? `${dcAcCapLabel} · ${canonicalSnapshot.config.arrayTiltDeg.toFixed(1)}° Tilt · ${
          isTodaySelected
            ? canonicalSnapshot.weatherNow.conditionLabel
            : dayHistWeather?.condition || primaryLedger?.dipReasonLabel || 'Satellite Weather'
        }${isFetchingComparison ? ' · Fetching historical curve...' : ''}`
      : timescale === 'week'
        ? `${dcAcCapLabel} · Weather-adjusted targets & dip attribution`
        : timescale === 'month'
          ? `${monthSummaryStats.confirmedDays} synced days · Dashed rule marks ${monthSummaryStats.avgKwh !== null ? `${monthSummaryStats.avgKwh.toFixed(1)} kWh/d` : 'monthly'} average`
          : `Commissioned ${formatIndianDate(resolvedCommissioningYmd, 'medium')} · ${yearSummaryStats.activeMonthsCount} active months`;

  const targetDailyModelKwh = primaryPhysicsModel.targetDailyModelKwh;
  const parsedPointCount = primaryParsed.allPoints.length;
  const primaryDipReasonLabel = primaryLedger?.dipReasonLabel;

  const auditSummary = useMemo(
    () =>
      buildPerformanceAuditSummary({
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
      }),
    [
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
    ],
  );

  return (
    <div className="space-y-0">
      <div className="rounded-3xl apple-glass-static overflow-hidden">
        <PerformanceControlHeader
          timescale={timescale}
          onChangeTimescale={onChangeTimescale}
          selectedDate={selectedDate}
          onChangeDate={onChangeDate}
          compareDateYmd={compareDateYmd}
          onChangeCompareDateYmd={setCompareDateYmd}
          yesterdayYmd={yesterdayYmd}
          bestDayYmd={bestDayYmd}
          lastSyncedYmd={lastSyncedDay?.ymd || null}
          selectedWeekEndYmd={activeWeekEndYmd}
          onChangeWeekEndYmd={handleWeekEndChange}
          selectedMonth={selectedMonth}
          onChangeMonth={onChangeMonth}
          selectedYear={activeYear}
          onChangeYear={handleYearChange}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          commissioningYmd={resolvedCommissioningYmd}
          todayYmd={todayYmd}
          monthAvailabilityByYm={monthAvailabilityByYm}
          onRequestMonthAvailability={requestMonthAvailability}
          onDownloadCSV={handleDownloadStructuredCSV}
          onOpenPrintAudit={() => setIsPrintModalOpen(true)}
          isCombined={isCombined}
        />

        <PerformanceKpiStrip columns={kpiColumns} />

        <PerformanceChartStage
          timescale={timescale}
          periodKey={periodKey}
          viewMode={viewMode}
          isLoading={isLoading || isFetchingComparison}
          isCombined={isCombined}
          capacityKwp={safeCapacity}
          chartTitle={chartTitle}
          chartSubtitle={chartSubtitle}
          showModelOverlay={showModelOverlay}
          onToggleModelOverlay={() => setShowModelOverlay((v) => !v)}
          showPvDcOverlay={showPvDcOverlay}
          onTogglePvDcOverlay={onToggleProMode}
          showPriorWeekOverlay={showPriorWeekOverlay}
          onTogglePriorWeekOverlay={() => setShowPriorWeekOverlay((v) => !v)}
          showClearSkyTicks={showClearSkyTicks}
          onToggleClearSkyTicks={() => setShowClearSkyTicks((v) => !v)}
          showCaptureLineOverlay={showCaptureLineOverlay}
          onToggleCaptureLineOverlay={() => setShowCaptureLineOverlay((v) => !v)}
          selectedDate={selectedDate}
          todayYmd={todayYmd}
          nowMinutesIst={istClock.totalMinutes}
          physicsModel={primaryPhysicsModel}
          primaryParsed={primaryParsed}
          primaryGapCurve={primaryGapCurve}
          pvDcParsed={pvDcParsed}
          compareDateYmd={compareDateYmd}
          compareParsed={compareParsed}
          dayRadiationMjM2={
            isTodaySelected
              ? canonicalSnapshot.sun.todayRadMj
              : dayHistWeather?.radiationMjM2 ?? null
          }
          hasLiveBeacon={
            isTodaySelected &&
            canonicalSnapshot.today.isConfirmed &&
            !canonicalSnapshot.sun.isNight
          }
          bulletBars={timescale === 'week' ? weekBulletBars : monthBulletBars}
          monthAvgKwh={timescale === 'month' ? monthAvgKwh : null}
          hoveredBarYmd={timescale === 'week' ? hoveredWeekYmd : null}
          onHoverBarYmd={setHoveredWeekYmd}
          onSelectDay={(ymd) => {
            onChangeDate(ymd);
            onChangeTimescale('day');
          }}
          yearMonths={yearMonths}
          onSelectMonth={(ym) => {
            onChangeMonth(ym);
            onChangeTimescale('month');
          }}
          tableRows={enrichedTableRows}
        />

        {timescale === 'week' && viewMode === 'chart' && (
          <WeeklyEnvelopeStrip
            days={weekSparkDays}
            hoveredYmd={hoveredWeekYmd}
            onHoverYmd={setHoveredWeekYmd}
            onSelectDay={(ymd) => {
              onChangeDate(ymd);
              onChangeTimescale('day');
            }}
          />
        )}
      </div>

      <PerformanceFooterLedgers
        timescale={timescale}
        periodLabel={auditSummary.title}
        canonicalSnapshot={canonicalSnapshot}
        attribution={periodAttribution}
        dayWeightedEfficiency={dayWeightedEfficiency}
        isCombined={isCombined}
        onNavigateToHealth={onNavigateToHealth || (() => {})}
        isDayViewPastDate={timescale === 'day' && !isTodaySelected}
        daySunStats={
          timescale === 'day' && !isTodaySelected
            ? {
                sunriseText: primaryPhysicsModel.sunriseText,
                sunsetText: primaryPhysicsModel.sunsetText,
                radiationMjM2: dayHistWeather?.radiationMjM2 ?? null,
                condition:
                  dayHistWeather?.condition || primaryLedger?.dipReasonLabel || 'Archived Sky',
                gtiPeakWm2:
                  Array.isArray(dayHistWeather?.hourlyGti) && dayHistWeather.hourlyGti.length > 0
                    ? Math.max(...dayHistWeather.hourlyGti)
                    : null,
                prPct: +(primaryPhysicsModel.effectivePr * 100).toFixed(1),
                surfaceLossPct: primarySurfaceLossPct,
              }
            : null
        }
      />

      <PrintPeriodAuditModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        plantTitle={
          isCombined
            ? 'Combined Solar Fleet'
            : canonicalSnapshot.config.plantDisplayName || 'SolarTrack Rooftop Array'
        }
        locationName={canonicalSnapshot.config.locationName}
        capacityKwp={safeCapacity}
        periodTitle={auditSummary.title}
        timescale={timescale}
        realKwh={auditSummary.realKwh}
        modelKwh={auditSummary.modelKwh}
        capturePct={auditSummary.capturePct}
        confirmedDaysCount={auditSummary.count}
        tariffPerKwh={tariffPerKwh}
        co2FactorKgPerKwh={co2FactorKgPerKwh}
        rows={auditSummary.rows}
      />
    </div>
  );
};
