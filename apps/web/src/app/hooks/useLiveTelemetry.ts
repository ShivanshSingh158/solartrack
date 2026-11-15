import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChartData } from 'chart.js';
import {
  buildCanonicalSolarSnapshot,
  getIstClockParts,
  shiftIstDays,
  shiftYmdDays,
  type Account,
  type CombinedSummary,
  type DeviceRealAllData,
  type HistoryReportDataPoint,
  type IstClockParts,
  type LiveFlowData,
  type LiveSyncLastSyncedDay,
  type LiveSyncSnapshot,
  type NewWaareePacketEvent,
  type PersistedAppSettings,
  type PlantAlarmsPayload,
  type RawSeries,
  type SolarIntelligenceReport,
  type SolarWeatherResponse,
  type SinglePlantSummary,
  type TabType,
  type TableRowData,
  type TimescaleMode,
} from '@solar-track/core';
import { ApiService } from '../../shared/api/solarApi';
import { fetchHistoryViewBundle, type HistoryFetchResult } from '../../shared/api/historyFetcher';
import {
  buildDayHistoryView,
  buildMonthHistoryView,
  exportTelemetryCsv,
  type TelemetryCsvExportPayload,
} from '../../shared/utils/historyViewBuilders';
import {
  readCachedSoilingStore,
  writeCachedSoilingStore,
  type CachedSoilingStore,
} from '../../shared/utils/soilingStorage';

const DEFAULT_STATION_ID = '';
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SyncMetaState {
  syncedAtIso: string;
  syncedAtIstLabel: string;
  trigger: string;
  sseConnected: boolean;
  nextPollInSec: number;
  inBackoff: boolean;
  backoffRemainingSec: number;
}

interface UseLiveTelemetryParams {
  activeTab: TabType;
  timescale: TimescaleMode;
  selectedDate: string;
  selectedMonth: string;
  selectedYear: number;
  proMode: boolean;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  setSelectedWeekEndYmd: React.Dispatch<React.SetStateAction<string>>;
  setSelectedMonth: React.Dispatch<React.SetStateAction<string>>;
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>;
  alertsEnabled: boolean;
  plantDisplayName: string | null;
  commissioningDateOverride: string | null;
  resolvedDcDisplayCap: number;
  resolveAcDisplayCap: (summaryCap?: string | number, plantCap?: string | number) => number;
  buildFullPersistedSettings: (resolvedAcDisplayCap: number) => PersistedAppSettings;
  lastCleanedDate: string | null;
  setLastCleanedDate: React.Dispatch<React.SetStateAction<string | null>>;
  applyHydratedSettings: (s: Partial<PersistedAppSettings>) => void;
  setAfterResetHandler: (handler: (() => Promise<void> | void) | null) => void;
}

/**
 * Coordinates Waaree cloud telemetry polling, SSE live stream subscriptions,
 * IST day rollover guards, chart/history fetching, and CanonicalSnapshot assembly.
 */
export function useLiveTelemetry(params: UseLiveTelemetryParams) {
  const {
    activeTab,
    timescale,
    selectedDate,
    selectedMonth,
    selectedYear,
    proMode,
    setSelectedDate,
    setSelectedWeekEndYmd,
    setSelectedMonth,
    setSelectedYear,
    alertsEnabled,
    plantDisplayName,
    commissioningDateOverride,
    resolvedDcDisplayCap,
    resolveAcDisplayCap,
    buildFullPersistedSettings,
    lastCleanedDate,
    setLastCleanedDate,
    applyHydratedSettings,
    setAfterResetHandler,
  } = params;

  const [istClock, setIstClock] = useState<IstClockParts>(() => getIstClockParts());
  const [activeContext, setActiveContext] = useState<string>('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [combinedSummary, setCombinedSummary] = useState<CombinedSummary | null>(null);
  const [singleSummary, setSingleSummary] = useState<SinglePlantSummary | null>(null);
  const [liveFlow, setLiveFlow] = useState<LiveFlowData | null>(null);

  const [monthlyDaysData, setMonthlyDaysData] = useState<Array<{ day: number; yield: number }>>([]);
  const [prevMonthDays, setPrevMonthDays] = useState<HistoryReportDataPoint[]>([]);
  const [selectedMonthDaysState, setSelectedMonthDaysState] = useState<{
    ym: string;
    days: Array<{ day: number; yield: number }>;
  }>({ ym: getIstClockParts().ym, days: [] });
  const [selectedYearMonthsState, setSelectedYearMonthsState] = useState<{
    year: number;
    months: Array<{ month: number; ym: string; label: string; realKwh: number }>;
  }>({ year: getIstClockParts().year, months: [] });

  const [combinedDayRaw, setCombinedDayRaw] = useState<
    Array<{ time: string; value: number; isInterpolated?: boolean }>
  >([]);
  const [todayRawSeries, setTodayRawSeries] = useState<RawSeries[]>([]);
  const [yesterdayRawSeries, setYesterdayRawSeries] = useState<RawSeries[]>([]);
  const [lastSyncedDay, setLastSyncedDay] = useState<LiveSyncLastSyncedDay | null>(null);
  const [weatherData, setWeatherData] = useState<SolarWeatherResponse | null>(null);
  const [intelligenceReport, setIntelligenceReport] = useState<SolarIntelligenceReport | null>(null);
  const [cachedSoilingStore, setCachedSoilingStore] = useState<CachedSoilingStore>(() =>
    readCachedSoilingStore(),
  );

  const [syncMeta, setSyncMeta] = useState<SyncMetaState>({
    syncedAtIso: '',
    syncedAtIstLabel: '',
    trigger: 'initial',
    sseConnected: false,
    nextPollInSec: 65,
    inBackoff: false,
    backoffRemainingSec: 0,
  });
  const [latestNewData, setLatestNewData] = useState<NewWaareePacketEvent | null>(null);
  const [activePacketToast, setActivePacketToast] = useState<NewWaareePacketEvent | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [realElectrical, setRealElectrical] = useState<DeviceRealAllData | null>(null);
  const [hardwareAlarms, setHardwareAlarms] = useState<PlantAlarmsPayload | null>(null);

  const [fetchedHistoryView, setFetchedHistoryView] = useState<{
    key: string;
    chartData: ChartData<'line' | 'bar'>;
    tableRows: TableRowData[];
    peakTimeText: string;
  }>({
    key: '',
    chartData: { labels: [], datasets: [] },
    tableRows: [],
    peakTimeText: '(Solar Noon Est.)',
  });
  const [completedFetchKey, setCompletedFetchKey] = useState<string>('');

  const lastSeenEventIdRef = useRef<string | null>(null);
  const lastIstYmdRef = useRef<string>(istClock.ymd);
  const latestTodayEstKwhRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    latestTodayEstKwhRef.current = weatherData?.todayForecast?.expectedYieldKwh;
  }, [weatherData?.todayForecast?.expectedYieldKwh]);

  const applyAccountsList = useCallback((accs: Account[]) => {
    setAccounts(accs);
    const allPlants = accs.flatMap((a) => a.plants || []);
    if (allPlants.length === 1) {
      setActiveContext(allPlants[0].stationID);
    } else if (allPlants.length >= 2) {
      setActiveContext((prev) => {
        if (!prev || prev === 'combined') return 'combined';
        const exists = allPlants.some((p) => p.stationID === prev);
        return exists ? prev : 'combined';
      });
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const accs = await ApiService.getAccounts();
      applyAccountsList(accs);
    } catch (e) {
      console.error('Error loading accounts:', e);
    }
  }, [applyAccountsList]);

  useEffect(() => {
    let active = true;
    ApiService.getAccounts()
      .then((accs) => {
        if (active) applyAccountsList(accs);
      })
      .catch((e) => console.error('Error loading accounts:', e));
    return () => {
      active = false;
    };
  }, [applyAccountsList]);

  const triggerPacketNotification = useCallback(
    (evt: NewWaareePacketEvent) => {
      if (!evt || !evt.eventId || lastSeenEventIdRef.current === evt.eventId) return;
      lastSeenEventIdRef.current = evt.eventId;
      setLatestNewData(evt);
      if (!alertsEnabled) return;
      setActivePacketToast(evt);
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification('Waaree Solar Telemetry Updated', {
            body: `${evt.reason} (${evt.detectedAtIst})`,
          });
        } catch {
          // Ignore browser desktop notification failures
        }
      }
    },
    [alertsEnabled],
  );

  const applyLiveSyncSnapshot = useCallback(
    (snap: LiveSyncSnapshot | null) => {
      if (!snap || snap.errno !== 0) return;

      if (snap.istClock) {
        const fresh = getIstClockParts();
        setIstClock((prevClock) => {
          if (prevClock.ymd !== snap.istClock.ymd) {
            setSelectedDate((curSel) =>
              curSel === shiftIstDays(-1).ymd || curSel < snap.istClock.yesterdayYmd
                ? snap.istClock.yesterdayYmd
                : curSel,
            );
            setSelectedMonth((curM) => (curM !== snap.istClock.ym ? snap.istClock.ym : curM));
          }
          return prevClock.ymd !== fresh.ymd || prevClock.totalMinutes !== fresh.totalMinutes
            ? fresh
            : prevClock;
        });
      }

      if (snap.weather && snap.weather.available) {
        setWeatherData(snap.weather);
      }

      const flowResult = snap.waaree?.flow?.result || null;
      if (snap.waaree?.summary) {
        setSingleSummary(snap.waaree.summary);
        setCombinedSummary(null);
      }
      if (flowResult) {
        setLiveFlow(flowResult);
      }

      if (Array.isArray(snap.waaree?.monthlyDays)) {
        setMonthlyDaysData(
          snap.waaree.monthlyDays.map((d) => ({ day: d.index, yield: parseFloat(String(d.value)) || 0 })),
        );
      }
      if (Array.isArray(snap.waaree?.yearMonths) && snap.waaree.yearMonths.length > 0) {
        const liveYear = snap.istClock?.year || getIstClockParts().year;
        setSelectedYearMonthsState((prev) =>
          prev.year === liveYear || prev.months.length === 0
            ? {
                year: liveYear,
                months: snap.waaree!.yearMonths!.map((d) => ({
                  month: d.index,
                  ym: `${liveYear}-${String(d.index).padStart(2, '0')}`,
                  label: `${MONTH_SHORT_NAMES[d.index - 1] || `M${d.index}`} ${liveYear}`,
                  realKwh: parseFloat(String(d.value)) || 0,
                })),
              }
            : prev,
        );
      }
      if (Array.isArray(snap.waaree?.prevMonthDays)) {
        setPrevMonthDays(snap.waaree.prevMonthDays);
      }
      if (Array.isArray(snap.waaree?.todayRaw)) {
        setTodayRawSeries(snap.waaree.todayRaw);
      }
      if (Array.isArray(snap.waaree?.yesterdayRaw)) {
        setYesterdayRawSeries(snap.waaree.yesterdayRaw);
      }
      setLastSyncedDay(snap.waaree?.lastSyncedDay || null);

      const incomingReal = snap.realElectrical || snap.waaree?.realElectrical || null;
      if (incomingReal) {
        setRealElectrical(incomingReal);
      }
      const incomingAlarms = snap.alarms || snap.waaree?.alarms || null;
      if (incomingAlarms) {
        setHardwareAlarms(incomingAlarms);
      }

      if (snap.intelligenceReport) {
        setIntelligenceReport(snap.intelligenceReport);
        if (snap.intelligenceReport.soiling) {
          setCachedSoilingStore(
            writeCachedSoilingStore(
              snap.stationId || 'default',
              snap.intelligenceReport.generatedAtIstYmd || snap.istClock?.ymd || getIstClockParts().ymd,
              snap.intelligenceReport.soiling,
            ),
          );
        }
        if (snap.intelligenceReport.soiling?.lastClean?.ymd) {
          setLastCleanedDate(snap.intelligenceReport.soiling.lastClean.ymd);
        }
      }

      setSyncMeta((prev) => ({
        ...prev,
        syncedAtIso: snap.syncedAtIso || new Date().toISOString(),
        syncedAtIstLabel: snap.syncedAtIstLabel || prev.syncedAtIstLabel,
        trigger: snap.trigger || prev.trigger,
        nextPollInSec: snap.syncHealth?.nextPollInSec || prev.nextPollInSec,
        inBackoff: Boolean(snap.waaree?.inBackoff),
        backoffRemainingSec: snap.waaree?.backoffRemainingSec || 0,
      }));

      if (snap.events?.newDataDetected && snap.events.latestNewData) {
        triggerPacketNotification(snap.events.latestNewData);
      } else if (snap.events?.latestNewData) {
        setLatestNewData(snap.events.latestNewData);
      }
    },
    [setLastCleanedDate, setSelectedDate, setSelectedMonth, triggerPacketNotification],
  );

  const allPlantsList = useMemo(() => accounts.flatMap((a) => a.plants || []), [accounts]);
  const isMultiPlant = allPlantsList.length >= 2;
  const isCombined = isMultiPlant && activeContext === 'combined';
  const effectiveContext =
    !isMultiPlant && allPlantsList.length > 0
      ? allPlantsList[0].stationID
      : activeContext || DEFAULT_STATION_ID;
  const activePlantObj = useMemo(
    () => allPlantsList.find((p) => p.stationID === effectiveContext) || allPlantsList[0],
    [allPlantsList, effectiveContext],
  );
  const streamStationId =
    allPlantsList.length === 1
      ? allPlantsList[0].stationID
      : activeContext && activeContext !== 'combined'
        ? activeContext
        : DEFAULT_STATION_ID;

  const loadSummary = useCallback(
    async (force = false) => {
      try {
        if (isCombined) {
          const [sum, w] = await Promise.all([
            ApiService.getCombinedSummary(),
            ApiService.getSolarWeather(undefined, undefined, force),
          ]);
          setCombinedSummary(sum);
          setSingleSummary(null);
          if (w && w.available) setWeatherData(w);
        } else {
          const snap = await ApiService.getLiveSync(effectiveContext, force);
          if (snap && snap.errno === 0) {
            applyLiveSyncSnapshot(snap);
          }
        }
      } catch (e) {
        console.error('Error loading synchronized summary:', e);
      }
    },
    [isCombined, effectiveContext, applyLiveSyncSnapshot],
  );

  const applyHistoryResult = useCallback((res: HistoryFetchResult) => {
    if (res.combinedDayRaw) setCombinedDayRaw(res.combinedDayRaw);
    if (res.monthDaysState) setSelectedMonthDaysState(res.monthDaysState);
    if (res.syncCurrentMonthDays) setMonthlyDaysData(res.syncCurrentMonthDays);
    if (res.yearMonthsState) setSelectedYearMonthsState(res.yearMonthsState);
    if (res.view) setFetchedHistoryView({ key: res.key, ...res.view });
    setCompletedFetchKey(res.key);
  }, []);

  const currentHistoryFetchKey = `${effectiveContext}:${isCombined ? 'c' : 's'}:${timescale}:${selectedDate}:${selectedMonth}:${selectedYear}:${proMode ? '1' : '0'}`;
  const needsNetworkHistoryFetch =
    accounts.length > 0 &&
    timescale !== 'week' &&
    (timescale !== 'day' || isCombined);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetchHistoryViewBundle({
        key: currentHistoryFetchKey,
        effectiveContext,
        isCombined,
        timescale,
        selectedDate,
        selectedMonth,
        selectedYear,
        allPlantsList,
        currentYm: istClock.ym,
        currentDay: istClock.day,
        currentYear: istClock.year,
        todayEstKwh: latestTodayEstKwhRef.current,
      });
      applyHistoryResult(res);
    } catch (e) {
      console.error('Error loading history:', e);
    }
  }, [
    currentHistoryFetchKey,
    effectiveContext,
    isCombined,
    timescale,
    selectedDate,
    selectedMonth,
    selectedYear,
    allPlantsList,
    istClock.ym,
    istClock.day,
    istClock.year,
    applyHistoryResult,
  ]);

  // Initial & context-driven summary sync
  useEffect(() => {
    if (accounts.length === 0) return;
    let active = true;
    const run = async () => {
      if (!active) return;
      await loadSummary(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadSummary, accounts.length]);

  useEffect(() => {
    if (!needsNetworkHistoryFetch) return;
    let active = true;
    fetchHistoryViewBundle({
      key: currentHistoryFetchKey,
      effectiveContext,
      isCombined,
      timescale,
      selectedDate,
      selectedMonth,
      selectedYear,
      allPlantsList,
      currentYm: istClock.ym,
      currentDay: istClock.day,
      currentYear: istClock.year,
      todayEstKwh: latestTodayEstKwhRef.current,
    })
      .then((res) => {
        if (active) applyHistoryResult(res);
      })
      .catch((e) => {
        console.error('Error loading history:', e);
        if (active) setCompletedFetchKey(currentHistoryFetchKey);
      });
    return () => {
      active = false;
    };
  }, [
    needsNetworkHistoryFetch,
    currentHistoryFetchKey,
    effectiveContext,
    isCombined,
    timescale,
    selectedDate,
    selectedMonth,
    selectedYear,
    allPlantsList,
    istClock.ym,
    istClock.day,
    istClock.year,
    applyHistoryResult,
  ]);

  // Combined-fleet solar intelligence fetch
  useEffect(() => {
    if (accounts.length === 0 || !isCombined) return;
    let active = true;
    ApiService.getSolarIntelligence(streamStationId, false)
      .then((intel) => {
        if (!active || !intel || intel.errno !== 0 || !intel.report) return;
        setIntelligenceReport(intel.report);
        if (intel.report.soiling) {
          setCachedSoilingStore(
            writeCachedSoilingStore(
              streamStationId,
              intel.report.generatedAtIstYmd || istClock.ymd,
              intel.report.soiling,
            ),
          );
        }
      })
      .catch((err) => console.error('Error loading solar intelligence:', err));
    return () => {
      active = false;
    };
  }, [accounts.length, isCombined, streamStationId, istClock.ymd]);

  // Refresh yearly or combined fleet history automatically when a new Waaree packet arrives
  const prevPacketEventIdRef = useRef<string | null>(null);
  useEffect(() => {
    const evtId = latestNewData?.eventId || null;
    if (!evtId || evtId === prevPacketEventIdRef.current) return;
    const isInitialSeed = prevPacketEventIdRef.current === null;
    prevPacketEventIdRef.current = evtId;
    if (isInitialSeed) return;
    if (accounts.length > 0 && (isCombined || timescale === 'year')) {
      fetchHistoryViewBundle({
        key: currentHistoryFetchKey,
        effectiveContext,
        isCombined,
        timescale,
        selectedDate,
        selectedMonth,
        selectedYear,
        allPlantsList,
        currentYm: istClock.ym,
        currentDay: istClock.day,
        currentYear: istClock.year,
        todayEstKwh: latestTodayEstKwhRef.current,
      })
        .then(applyHistoryResult)
        .catch((e) => console.error('Error refreshing packet history:', e));
    }
  }, [
    latestNewData?.eventId,
    accounts.length,
    isCombined,
    timescale,
    currentHistoryFetchKey,
    effectiveContext,
    selectedDate,
    selectedMonth,
    selectedYear,
    allPlantsList,
    istClock.ym,
    istClock.day,
    istClock.year,
    applyHistoryResult,
  ]);

  const loadSummaryRef = useRef(loadSummary);
  const loadHistoryRef = useRef(loadHistory);
  useEffect(() => {
    loadSummaryRef.current = loadSummary;
    loadHistoryRef.current = loadHistory;
  }, [loadSummary, loadHistory]);

  // SSE stream & visibility wakeup
  useEffect(() => {
    if (isCombined) {
      const interval = setInterval(() => void loadSummaryRef.current(false), 60000);
      return () => clearInterval(interval);
    }

    const evtSource = new EventSource(
      `/api/live/stream?stationID=${encodeURIComponent(streamStationId)}`,
    );

    evtSource.onopen = () => {
      setSyncMeta((prev) => ({ ...prev, sseConnected: true }));
    };

    evtSource.addEventListener('sync_snapshot', (ev) => {
      try {
        const snap = JSON.parse((ev as MessageEvent).data) as LiveSyncSnapshot;
        setSyncMeta((prev) => ({ ...prev, sseConnected: true }));
        applyLiveSyncSnapshot(snap);
      } catch (err) {
        console.error('Failed to parse SSE sync_snapshot:', err);
      }
    });

    evtSource.addEventListener('waaree_new_data', (ev) => {
      try {
        const pkt = JSON.parse((ev as MessageEvent).data) as NewWaareePacketEvent;
        triggerPacketNotification(pkt);
      } catch (err) {
        console.error('Failed to parse SSE waaree_new_data:', err);
      }
    });

    evtSource.addEventListener('day_rollover', () => {
      setIstClock(getIstClockParts());
      void loadHistoryRef.current();
    });

    evtSource.addEventListener('settings_updated', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as {
          settings?: PersistedAppSettings;
          geometryOrLocationChanged?: boolean;
        };
        if (parsed?.settings) {
          applyHydratedSettings(parsed.settings);
        }
        if (parsed?.geometryOrLocationChanged) {
          void loadSummaryRef.current(true);
          void loadHistoryRef.current();
        }
      } catch (err) {
        console.error('Failed to parse SSE settings_updated:', err);
      }
    });

    evtSource.onerror = () => {
      setSyncMeta((prev) => ({ ...prev, sseConnected: false }));
    };

    const fallbackTimer = setInterval(() => {
      if (evtSource.readyState !== EventSource.OPEN) {
        void loadSummaryRef.current(false);
      }
    }, 45000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setIstClock(getIstClockParts());
        void loadSummaryRef.current(false);
      }
    };

    const handleOnline = () => {
      setIstClock(getIstClockParts());
      void loadSummaryRef.current(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleVisibility);

    return () => {
      evtSource.close();
      clearInterval(fallbackTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [isCombined, streamStationId, applyLiveSyncSnapshot, triggerPacketNotification, applyHydratedSettings]);

  // Client-side IST midnight rollover and minute clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      const current = getIstClockParts();
      if (lastIstYmdRef.current !== current.ymd) {
        lastIstYmdRef.current = current.ymd;
        const prevYest = shiftIstDays(-1);
        setSelectedDate((cur) => (cur < prevYest.ymd ? prevYest.ymd : cur));
        setSelectedWeekEndYmd((curW) => (curW < prevYest.ymd ? current.ymd : curW));
        setSelectedMonth((curM) => (curM !== current.ym ? current.ym : curM));
        setSelectedYear((curY) => (curY !== current.year ? current.year : curY));
        setIstClock(current);
        void loadSummary(true);
        void loadHistory();
        return;
      }
      setIstClock((prev) => (prev.totalMinutes !== current.totalMinutes ? current : prev));
    }, 15000);
    return () => clearInterval(timer);
  }, [loadSummary, loadHistory, setSelectedDate, setSelectedMonth, setSelectedWeekEndYmd, setSelectedYear]);

  // Auto-dismiss live packet toast after 12 seconds
  useEffect(() => {
    if (!activePacketToast) return;
    const t = setTimeout(() => setActivePacketToast(null), 12000);
    return () => clearTimeout(t);
  }, [activePacketToast]);

  const handleFullRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const sid = activeContext && activeContext !== 'combined' ? activeContext : undefined;
      await Promise.all([loadAccounts(), loadSummary(true), loadHistory()]);
      if (isCombined) {
        const intelRes = await ApiService.getSolarIntelligence(sid, true).catch(() => null);
        if (intelRes?.errno === 0 && intelRes.report) {
          setIntelligenceReport(intelRes.report);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [activeContext, isCombined, loadAccounts, loadSummary, loadHistory]);

  useEffect(() => {
    setAfterResetHandler(handleFullRefresh);
    return () => setAfterResetHandler(null);
  }, [setAfterResetHandler, handleFullRefresh]);

  // Derive instant in-memory history view from SSE series when available
  const resolvedHistoryView = useMemo(() => {
    if (!isCombined && timescale === 'day') {
      const yesterdayYmd = shiftYmdDays(istClock.ymd, -1);
      const targetRaw =
        selectedDate === istClock.ymd
          ? todayRawSeries
          : selectedDate === yesterdayYmd
            ? yesterdayRawSeries
            : null;
      if (targetRaw && targetRaw.length > 0) {
        return buildDayHistoryView(targetRaw, selectedDate, proMode);
      }
    }
    if (!isCombined && timescale === 'month' && selectedMonth === istClock.ym && monthlyDaysData.length > 0) {
      const monthView = buildMonthHistoryView(
        monthlyDaysData,
        selectedMonth,
        false,
        istClock.ym,
        istClock.day,
        weatherData?.todayForecast?.expectedYieldKwh,
      );
      return {
        ...monthView,
        peakTimeText: fetchedHistoryView.peakTimeText,
      };
    }
    return {
      chartData: fetchedHistoryView.chartData,
      tableRows: fetchedHistoryView.tableRows,
      peakTimeText: fetchedHistoryView.peakTimeText,
    };
  }, [
    isCombined,
    timescale,
    istClock.ymd,
    istClock.ym,
    istClock.day,
    selectedDate,
    selectedMonth,
    proMode,
    todayRawSeries,
    yesterdayRawSeries,
    monthlyDaysData,
    weatherData?.todayForecast?.expectedYieldKwh,
    fetchedHistoryView,
  ]);

  const isChartLoading = needsNetworkHistoryFetch && completedFetchKey !== currentHistoryFetchKey;

  const handleExportCSV = useCallback(
    (customPayload?: TelemetryCsvExportPayload) => {
      exportTelemetryCsv(activeContext, timescale, resolvedHistoryView.tableRows, customPayload);
    },
    [activeContext, timescale, resolvedHistoryView.tableRows],
  );

  const handleIntelligenceReportChange = useCallback(
    (rep: SolarIntelligenceReport) => {
      setIntelligenceReport(rep);
      if (rep?.soiling) {
        setCachedSoilingStore(
          writeCachedSoilingStore(
            streamStationId,
            rep.generatedAtIstYmd || istClock.ymd,
            rep.soiling,
          ),
        );
      }
      if (rep?.soiling?.lastClean?.ymd) {
        setLastCleanedDate(rep.soiling.lastClean.ymd);
      }
    },
    [streamStationId, istClock.ymd, setLastCleanedDate],
  );

  const resolvedAcDisplayCap = resolveAcDisplayCap(singleSummary?.capacity, activePlantObj?.capacity);
  const fullPersistedSettings = useMemo(
    () => buildFullPersistedSettings(resolvedAcDisplayCap),
    [buildFullPersistedSettings, resolvedAcDisplayCap],
  );

  const activeCachedSoiling = useMemo(() => {
    const byStation = cachedSoilingStore.byStation?.[streamStationId];
    if (byStation?.soiling) return byStation.soiling;
    return cachedSoilingStore.latest?.soiling ?? null;
  }, [cachedSoilingStore, streamStationId]);

  const resolvedCommissioningYmd =
    commissioningDateOverride && /^\d{4}-\d{2}-\d{2}$/.test(commissioningDateOverride)
      ? commissioningDateOverride
      : activePlantObj?.createdDate && /^\d{4}-\d{2}-\d{2}/.test(activePlantObj.createdDate)
        ? activePlantObj.createdDate.slice(0, 10)
        : '2026-10-28';

  const snapshotNowDate = useMemo(
    () =>
      new Date(
        Date.UTC(istClock.year, istClock.month - 1, istClock.day, istClock.hours, istClock.minutes, istClock.seconds) -
          330 * 60_000,
      ),
    [istClock],
  );

  const canonicalSnapshot = useMemo(
    () =>
      buildCanonicalSolarSnapshot({
        now: snapshotNowDate,
        settings: fullPersistedSettings,
        summaryData: singleSummary,
        flowData: liveFlow,
        monthDays: monthlyDaysData.map((d) => ({ index: d.day, value: d.yield })),
        prevMonthDays,
        todayRaw: todayRawSeries,
        yesterdayRaw: yesterdayRawSeries,
        lastSyncedDay,
        weatherData,
        intelligenceReport,
        cachedSoiling: activeCachedSoiling,
        lastCleanedDate,
        commissioningYmd: resolvedCommissioningYmd,
        realElectrical,
        alarms: hardwareAlarms,
      }),
    [
      snapshotNowDate,
      fullPersistedSettings,
      singleSummary,
      liveFlow,
      monthlyDaysData,
      prevMonthDays,
      todayRawSeries,
      yesterdayRawSeries,
      lastSyncedDay,
      weatherData,
      intelligenceReport,
      activeCachedSoiling,
      lastCleanedDate,
      resolvedCommissioningYmd,
      realElectrical,
      hardwareAlarms,
    ],
  );

  const headerTitle =
    activeTab === 'settings'
      ? 'System Settings & Preferences'
      : isCombined
        ? 'Combined Fleet Overview'
        : plantDisplayName || activePlantObj?.plantName || 'Solar Station';

  const headerCapacity =
    activeTab === 'settings'
      ? 'Preferences'
      : isCombined
        ? `${(combinedSummary?.totalCapacity || 3.0).toFixed(2)} kWp Fleet`
        : `${resolvedDcDisplayCap.toFixed(2)} kWp DC / ${resolvedAcDisplayCap.toFixed(2)} kW AC`;

  const headerSubtitle =
    activeTab === 'settings'
      ? 'Display, notifications, rooftop satellite GPS, utility parameters, and accounts'
      : isCombined
        ? `Aggregating ${accounts.length} connected account(s) (${allPlantsList.length} plants)`
        : effectiveContext
          ? `Live telemetry from station ID: ${effectiveContext.slice(0, 8)}...`
          : 'Live telemetry connected';

  const todayYield = isCombined ? combinedSummary?.yieldToday ?? 0 : singleSummary?.generationToday ?? 0;
  const monthYield = isCombined ? combinedSummary?.yieldMonth ?? 0 : singleSummary?.generationMonth ?? 0;
  const lifetimeYield = isCombined
    ? combinedSummary?.yieldLifetime ?? 0
    : singleSummary?.generationTotal ?? 0;

  const rawDevAc = parseFloat(liveFlow?.node?.device?.power?.value || '0');
  const rawGenAc = parseFloat(liveFlow?.node?.gen?.power?.value || '0');
  const rawSolDc = parseFloat(liveFlow?.node?.solar?.power?.value || '0');
  const liveInstantPower = isCombined
    ? combinedSummary?.liveInverterPower || 0
    : rawDevAc > 0
      ? rawDevAc
      : rawGenAc > 0
        ? rawGenAc
        : rawSolDc;
  const solarPower = isCombined
    ? combinedSummary?.liveSolarPower || liveInstantPower
    : rawSolDc > 0
      ? rawSolDc
      : liveInstantPower;

  const rawStatusText =
    singleSummary?.lastUpdateDate || combinedSummary?.plants[0]?.statusText || 'Syncing telemetry...';

  const headerRealKw = canonicalSnapshot.truth.isOnline ? canonicalSnapshot.today.liveKw : 0;
  const headerIsNight = canonicalSnapshot.hero.isNight;
  const headerEstimatedKw =
    !headerIsNight && canonicalSnapshot.sun.isDaylightWindow ? canonicalSnapshot.today.expectedKwNow : 0;
  const headerIsEstimatedLive = canonicalSnapshot.hero.isEstimated;

  return {
    istClock,
    activeContext,
    setActiveContext,
    effectiveContext,
    isCombined,
    accounts,
    loadAccounts,
    combinedSummary,
    singleSummary,
    activePlantObj,
    liveFlow,
    monthlyDaysData,
    prevMonthDays,
    selectedMonthDaysState,
    selectedYearMonthsState,
    combinedDayRaw,
    todayRawSeries,
    yesterdayRawSeries,
    lastSyncedDay,
    weatherData,
    intelligenceReport,
    handleIntelligenceReportChange,
    syncMeta,
    latestNewData,
    activePacketToast,
    setActivePacketToast,
    chartData: resolvedHistoryView.chartData,
    tableRows: resolvedHistoryView.tableRows,
    peakTimeText: resolvedHistoryView.peakTimeText,
    isChartLoading,
    isRefreshing,
    isInitialLoading: accounts.length === 0 || !weatherData,
    handleFullRefresh,
    handleExportCSV,
    fullPersistedSettings,
    resolvedCommissioningYmd,
    canonicalSnapshot,
    realElectrical,
    hardwareAlarms,
    headerTitle,
    headerCapacity,
    headerSubtitle,
    todayYield,
    monthYield,
    lifetimeYield,
    liveInstantPower,
    solarPower,
    rawStatusText,
    headerRealKw,
    headerIsNight,
    headerEstimatedKw,
    headerIsEstimatedLive,
  };
}
