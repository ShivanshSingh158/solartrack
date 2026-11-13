import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  buildPhysicsModelForDate,
  buildSolarXAxisTicks,
  computeAstronomicalSunTimes,
  computeOnlineWindowOverlapMatch,
  formatDurationHm,
  getIstClockParts,
  parseRawTelemetry,
  reconstructConfirmedGapCurve,
  shiftIstFromYmd,
  shiftYmdDays,
  type CanonicalSolarSnapshot,
  type DailyPerformanceLedgerEntry,
  type DailySolarPhysicsModel,
  type DayComparisonCalendarDay,
  type DayComparisonResponse,
  type IndianSolarPhaseInfo,
  type IstClockParts,
  type LiveNowcastResult,
  type LiveSyncLastSyncedDay,
  type NewWaareePacketEvent,
  type RawSeries,
} from '@solar-track/core';
import {
  fetchDayComparisonCalendarMonth,
  fetchPastDayComparison,
} from '../../shared/api/dayComparisonFetcher';
import {
  buildBridgedSegmentPaths,
  buildCalcCurveGeometry,
  buildHoverInspectionDetails,
  buildRealSegmentPaths,
} from './comparisonChartGeometry';
import type { WeatherPreviewMode } from './SolarAtmosphereStage';

export interface SolarComparisonChartProps {
  stationId: string;
  safeCapacity: number;
  tariffPerKwh: number;
  weatherData: any;
  solarPhase: IndianSolarPhaseInfo;
  displayLiveKw: number;
  todayYield: number;
  todayCloudKwh?: number;
  todayBufferKwh?: number;
  isTodayConfirmed: boolean;
  yesterdayDay: number;
  yesterdayYield: number;
  isYesterdayConfirmed?: boolean;
  lastSyncedDay?: LiveSyncLastSyncedDay | null;
  todayRawSeries?: RawSeries[];
  yesterdayRawSeries?: RawSeries[];
  monthlyDaysData?: Array<{ day: number; yield: number }>;
  plantCommissioningYmd?: string;
  location?: { name: string; lat: number; lon: number };
  istClock?: IstClockParts;
  syncMeta?: {
    syncedAtIstLabel: string;
    trigger: string;
    sseConnected: boolean;
    nextPollInSec: number;
    inBackoff: boolean;
    backoffRemainingSec: number;
  } | null;
  latestNewData?: NewWaareePacketEvent | null;
  isNight: boolean;
  previewMode?: WeatherPreviewMode;
  scrubMinutes?: number;
  isScrubbing?: boolean;
  currentSurfaceLossPct?: number;
  surfaceLossByYmd?: Record<string, number>;
  physicsOverrides?: CanonicalSolarSnapshot['config']['physicsOverrides'];
  canonicalTodayModel?: DailySolarPhysicsModel | null;
  todayNowcast?: LiveNowcastResult | null;
  reconciledBufferByYmd?: Record<string, number>;
  dailyLedger?: DailyPerformanceLedgerEntry[];
  manualGridOffDates?: string[];
  todayCurveSummary?: {
    realYieldFromCurveKwh: number;
    curveStartLabel: string | null;
    curveEndLabel: string | null;
    isPartialCurve: boolean;
  } | null;
  onNavigateToPerformance: (targetYmd?: string) => void;
}

const hasNonEmptyRawSeries = (series?: RawSeries[] | null) =>
  Array.isArray(series) && series.some((s) => Array.isArray(s?.data) && s.data.length > 0);

export function useDayComparisonData(props: SolarComparisonChartProps) {
  const {
    stationId,
    safeCapacity,
    weatherData,
    solarPhase,
    displayLiveKw,
    todayYield,
    todayCloudKwh,
    todayBufferKwh = 0,
    isTodayConfirmed,
    yesterdayYield,
    isYesterdayConfirmed = false,
    lastSyncedDay = null,
    todayRawSeries,
    yesterdayRawSeries,
    monthlyDaysData = [],
    plantCommissioningYmd = '',
    location,
    istClock,
    isNight: _isNight,
    previewMode: _previewMode = 'live',
    scrubMinutes: _scrubMinutes = 720,
    isScrubbing = false,
    currentSurfaceLossPct,
    surfaceLossByYmd,
    physicsOverrides,
    canonicalTodayModel = null,
    todayNowcast = null,
    reconciledBufferByYmd,
    dailyLedger,
    manualGridOffDates = [],
  } = props;

  const uid = useId().replace(/:/g, '');
  const istNow = useMemo(() => istClock || getIstClockParts(), [istClock]);
  const yesterdayIst = useMemo(() => shiftIstFromYmd(istNow.ymd, -1), [istNow.ymd]);
  const todayYmd = istNow.ymd;
  const minDateYmd = /^\d{4}-\d{2}-\d{2}$/.test(plantCommissioningYmd) ? plantCommissioningYmd : shiftIstFromYmd(todayYmd, -365).ymd;
  const maxDateYmd = todayYmd;

  const [selectedYmdRaw, setSelectedYmd] = useState<string>(todayYmd);
  const selectedYmd =
    selectedYmdRaw < minDateYmd ? minDateYmd : selectedYmdRaw > maxDateYmd ? maxDateYmd : selectedYmdRaw;

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  const [historicalByYmd, setHistoricalByYmd] = useState<Record<string, DayComparisonResponse>>({});
  const [settledFetchKey, setSettledFetchKey] = useState<string | null>(null);
  const [fetchedMonthAvailabilityMap, setFetchedMonthAvailabilityMap] = useState<
    Record<string, DayComparisonCalendarDay[]>
  >({});

  const plotContainerRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(820);

  const monthAvailabilityMap = useMemo(() => {
    if (!Array.isArray(monthlyDaysData) || monthlyDaysData.length === 0) {
      return fetchedMonthAvailabilityMap;
    }
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const mapped: DayComparisonCalendarDay[] = monthlyDaysData.map((d) => ({
      ymd: `${istNow.year}-${pad2(istNow.month)}-${pad2(d.day)}`,
      day: d.day,
      kwh: parseFloat((Number(d.yield) || 0).toFixed(2)),
    }));
    return {
      ...fetchedMonthAvailabilityMap,
      [istNow.ym]: mapped,
    };
  }, [fetchedMonthAvailabilityMap, monthlyDaysData, istNow.year, istNow.month, istNow.ym]);

  useEffect(() => {
    const el = plotContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w >= 260) setMeasuredWidth(w);
    };
    updateWidth();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w >= 260) setMeasuredWidth(w);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const requestMonthAvailability = useCallback(
    async (ym: string) => {
      const result = await fetchDayComparisonCalendarMonth(stationId, selectedYmd, ym);
      if (result) {
        setFetchedMonthAvailabilityMap((prev) => ({
          ...prev,
          [result.ym]: result.days,
        }));
      }
    },
    [stationId, selectedYmd]
  );

  useEffect(() => {
    if (!isCalendarOpen || !stationId) return;
    const minYm = minDateYmd.slice(0, 7);
    const targets: string[] = [];
    if (minYm && !monthAvailabilityMap[minYm]) targets.push(minYm);
    if (!monthAvailabilityMap[istNow.ym] && !targets.includes(istNow.ym)) targets.push(istNow.ym);
    if (targets.length === 0) return;

    let cancelled = false;
    Promise.all(targets.map((ym) => fetchDayComparisonCalendarMonth(stationId, selectedYmd, ym))).then(
      (results) => {
        if (cancelled) return;
        const additions: Record<string, DayComparisonCalendarDay[]> = {};
        for (const res of results) {
          if (res) additions[res.ym] = res.days;
        }
        if (Object.keys(additions).length > 0) {
          setFetchedMonthAvailabilityMap((prev) => ({ ...prev, ...additions }));
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [isCalendarOpen, minDateYmd, istNow.ym, monthAvailabilityMap, stationId, selectedYmd]);

  const existingHistorical = selectedYmd !== todayYmd ? historicalByYmd[selectedYmd] : undefined;
  const yesterdayNowSynced =
    selectedYmd === yesterdayIst.ymd &&
    (Boolean(isYesterdayConfirmed) || hasNonEmptyRawSeries(yesterdayRawSeries));
  const existingMissingYesterdayEeprom =
    yesterdayNowSynced &&
    (!existingHistorical?.waaree?.hasEeprom || !hasNonEmptyRawSeries(existingHistorical?.waaree?.rawSeries));
  const needsHistoricalFetch =
    selectedYmd !== todayYmd && (!existingHistorical?.weather || existingMissingYesterdayEeprom);
  const activeFetchKey = needsHistoricalFetch
    ? `${stationId}:${selectedYmd}:${existingMissingYesterdayEeprom ? 'force' : 'cached'}`
    : null;
  const loadingYmd = activeFetchKey && settledFetchKey !== activeFetchKey ? selectedYmd : null;

  useEffect(() => {
    if (!activeFetchKey) return;
    let cancelled = false;
    fetchPastDayComparison(stationId, selectedYmd, existingMissingYesterdayEeprom).then((res) => {
      if (cancelled) return;
      if (res) {
        setHistoricalByYmd((prev) => ({ ...prev, [selectedYmd]: res }));
        if (res.calendar?.ym && Array.isArray(res.calendar.days)) {
          setFetchedMonthAvailabilityMap((prev) => ({
            ...prev,
            [res.calendar!.ym]: res.calendar!.days,
          }));
        }
      }
      setSettledFetchKey(activeFetchKey);
    });
    return () => {
      cancelled = true;
    };
  }, [activeFetchKey, stationId, selectedYmd, existingMissingYesterdayEeprom]);

  const isTodaySelected = selectedYmd === todayYmd;
  const activeHist = !isTodaySelected ? historicalByYmd[selectedYmd] || null : null;

  const lat = Number(location?.lat ?? weatherData?.location?.lat) || 20.5937;
  const lon = Number(location?.lon ?? weatherData?.location?.lon) || 78.9629;
  const rawCity = (location?.name || weatherData?.location?.name || '').trim();
  const cityName = rawCity ? rawCity.split(',')[0].trim() : '';

  const dayWeatherInputs = useMemo(() => {
    if (isTodaySelected) {
      return {
        sunriseIso: weatherData?.todayForecast?.sunrise || null,
        sunsetIso: weatherData?.todayForecast?.sunset || null,
        hourlyGti: Array.isArray(weatherData?.hourly?.globalTiltedIrradiance)
          ? weatherData.hourly.globalTiltedIrradiance.slice(0, 24)
          : [],
        minutely15Gti: Array.isArray(weatherData?.minutely15?.globalTiltedIrradiance)
          ? weatherData.minutely15.globalTiltedIrradiance.slice(0, 96)
          : [],
        radiationMjM2: weatherData?.todayForecast?.radiationMjM2 ?? 15.33,
        condition: weatherData?.todayForecast?.condition || solarPhase.simpleCondition || 'Clear Sky',
        tempMax: weatherData?.todayForecast?.maxTemp ?? null,
        tempMin: weatherData?.todayForecast?.minTemp ?? null,
      };
    }

    const histW = activeHist?.weather;
    const recentPast = weatherData?.pastDays?.[selectedYmd];
    const astroFallback = computeAstronomicalSunTimes(lat, lon, selectedYmd);

    return {
      sunriseIso:
        histW?.sunrise ||
        recentPast?.sunrise ||
        `${selectedYmd}T${String(Math.floor(astroFallback.sunriseMin / 60)).padStart(2, '0')}:${String(
          astroFallback.sunriseMin % 60
        ).padStart(2, '0')}`,
      sunsetIso:
        histW?.sunset ||
        recentPast?.sunset ||
        `${selectedYmd}T${String(Math.floor(astroFallback.sunsetMin / 60)).padStart(2, '0')}:${String(
          astroFallback.sunsetMin % 60
        ).padStart(2, '0')}`,
      hourlyGti:
        Array.isArray(histW?.hourlyGti) && histW.hourlyGti.length >= 24
          ? histW.hourlyGti
          : Array.isArray(recentPast?.hourlyGti) && recentPast.hourlyGti.length >= 24
          ? recentPast.hourlyGti
          : [],
      minutely15Gti:
        Array.isArray(histW?.minutely15Gti) && histW.minutely15Gti.length >= 96
          ? histW.minutely15Gti
          : Array.isArray(recentPast?.minutely15Gti) && recentPast.minutely15Gti.length >= 96
          ? recentPast.minutely15Gti
          : [],
      radiationMjM2: histW?.radiationMjM2 ?? recentPast?.radiationMjM2 ?? 15.23,
      condition: histW?.condition || 'Satellite Archive',
      tempMax: histW?.tempMax ?? null,
      tempMin: histW?.tempMin ?? null,
    };
  }, [isTodaySelected, selectedYmd, weatherData, activeHist, solarPhase.simpleCondition, lat, lon]);

  const activeSurfaceLossPct = isTodaySelected
    ? currentSurfaceLossPct ?? weatherData?.todayForecast?.currentSurfaceLossPct ?? 0
    : surfaceLossByYmd?.[selectedYmd] ?? 0;

  const physicsModel = useMemo(
    () =>
      buildPhysicsModelForDate({
        ymd: selectedYmd,
        todayYmd,
        lat,
        lon,
        capacityKwp: safeCapacity,
        ...(physicsOverrides || {}),
        canonicalTodayModel: isTodaySelected ? canonicalTodayModel : null,
        weatherData,
        histWeather: !isTodaySelected ? activeHist?.weather : null,
        surfaceLossPct: activeSurfaceLossPct,
      }),
    [
      selectedYmd,
      todayYmd,
      lat,
      lon,
      safeCapacity,
      physicsOverrides,
      isTodaySelected,
      canonicalTodayModel,
      weatherData,
      activeHist?.weather,
      activeSurfaceLossPct,
    ]
  );

  const dcCapKwp =
    physicsOverrides?.dcCapacityKwp && physicsOverrides.dcCapacityKwp > 0
      ? physicsOverrides.dcCapacityKwp
      : safeCapacity;
  const acCapKw =
    physicsOverrides?.acInverterCapacityKw && physicsOverrides.acInverterCapacityKw > 0
      ? physicsOverrides.acInverterCapacityKw
      : dcCapKwp;
  const capSummaryLabel =
    Math.abs(dcCapKwp - acCapKw) >= 0.05
      ? `${dcCapKwp.toFixed(2)} kWp DC / ${acCapKw.toFixed(2)} kW AC`
      : `${dcCapKwp.toFixed(1)} kWp`;

  const activeNowMinutes = istNow.totalMinutes;
  const isBeforeSunrise = isTodaySelected && activeNowMinutes < physicsModel.sunriseMin;
  const isAfterSunset = isTodaySelected && activeNowMinutes >= physicsModel.sunsetMin;
  const isDaytimeToday = isTodaySelected && !isBeforeSunrise && !isAfterSunset;

  const effectiveRawSeries = useMemo<RawSeries[]>(() => {
    if (isTodaySelected) {
      return Array.isArray(todayRawSeries) ? todayRawSeries : [];
    }
    if (activeHist?.waaree?.rawSeries && hasNonEmptyRawSeries(activeHist.waaree.rawSeries)) {
      return activeHist.waaree.rawSeries;
    }
    if (selectedYmd === yesterdayIst.ymd && hasNonEmptyRawSeries(yesterdayRawSeries)) {
      return yesterdayRawSeries!;
    }
    if (lastSyncedDay?.ymd === selectedYmd && hasNonEmptyRawSeries(lastSyncedDay.raw)) {
      return lastSyncedDay.raw;
    }
    return [];
  }, [isTodaySelected, selectedYmd, todayRawSeries, activeHist, yesterdayIst.ymd, yesterdayRawSeries, lastSyncedDay]);

  const parsedReal = useMemo(
    () => parseRawTelemetry(effectiveRawSeries, physicsModel.sunriseMin, physicsModel.sunsetMin),
    [effectiveRawSeries, physicsModel.sunriseMin, physicsModel.sunsetMin]
  );

  const overlapStats = useMemo(
    () => computeOnlineWindowOverlapMatch(parsedReal, physicsModel),
    [parsedReal, physicsModel]
  );

  const selectedDayEepromKwh = useMemo(() => {
    if (isTodaySelected) return isTodayConfirmed ? todayYield : 0;
    if (typeof activeHist?.waaree?.eepromKwh === 'number' && activeHist.waaree.eepromKwh > 0) {
      return activeHist.waaree.eepromKwh;
    }
    const ym = selectedYmd.slice(0, 7);
    const list = monthAvailabilityMap[ym] || [];
    const found = list.find((d) => d.ymd === selectedYmd);
    if (found && found.kwh > 0) return found.kwh;
    if (selectedYmd === yesterdayIst.ymd && isYesterdayConfirmed) return yesterdayYield;
    if (lastSyncedDay?.ymd === selectedYmd) return lastSyncedDay.yieldKwh;
    return 0;
  }, [
    isTodaySelected,
    isTodayConfirmed,
    todayYield,
    activeHist,
    selectedYmd,
    monthAvailabilityMap,
    yesterdayIst.ymd,
    isYesterdayConfirmed,
    yesterdayYield,
    lastSyncedDay,
  ]);

  const selectedLedger = useMemo(
    () => (Array.isArray(dailyLedger) ? dailyLedger.find((d) => d.ymd === selectedYmd) ?? null : null),
    [dailyLedger, selectedYmd]
  );
  const selectedManualGridOff =
    manualGridOffDates.includes(selectedYmd) || Boolean(selectedLedger?.isManualGridOff);
  const resolvedTodayCloudKwh =
    typeof todayCloudKwh === 'number' ? todayCloudKwh : Math.max(0, todayYield - todayBufferKwh);
  const selectedTargetBufferKwh = selectedManualGridOff
    ? 0
    : reconciledBufferByYmd?.[selectedYmd] ?? (isTodaySelected ? todayBufferKwh : null);

  const hasConfirmedDayReal = isTodaySelected ? isTodayConfirmed : selectedDayEepromKwh > 0.05 || parsedReal.hasData;
  const confirmedBridgeTotalKwh = isTodaySelected
    ? isTodayConfirmed
      ? resolvedTodayCloudKwh
      : 0
    : selectedDayEepromKwh;

  const gapRecovery = useMemo(
    () =>
      reconstructConfirmedGapCurve({
        parsed: parsedReal,
        physicsModel,
        eepromKwh: confirmedBridgeTotalKwh,
        acCapacityKw: acCapKw,
        surfaceLossPct: activeSurfaceLossPct,
        ymd: selectedYmd,
        todayYmd,
        commissioningYmd: plantCommissioningYmd,
        nowMinutesIst: istNow.totalMinutes,
        isManualGridOff: selectedManualGridOff,
        targetBufferOverrideKwh: selectedTargetBufferKwh,
      }),
    [
      parsedReal,
      physicsModel,
      confirmedBridgeTotalKwh,
      acCapKw,
      activeSurfaceLossPct,
      selectedYmd,
      todayYmd,
      plantCommissioningYmd,
      istNow.totalMinutes,
      selectedManualGridOff,
      selectedTargetBufferKwh,
    ]
  );

  const nowCalcAtPoint = physicsModel.lookupAtMinute(activeNowMinutes);

  const isCompact = measuredWidth < 560;
  const svgW = Math.max(300, measuredWidth);
  const svgH = isCompact ? 248 : 272;
  const plotLeft = isCompact ? 42 : 52;
  const plotRight = svgW - (isCompact ? 14 : 20);
  const plotW = Math.max(120, plotRight - plotLeft);
  const topY = isCompact ? 28 : 34;
  const baselineY = svgH - (isCompact ? 44 : 48);
  const plotH = Math.max(80, baselineY - topY);

  const maxYAxisKw = useMemo(() => {
    const rawMax = Math.max(
      physicsModel.peakKw * 1.16,
      parsedReal.peakKw * 1.14,
      isTodayConfirmed ? displayLiveKw * 1.15 : 0,
      safeCapacity * 0.72,
      2.0
    );
    const step = rawMax > 3.2 ? 1.0 : 0.6;
    return +(Math.ceil(rawMax / step) * step).toFixed(1);
  }, [physicsModel.peakKw, parsedReal.peakKw, isTodayConfirmed, displayLiveKw, safeCapacity]);

  const yTicksKw = useMemo(() => [maxYAxisKw, +(maxYAxisKw / 2).toFixed(1), 0], [maxYAxisKw]);

  const timeToX = useCallback(
    (min: number) =>
      plotLeft + Math.max(0, Math.min(1, (min - physicsModel.sunriseMin) / physicsModel.daylightMin)) * plotW,
    [plotLeft, plotW, physicsModel.sunriseMin, physicsModel.daylightMin]
  );

  const xToTime = useCallback(
    (px: number) => {
      const clamped = Math.max(plotLeft, Math.min(plotRight, px));
      const frac = (clamped - plotLeft) / plotW;
      return physicsModel.sunriseMin + frac * physicsModel.daylightMin;
    },
    [plotLeft, plotRight, plotW, physicsModel.sunriseMin, physicsModel.daylightMin]
  );

  const kwToY = useCallback(
    (kw: number) => baselineY - (Math.max(0, Math.min(maxYAxisKw, kw)) / maxYAxisKw) * plotH,
    [baselineY, maxYAxisKw, plotH]
  );

  const calcGeometry = useMemo(
    () =>
      buildCalcCurveGeometry({
        physicsModel,
        timeToX,
        kwToY,
        topY,
        baselineY,
        isDaytimeToday,
        isScrubbing,
        todayNowcast,
        activeNowMinutes,
        nowCalcKw: nowCalcAtPoint.kw,
      }),
    [physicsModel, timeToX, kwToY, topY, baselineY, isDaytimeToday, isScrubbing, todayNowcast, activeNowMinutes, nowCalcAtPoint.kw]
  );

  const { realSegmentPaths, singleDotPoints } = useMemo(
    () =>
      buildRealSegmentPaths({
        parsedReal,
        timeToX,
        kwToY,
        topY,
        baselineY,
        isTodaySelected,
        isTodayConfirmed,
        displayLiveKw,
        isDaytimeToday,
        activeNowMinutes,
      }),
    [parsedReal, timeToX, kwToY, topY, baselineY, isTodaySelected, isTodayConfirmed, displayLiveKw, isDaytimeToday, activeNowMinutes]
  );

  const bridgedSegmentPaths = useMemo(
    () => buildBridgedSegmentPaths({ gapRecovery, timeToX, kwToY, topY, baselineY }),
    [gapRecovery, timeToX, kwToY, topY, baselineY]
  );

  const sunX = timeToX(activeNowMinutes);
  const sunY = isDaytimeToday
    ? kwToY(isTodayConfirmed && displayLiveKw > 0 ? displayLiveKw : nowCalcAtPoint.kw)
    : baselineY;
  const sunLiveLabel =
    isTodayConfirmed && displayLiveKw > 0
      ? `${displayLiveKw.toFixed(2)} kW`
      : `~${nowCalcAtPoint.kw.toFixed(2)} kW`;

  const xTicks = useMemo(() => {
    const raw = buildSolarXAxisTicks(physicsModel.sunriseMin, physicsModel.sunsetMin, isCompact);
    const filteredInterior = raw.interior.filter((t) => {
      if (!isDaytimeToday) return true;
      const distFromNow = Math.abs(timeToX(t.minutes) - sunX);
      return distFromNow >= (isCompact ? 42 : 54);
    });
    return { ...raw, interior: filteredInterior };
  }, [physicsModel.sunriseMin, physicsModel.sunsetMin, isCompact, isDaytimeToday, timeToX, sunX]);

  const hoverDetails = useMemo(
    () =>
      buildHoverInspectionDetails({
        hoverMin,
        physicsModel,
        parsedReal,
        gapRecovery,
        isTodaySelected,
        isTodayConfirmed,
        displayLiveKw,
        activeNowMinutes,
        isDaytimeToday,
        isScrubbing,
        todayNowcast,
        acCapKw,
        todayYield,
        timeToX,
        kwToY,
      }),
    [
      hoverMin,
      physicsModel,
      parsedReal,
      gapRecovery,
      isTodaySelected,
      isTodayConfirmed,
      displayLiveKw,
      activeNowMinutes,
      isDaytimeToday,
      isScrubbing,
      todayNowcast,
      acCapKw,
      todayYield,
      timeToX,
      kwToY,
    ]
  );

  const updateHoverFromPointer = (clientX: number) => {
    const el = plotContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHoverMin(xToTime(clientX - rect.left));
  };

  const daylightElapsedPct = isBeforeSunrise
    ? 0
    : isAfterSunset
    ? 100
    : Math.max(0, Math.min(100, Math.round(((activeNowMinutes - physicsModel.sunriseMin) / physicsModel.daylightMin) * 100)));

  const remainingSunText = formatDurationHm(Math.max(0, physicsModel.sunsetMin - activeNowMinutes));
  const minsUntilSunriseText = formatDurationHm(Math.max(0, physicsModel.sunriseMin - activeNowMinutes));

  const selectedBufferKwh = selectedManualGridOff
    ? 0
    : isTodaySelected
    ? todayBufferKwh
    : Math.max(0, reconciledBufferByYmd?.[selectedYmd] ?? gapRecovery.bufferedKwh);
  const selectedReconciledTotalKwh = isTodaySelected
    ? todayYield
    : +(selectedDayEepromKwh + selectedBufferKwh).toFixed(2);

  const dailyMatchPct =
    !isTodaySelected && selectedReconciledTotalKwh > 0.05 && physicsModel.targetDailyModelKwh > 0.2
      ? Math.round((selectedReconciledTotalKwh / physicsModel.targetDailyModelKwh) * 100)
      : isTodaySelected && isTodayConfirmed && nowCalcAtPoint.cumKwh > 0.1
      ? Math.round((todayYield / nowCalcAtPoint.cumKwh) * 100)
      : null;

  const liveCapturePct =
    isTodayConfirmed && nowCalcAtPoint.kw > 0.05 ? Math.round((displayLiveKw / nowCalcAtPoint.kw) * 100) : null;

  const canStepPrev = selectedYmd > minDateYmd;
  const canStepNext = selectedYmd < maxDateYmd;
  const handleStepDate = (delta: number) => {
    const next = shiftYmdDays(selectedYmd, delta);
    if (next < minDateYmd || next > maxDateYmd) return;
    setHoverMin(null);
    setSelectedYmd(next);
  };

  const handleSelectDate = (ymd: string) => {
    setHoverMin(null);
    setSelectedYmd(ymd);
  };

  const inspectableLastSyncedYmd =
    lastSyncedDay?.ymd && lastSyncedDay.ymd >= minDateYmd && lastSyncedDay.ymd < todayYmd
      ? lastSyncedDay.ymd
      : null;

  return {
    uid,
    plotContainerRef,
    selectedYmd,
    todayYmd,
    yesterdayYmd: yesterdayIst.ymd,
    minDateYmd,
    maxDateYmd,
    loadingYmd,
    cityName,
    capSummaryLabel,
    dayCondition: dayWeatherInputs.condition,
    radiationMjM2: dayWeatherInputs.radiationMjM2,
    physicsModel,
    isTodaySelected,
    canStepPrev,
    canStepNext,
    handleStepDate,
    isCalendarOpen,
    setIsCalendarOpen,
    inspectableLastSyncedYmd,
    monthAvailabilityMap,
    requestMonthAvailability,
    handleSelectDate,
    hasConfirmedDayReal,
    isBeforeSunrise,
    isAfterSunset,
    isDaytimeToday,
    parsedReal,
    resolvedTodayCloudKwh,
    gapRecovery,
    selectedDayEepromKwh,
    selectedReconciledTotalKwh,
    selectedBufferKwh,
    overlapStats,
    selectedManualGridOff,
    activeNowMinutes,
    nowCalcAtPoint,
    minsUntilSunriseText,
    liveCapturePct,
    daylightElapsedPct,
    dailyMatchPct,
    remainingSunText,
    svgW,
    svgH,
    isCompact,
    plotLeft,
    plotRight,
    plotW,
    topY,
    baselineY,
    plotH,
    sunX,
    sunY,
    sunLiveLabel,
    realSegmentPaths,
    singleDotPoints,
    bridgedSegmentPaths,
    calcGeometry,
    yTicksKw,
    xTicks,
    hoverDetails,
    timeToX,
    kwToY,
    updateHoverFromPointer,
    clearHover: () => setHoverMin(null),
  };
}
