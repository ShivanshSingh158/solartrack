import React, { useState, useEffect, useMemo } from 'react';
import { FileText, FileCheck2, ArrowRight, ZapOff } from 'lucide-react';
import {
  buildCanonicalSolarSnapshot,
  formatMinutes12hUpper,
  getIndianSolarPhase,
  getIstClockParts,
  shiftIstFromYmd,
  type CanonicalSolarSnapshot,
  type DailySolarPhysicsModel,
  type IndianSolarPhaseInfo,
  type IstClockParts,
  type LiveSyncLastSyncedDay,
  type NewWaareePacketEvent,
  type PersistedAppSettings,
  type SolarIntelligenceReport,
  type SolarIntelligenceResponse,
} from '@solar-track/core';
import { ApiService } from '../../shared/api/solarApi';
import { DailyReportCardModal } from '../modals/DailyReportCardModal';
import { SolarIntelligenceModal } from '../modals/SolarIntelligenceModal';
import { OverviewKpiStrip } from './OverviewKpiStrip';
import { PanelHygieneCard } from './PanelHygieneCard';
import { SatellitePhysicsModal } from './SatellitePhysicsModal';
import { SolarAtmosphereStage } from './SolarAtmosphereStage';
import { SolarComparisonChart } from './SolarComparisonChart';
import { TomorrowOutlookCard } from './TomorrowOutlookCard';
import { WeeklyPerformanceLedgerCard } from './WeeklyPerformanceLedgerCard';

export interface OverviewTabProps {
  livePower: number;
  solarDcPower?: number;
  todayYield: number;
  yesterdayYieldOverride?: number | null;
  monthYield: number;
  lifetimeYield: number;
  plantCapacity: number;
  tariffPerKwh: number;
  lastUpdateText?: string;
  stationId?: string;
  plantCommissioningYmd?: string;
  onNavigateToPerformance: (targetYmd?: string) => void;
  recent7DaysData?: Array<{ day: number; yield: number }>;
  monthlyDaysData?: Array<{ day: number; yield: number }>;
  weatherData?: any;
  todayRawSeries?: any[];
  yesterdayRawSeries?: any[];
  lastSyncedDay?: LiveSyncLastSyncedDay | null;
  istClock?: IstClockParts;
  syncMeta?: {
    syncedAtIstLabel: string;
    trigger: string;
    sseConnected: boolean;
    nextPollInSec: number;
    inBackoff: boolean;
    backoffRemainingSec: number;
  };
  latestNewData?: NewWaareePacketEvent | null;
  currentLocation?: { name: string; lat: number; lon: number };
  onOpenLocationEdit?: () => void;
  peakTimeText?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  canonicalSnapshot?: CanonicalSolarSnapshot;
  intelligenceReport?: SolarIntelligenceReport | null;
  onIntelligenceReportChange?: (rep: SolarIntelligenceReport) => void;
  onUpdateSettings?: (partial: Partial<PersistedAppSettings>) => Promise<PersistedAppSettings | null>;
  manualGridOffDates?: string[];
}

function extractPeakFromRawSeries(rawSeries?: any[]): { peakKw: number; peakTimeLabel: string } | null {
  if (!Array.isArray(rawSeries) || rawSeries.length === 0) return null;
  const gen = rawSeries.find((s) => s.variable === 'generationPower') || rawSeries.find((s) => s.variable === 'pvPower');
  const pts = Array.isArray(gen?.data) ? gen.data : [];
  if (pts.length === 0) return null;
  let peakKw = 0;
  let peakTime = '';
  for (const pt of pts) {
    const val = parseFloat(pt?.value) || 0;
    if (val > peakKw) {
      peakKw = val;
      peakTime = String(pt?.time || '');
    }
  }
  if (peakKw <= 0) return null;
  const m = peakTime.match(/(\d{2}):(\d{2}):\d{2}/);
  let label = peakTime;
  if (m) {
    const hh = parseInt(m[1], 10);
    const mm = m[2];
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    label = `${String(h12).padStart(2, '0')}:${mm} ${ampm}`;
  }
  return { peakKw: +peakKw.toFixed(2), peakTimeLabel: label };
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  livePower,
  solarDcPower,
  todayYield,
  yesterdayYieldOverride = null,
  monthYield,
  lifetimeYield,
  plantCapacity = 3.0,
  tariffPerKwh = 8.0,
  lastUpdateText = '',
  stationId = '',
  plantCommissioningYmd = '',
  onNavigateToPerformance,
  recent7DaysData = [],
  monthlyDaysData = [],
  weatherData: syncedWeatherData = null,
  todayRawSeries = [],
  yesterdayRawSeries = [],
  lastSyncedDay = null,
  istClock: propIstClock,
  syncMeta,
  latestNewData = null,
  currentLocation,
  onOpenLocationEdit,
  canonicalSnapshot: propCanonicalSnapshot,
  intelligenceReport: propIntelligenceReport,
  onIntelligenceReportChange,
  manualGridOffDates = [],
}) => {
  const istNow = useMemo(() => propIstClock || getIstClockParts(), [propIstClock]);
  const yesterdayIst = useMemo(() => shiftIstFromYmd(istNow.ymd, -1), [istNow.ymd]);
  const tomorrowIst = useMemo(() => shiftIstFromYmd(istNow.ymd, 1), [istNow.ymd]);

  const [solarPhase, setSolarPhase] = useState<IndianSolarPhaseInfo>(() => getIndianSolarPhase());
  const [intelligenceRes, setIntelligenceRes] = useState<SolarIntelligenceResponse | null>(null);
  const [isCleaningSaving, setIsCleaningSaving] = useState(false);
  const [isIntelligenceModalOpen, setIsIntelligenceModalOpen] = useState(false);
  const [fallbackWeatherData, setFallbackWeatherData] = useState<any>(null);
  const [isReportCardOpen, setIsReportCardOpen] = useState(false);
  const [reportSelectedYmd, setReportSelectedYmd] = useState<string>('');
  const [reportRealPoints, setReportRealPoints] = useState<Array<{ minute: number; kw: number }> | null>(null);
  const [reportYieldKwh, setReportYieldKwh] = useState<number | null>(null);
  const [reportPhysicsModel, setReportPhysicsModel] = useState<DailySolarPhysicsModel | null>(null);
  const [isPhysicsModalOpen, setIsPhysicsModalOpen] = useState(false);
  const [livePeakStamp, setLivePeakStamp] = useState<{
    ymd: string;
    peakKw: number;
    peakTimeLabel: string;
  } | null>(null);

  const weatherData = syncedWeatherData || fallbackWeatherData;
  const effectiveMonthlyDays = monthlyDaysData.length > 0 ? monthlyDaysData : recent7DaysData;

  useEffect(() => {
    const timer = setInterval(() => {
      setSolarPhase(getIndianSolarPhase(new Date(), weatherData));
    }, 1000);
    return () => clearInterval(timer);
  }, [weatherData]);

  const hasSyncedWeather = Boolean(syncedWeatherData);
  const hasPropIntelligence = Boolean(propIntelligenceReport);

  useEffect(() => {
    if (hasSyncedWeather && hasPropIntelligence) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const [intel, fallbackW] = await Promise.all([
          !hasPropIntelligence ? ApiService.getSolarIntelligence(stationId) : Promise.resolve(null),
          !hasSyncedWeather ? ApiService.getSolarWeather() : Promise.resolve(null),
        ]);
        if (active && intel) {
          setIntelligenceRes(intel);
          if (intel.report) onIntelligenceReportChange?.(intel.report);
        }
        if (active && fallbackW?.available) {
          setFallbackWeatherData(fallbackW);
        }
      } catch (e) {
        console.error('Error loading fallback solar intelligence:', e);
      }
    }, 1500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [stationId, hasSyncedWeather, hasPropIntelligence, onIntelligenceReportChange]);

  const confirmedActiveDays = useMemo(
    () => effectiveMonthlyDays.filter((d) => (d.yield || 0) > 0),
    [effectiveMonthlyDays]
  );

  const handleRefreshIntelligence = async () => {
    const intel = await ApiService.getSolarIntelligence(stationId, true);
    if (intel) {
      setIntelligenceRes(intel);
      if (intel.report) onIntelligenceReportChange?.(intel.report);
    }
  };

  const handleLogWash = async (targetDateYmd?: string, note?: string): Promise<boolean> => {
    setIsCleaningSaving(true);
    try {
      const updated = await ApiService.markPanelsCleaned(
        targetDateYmd || istNow.ymd,
        note || `Washed panels (${targetDateYmd || istNow.ymd})`,
        'add'
      );
      if (updated) {
        const refreshed = await ApiService.getSolarIntelligence(stationId, true);
        if (refreshed) {
          setIntelligenceRes(refreshed);
          if (refreshed.report) onIntelligenceReportChange?.(refreshed.report);
        }
        return true;
      }
      return false;
    } finally {
      setIsCleaningSaving(false);
    }
  };

  const handleRemoveWash = async (targetDateYmd: string) => {
    setIsCleaningSaving(true);
    try {
      const updated = await ApiService.markPanelsCleaned(targetDateYmd, undefined, 'remove');
      if (updated) {
        const refreshed = await ApiService.getSolarIntelligence(stationId, true);
        if (refreshed) {
          setIntelligenceRes(refreshed);
          if (refreshed.report) onIntelligenceReportChange?.(refreshed.report);
        }
      }
    } finally {
      setIsCleaningSaving(false);
    }
  };

  const safeCapacity = propCanonicalSnapshot?.config.capacityKwp ?? (plantCapacity > 0 ? plantCapacity : 3.0);
  const effectiveIntelligenceReport = propIntelligenceReport ?? intelligenceRes?.report ?? null;

  const snap = useMemo<CanonicalSolarSnapshot>(() => {
    if (propCanonicalSnapshot) return propCanonicalSnapshot;
    return buildCanonicalSolarSnapshot({
      settings: {
        tariffPerKwh,
        systemCost: 185000,
        systemCapacity: safeCapacity,
        billingCycleDay: 1,
        tempUnit: 'C',
        plantLocation: currentLocation,
        physicalEtotalKwh: null,
        physicalEtotalCloudRefKwh: null,
        physicalEtotalSetAtYmd: null,
        physicalEtotalSetAtMin: null,
        physicalEmonthKwh: null,
        physicalEmonthCloudRefKwh: null,
        physicalEmonthYm: null,
        physicalEmonthSetAtYmd: null,
        physicalEmonthSetAtMin: null,
        manualGridOffDates,
      },
      summaryData: {
        generationToday: todayYield,
        generationYesterday: yesterdayYieldOverride ?? 0,
        generationMonth: monthYield,
        generationTotal: lifetimeYield,
        hardwareMonthKwh: null,
        hardwareTotalKwh: null,
        hardwareSyncedYmd: null,
        hardwareSyncedLabel: null,
        lastUpdateDate: lastUpdateText,
        capacity: String(safeCapacity),
      } as any,
            flowData: {
              node: {
                solar: { power: { value: String(solarDcPower ?? livePower) } },
                device: { power: { value: String(livePower) } },
              },
              status: {
                yieldToday: String(todayYield),
                lastUpdateDate: lastUpdateText,
                state: 1,
              },
            } as any,
            monthDays: effectiveMonthlyDays.map((d) => ({ index: d.day, value: d.yield })),
            todayRaw: todayRawSeries,
            yesterdayRaw: yesterdayRawSeries,
            lastSyncedDay,
            weatherData,
            intelligenceReport: effectiveIntelligenceReport,
            commissioningYmd: plantCommissioningYmd,
          });
    },
    [
      propCanonicalSnapshot,
      tariffPerKwh,
      safeCapacity,
      currentLocation,
      manualGridOffDates,
      todayYield,
      yesterdayYieldOverride,
      monthYield,
      lifetimeYield,
      lastUpdateText,
      livePower,
      solarDcPower,
      effectiveMonthlyDays,
      todayRawSeries,
      yesterdayRawSeries,
      lastSyncedDay,
      weatherData,
      effectiveIntelligenceReport,
      plantCommissioningYmd,
    ]
  );

  const truth = snap.truth;
  const effectivePower = truth.safeGenerationKw !== null ? truth.safeGenerationKw : 0;
  const hasLiveHardwareGen = effectivePower > 0.05;
  const pm10Real = snap.soiling.pm10;
  const dustReal = weatherData?.current?.dust ?? 22;
  const usAqiReal = snap.soiling.usAqi;
  const currentSurfaceLossPct = snap.soiling.surfaceLossPct;

  const surfaceLossByYmd = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of effectiveIntelligenceReport?.dailyLedger ?? []) {
      map[row.ymd] = row.particleSurfaceLossPct;
    }
    return map;
  }, [effectiveIntelligenceReport]);

  const effectiveHeroMinute = istNow.totalMinutes;
  const { model: canonicalPhysicsModel, current: canonicalPhysicsNow } = snap.todayPhysics;
  const { isDaylightWindow: canonicalDaylightWindow } = snap.sun;
  const todayPhysics = {
    model: canonicalPhysicsModel,
    current: {
      kw: canonicalPhysicsNow.kwNow,
      cumKwh: canonicalPhysicsNow.cumKwh,
      gti: canonicalPhysicsNow.gti,
    },
    isDaylightWindow: canonicalDaylightWindow,
  };

  const isNight =
    truth.status === 'NIGHT_SLEEP' ||
    (!hasLiveHardwareGen &&
      (weatherData?.current?.isDay === false || !todayPhysics.isDaylightWindow));

  const modelKwNow = !isNight && todayPhysics.isDaylightWindow ? todayPhysics.current.kw : 0;
  const realKwNow = effectivePower;
  const displayModelKw = modelKwNow;
  const displayLiveKw = snap.truth.isOnline ? snap.hero.displayedKw : displayModelKw;
  const isEstimatedLive = snap.hero.isEstimated;
  const isHardwareFault = snap.truth.isFault;

  const yesterdayConfirmedYield = snap.yesterday.isConfirmed ? snap.yesterday.displayKwh : 0;
  const isYesterdayConfirmed = snap.yesterday.isConfirmed;
  const yesterdayEstYield = snap.yesterday.expectedKwh;
  const yesterdayPeakInfo = useMemo(() => extractPeakFromRawSeries(yesterdayRawSeries), [yesterdayRawSeries]);
  const todayPeakInfo = useMemo(() => extractPeakFromRawSeries(todayRawSeries), [todayRawSeries]);

  const highestConfirmedDayInMonth = confirmedActiveDays[confirmedActiveDays.length - 1]?.day || 0;
  const lastSyncedBenchmarkYield =
    snap.yesterday.lastSyncedKwh ??
    lastSyncedDay?.yieldKwh ??
    confirmedActiveDays[confirmedActiveDays.length - 1]?.yield ??
    0;
  const lastSyncedBenchmarkLabel =
    snap.yesterday.lastSyncedLabel ||
    lastSyncedDay?.shortLabel ||
    (highestConfirmedDayInMonth > 0 ? `${istNow.monthShort} ${highestConfirmedDayInMonth}` : yesterdayIst.shortLabel);

  const lastSyncedRate = +(lastSyncedBenchmarkYield / safeCapacity).toFixed(2);

  const todayRadMj = snap.sun.todayRadMj;
  const todaySatFullDayEst = snap.today.fullDayTargetKwh;
  const todaySatCumEst = +todayPhysics.current.cumKwh.toFixed(1);
  const isTodayConfirmed = snap.today.isConfirmed;
  const effectiveTodayYield = snap.today.displayKwh;
  const yesterdayLedgerEntry = effectiveIntelligenceReport?.dailyLedger?.find((d) => d.ymd === yesterdayIst.ymd);
  const isYesterdayUnloggedOutage =
    !isYesterdayConfirmed && (yesterdayLedgerEntry?.dipCategory === 'WIFI_OUTAGE_UNLOGGED' || isTodayConfirmed);

  const isPreSunrise = effectiveHeroMinute < todayPhysics.model.sunriseMin;
  const isPostSunset = effectiveHeroMinute >= todayPhysics.model.sunsetMin;
  const todayDisplayNum = snap.today.displayKwh;
  const todayOutputKwh = todayDisplayNum.toFixed(snap.today.bufferKwh >= 0.05 ? 2 : 1);
  const todayProgressPct = snap.today.progressPctOfTarget;

  const monthSyncedLabel = snap.month.syncedThroughLabel;
  const offlinePendingDaysCount = snap.month.pendingDaysCount;
  const monthCueLabel =
    offlinePendingDaysCount === 0
      ? 'Confirmed'
      : isTodayConfirmed
      ? `Excl. ${yesterdayIst.shortLabel}`
      : `Through ${monthSyncedLabel}`;

  const monthCloudBaseKwh = Math.max(monthYield, snap.month.mtdKwh);
  const hasMonthOutageOrAnchor =
    snap.month.physicalTotalKwh > monthCloudBaseKwh + 0.05 || snap.month.isEmonthAnchored;
  const monthHeadlineKwh = snap.month.isEmonthAnchored
    ? snap.month.physicalTotalKwh
    : Math.max(monthCloudBaseKwh, snap.month.physicalTotalKwh);
  const monthHeadlineSavingsInr = hasMonthOutageOrAnchor
    ? snap.month.physicalSavingsInr
    : Math.round(monthHeadlineKwh * tariffPerKwh);
  const monthBufferDeltaKwh = Math.max(0, +(monthHeadlineKwh - monthCloudBaseKwh).toFixed(2));
  const monthCoveredDays = Math.max(
    1,
    confirmedActiveDays.length +
      (monthBufferDeltaKwh > 1 && offlinePendingDaysCount > 0 ? offlinePendingDaysCount : 0)
  );
  const monthHeadlineAvgDaily = hasMonthOutageOrAnchor
    ? +(monthHeadlineKwh / monthCoveredDays).toFixed(1)
    : snap.month.dailyAvgKwh;
  const resolvedMonthCueKind: 'confirmed' | 'estimated' | 'through' =
    snap.month.isEmonthAnchored || monthBufferDeltaKwh > 0.05 || offlinePendingDaysCount === 0
      ? 'confirmed'
      : 'through';
  const monthHardwareSynced = snap.month.hardwareSource === 'waaree-api';
  const resolvedMonthCueLabel = snap.month.isEmonthAnchored
    ? monthHardwareSynced
      ? 'Inverter Synced'
      : 'LCD Synced'
    : monthBufferDeltaKwh > 0.05
    ? 'Cloud + Buffer'
    : monthCueLabel;

  const hasLifetimeOutageOrAnchor =
    snap.lifetime.physicalTotalKwh > snap.lifetime.confirmedKwh + 0.05 || snap.lifetime.isEtotalAnchored;
  const lifetimeHardwareSynced = snap.lifetime.hardwareSource === 'waaree-api';
  const lifetimeHeadlineKwh = snap.lifetime.isEtotalAnchored
    ? snap.lifetime.physicalTotalKwh
    : Math.max(snap.lifetime.confirmedKwh, snap.lifetime.physicalTotalKwh);
  const lifetimeHeadlineSavingsFormatted = hasLifetimeOutageOrAnchor
    ? snap.lifetime.physicalSavingsFormatted
    : snap.lifetime.savingsFormatted;
  const lifetimeBufferDeltaKwh = Math.max(0, +(lifetimeHeadlineKwh - snap.lifetime.confirmedKwh).toFixed(2));
  const lifetimeHeadlineEnv = hasLifetimeOutageOrAnchor
    ? snap.environmental.lifetimePhysical
    : snap.environmental.lifetime;

  const currentIstTimeLabel = formatMinutes12hUpper(istNow.totalMinutes);
  const rawSeriesPeakKw = todayPeakInfo?.peakKw ?? 0;
  const roundedRealKwNow = +realKwNow.toFixed(2);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      if (!isTodayConfirmed || roundedRealKwNow <= rawSeriesPeakKw) {
        if (livePeakStamp) setLivePeakStamp(null);
        return;
      }
      if (!livePeakStamp || livePeakStamp.ymd !== istNow.ymd || roundedRealKwNow > livePeakStamp.peakKw) {
        setLivePeakStamp({
          ymd: istNow.ymd,
          peakKw: roundedRealKwNow,
          peakTimeLabel: currentIstTimeLabel,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [isTodayConfirmed, roundedRealKwNow, rawSeriesPeakKw, istNow.ymd, currentIstTimeLabel, livePeakStamp]);

  const effectivePeakBeyondRaw =
    isTodayConfirmed && roundedRealKwNow > rawSeriesPeakKw
      ? livePeakStamp && livePeakStamp.ymd === istNow.ymd && livePeakStamp.peakKw >= roundedRealKwNow
        ? { peakKw: livePeakStamp.peakKw, peakTimeLabel: livePeakStamp.peakTimeLabel }
        : { peakKw: roundedRealKwNow, peakTimeLabel: currentIstTimeLabel }
      : null;

  const todayHardwarePeak =
    isTodayConfirmed && todayPeakInfo && todayPeakInfo.peakKw > 0
      ? effectivePeakBeyondRaw ?? todayPeakInfo
      : effectivePeakBeyondRaw;

  const heroPeakIsEstimated = !todayHardwarePeak;
  const heroPeakKw = todayHardwarePeak ? todayHardwarePeak.peakKw : snap.hero.peakKw;
  const heroPeakTimeText = todayHardwarePeak ? todayHardwarePeak.peakTimeLabel : snap.hero.peakTimeText;

  const tomorrowYieldEst = snap.tomorrow.expectedKwh;
  const tomorrowSunshineHours = snap.tomorrow.sunshineHours;
  const tomorrowMinTemp = weatherData?.tomorrowForecast?.minTemp ?? 17.5;
  const tomorrowMaxTemp = weatherData?.tomorrowForecast?.maxTemp ?? 28.6;

  return (
    <div className="w-full space-y-4 pb-16 select-none font-sans pt-0">
      {/* Official Inverter Hardware Alarm Alert Bar (active utility grid drop only) */}
      {snap.alarms?.activeGridDropAlarm && snap.truth.status === 'GRID_OUTAGE' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/95 px-4 py-3 flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-200/80 text-amber-900 shrink-0">
              <ZapOff className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold text-amber-950 truncate">
                Grid Power Cut Detected — Inverter Paused Safely
              </div>
              <div className="text-[11px] font-medium text-amber-900/80 mt-0.5 truncate">
                Brief power cut logged at {snap.alarms.activeGridDropAlarm.time} · Code {snap.alarms.activeGridDropAlarm.code} · Inverter auto-resumed when grid returned
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToPerformance()}
            className="px-2.5 py-1 rounded-lg bg-white/90 border border-amber-300/80 text-[11px] font-bold text-amber-900 hover:bg-white transition cursor-pointer shrink-0"
          >
            View Safety Log
          </button>
        </div>
      )}


      <SolarAtmosphereStage
        plantName={snap.config.plantDisplayName || 'Solar Plant'}
        locationName={currentLocation?.name || ''}
        capacityKwp={safeCapacity}
        liveKw={displayLiveKw}
        realKw={realKwNow}
        modelKw={displayModelKw}
        isEstimatedLive={isEstimatedLive}
        isHardwareFault={isHardwareFault}
        peakKw={heroPeakKw}
        peakTimeText={heroPeakTimeText}
        peakIsEstimated={heroPeakIsEstimated}
        specificYield={lastSyncedRate}
        lastSyncedLabel={lastSyncedBenchmarkLabel}
        lastSyncedYieldKwh={lastSyncedBenchmarkYield}
        todayConfirmedYieldKwh={isTodayConfirmed ? effectiveTodayYield : null}
        todayEstYieldKwh={todaySatFullDayEst}
        weatherData={weatherData}
        solarPhase={solarPhase}
        tariffPerKwh={tariffPerKwh}
        onNavigateToPerformance={onNavigateToPerformance}
        onOpenPhysicsModal={() => setIsPhysicsModalOpen(true)}
        coords={currentLocation ? { lat: currentLocation.lat, lon: currentLocation.lon } : undefined}
        onOpenLocationEdit={onOpenLocationEdit}
        lastUpdateText={lastUpdateText}
        tempUnit={snap.config.tempUnit}
        sunContext={{
          sunriseMin: snap.sun.sunriseMin ?? 384,
          sunsetMin: snap.sun.sunsetMin ?? 1040,
          solarNoonMin: snap.sun.solarNoonMin ?? 712,
        }}
        todayPhysicsPoints={snap.todayPhysics.model.points.map((pt) => ({
          minute: pt.minutes,
          kw: pt.kw,
        }))}
      />

      <OverviewKpiStrip
        snap={snap}
        istNow={istNow}
        yesterdayIst={yesterdayIst}
        isTodayConfirmed={isTodayConfirmed}
        isYesterdayConfirmed={isYesterdayConfirmed}
        isYesterdayUnloggedOutage={isYesterdayUnloggedOutage}
        isPreSunrise={isPreSunrise}
        isPostSunset={isPostSunset}
        todayOutputKwh={todayOutputKwh}
        todayProgressPct={todayProgressPct}
        todayHardwarePeak={todayHardwarePeak}
        todaySatFullDayEst={todaySatFullDayEst}
        todaySunriseText={todayPhysics.model.sunriseText}
        todaySunsetText={todayPhysics.model.sunsetText}
        yesterdayConfirmedYield={yesterdayConfirmedYield}
        yesterdayEstYield={yesterdayEstYield}
        yesterdayPeakInfo={yesterdayPeakInfo}
        lastSyncedBenchmarkLabel={lastSyncedBenchmarkLabel}
        lastSyncedBenchmarkYield={lastSyncedBenchmarkYield}
        monthSyncedLabel={monthSyncedLabel}
        offlinePendingDaysCount={offlinePendingDaysCount}
        monthHeadlineKwh={monthHeadlineKwh}
        monthHeadlineSavingsInr={monthHeadlineSavingsInr}
        monthCloudBaseKwh={monthCloudBaseKwh}
        monthBufferDeltaKwh={monthBufferDeltaKwh}
        monthHardwareSynced={monthHardwareSynced}
        resolvedMonthCueKind={resolvedMonthCueKind}
        resolvedMonthCueLabel={resolvedMonthCueLabel}
        confirmedActiveDaysCount={confirmedActiveDays.length}
        monthHeadlineAvgDaily={monthHeadlineAvgDaily}
        lifetimeHeadlineKwh={lifetimeHeadlineKwh}
        lifetimeHeadlineSavingsFormatted={lifetimeHeadlineSavingsFormatted}
        lifetimeBufferDeltaKwh={lifetimeBufferDeltaKwh}
        lifetimeHardwareSynced={lifetimeHardwareSynced}
        lifetimeHeadlineEnv={lifetimeHeadlineEnv}
        syncAtIstLabel={syncMeta?.syncedAtIstLabel}
        onOpenPhysicsModal={() => setIsPhysicsModalOpen(true)}
      />

      {/* Sunset Solar Report Banner - Triggered at dusk/standby */}
      {(isPostSunset || isNight || isPreSunrise) && effectiveTodayYield > 0.05 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50/40 via-white/95 to-amber-50/20 border border-slate-200/80 shadow-xs backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all hover:border-slate-300/90 relative overflow-hidden group">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/70 shadow-2xs">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50/90 border border-emerald-200/70 text-emerald-800 text-[10.5px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Daily Solar Audit Complete
                </span>
                <span className="text-[11px] text-slate-400 font-medium">· {snap.clock.indianMediumLabel}</span>
              </div>
              <p className="text-xs text-slate-600 font-normal mt-1 leading-relaxed">
                Today's generation (<strong className="font-semibold text-slate-900">{todayOutputKwh} kWh</strong> · <span className="font-semibold text-emerald-700">₹{Math.round(effectiveTodayYield * tariffPerKwh)} saved</span>) has concluded. Full dip analysis &amp; hardware health report is ready.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setReportSelectedYmd(istNow.ymd);
              setReportRealPoints(null);
              setReportPhysicsModel(todayPhysics.model);
              setReportYieldKwh(effectiveTodayYield);
              setIsReportCardOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-xs tracking-tight transition duration-150 shadow-xs hover:shadow-md cursor-pointer shrink-0 inline-flex items-center justify-center gap-1.5 self-start sm:self-auto group/btn"
          >
            <FileText className="w-3.5 h-3.5 text-slate-300 group-hover/btn:text-white transition" />
            <span>View Daily Report</span>
            <ArrowRight className="w-3 h-3 text-slate-400 group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition" />
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <SolarComparisonChart
            stationId={stationId}
            safeCapacity={safeCapacity}
            tariffPerKwh={tariffPerKwh}
            weatherData={weatherData}
            solarPhase={solarPhase}
            displayLiveKw={displayLiveKw}
            todayYield={effectiveTodayYield}
            todayCloudKwh={snap.today.cloudKwh}
            todayBufferKwh={snap.today.bufferKwh}
            isTodayConfirmed={isTodayConfirmed}
            yesterdayDay={yesterdayIst.day}
            yesterdayYield={yesterdayConfirmedYield}
            isYesterdayConfirmed={isYesterdayConfirmed}
            lastSyncedDay={lastSyncedDay}
            todayRawSeries={todayRawSeries}
            yesterdayRawSeries={yesterdayRawSeries}
            monthlyDaysData={monthlyDaysData}
            plantCommissioningYmd={plantCommissioningYmd}
            location={currentLocation}
            istClock={istNow}
            syncMeta={syncMeta}
            latestNewData={latestNewData}
            isNight={isNight}
            currentSurfaceLossPct={currentSurfaceLossPct}
            surfaceLossByYmd={surfaceLossByYmd}
            physicsOverrides={snap.config.physicsOverrides}
            canonicalTodayModel={todayPhysics.model}
            todayNowcast={snap.todayPhysics.nowcast}
            reconciledBufferByYmd={snap.reconciledBufferByYmd}
            dailyLedger={effectiveIntelligenceReport?.dailyLedger}
            manualGridOffDates={manualGridOffDates}
            todayCurveSummary={{
              realYieldFromCurveKwh: snap.today.realYieldFromCurveKwh,
              curveStartLabel: snap.today.curveStartLabel,
              curveEndLabel: snap.today.curveEndLabel,
              isPartialCurve: snap.today.isPartialCurve,
            }}
            onNavigateToPerformance={onNavigateToPerformance}
            onOpenDailyReport={(ymd, points, physicsModel, dayYield) => {
              setReportSelectedYmd(ymd || istNow.ymd);
              setReportRealPoints(points && points.length > 0 ? points : null);
              setReportPhysicsModel(physicsModel || null);
              if (typeof dayYield === 'number') setReportYieldKwh(dayYield);
              setIsReportCardOpen(true);
            }}
          />

          <WeeklyPerformanceLedgerCard
            dailyLedger={effectiveIntelligenceReport?.dailyLedger}
            recent7DaysData={recent7DaysData}
            monthlyDaysData={monthlyDaysData}
            tariffPerKwh={tariffPerKwh}
            istClock={istNow}
            onNavigateToPerformance={onNavigateToPerformance}
            onOpenDailyReport={(ymd) => {
              setReportSelectedYmd(ymd || istNow.ymd);
              setReportRealPoints(null);
              setIsReportCardOpen(true);
            }}
          />
        </div>

        <div className="lg:col-span-4 flex flex-col space-y-4">
          <PanelHygieneCard
            report={effectiveIntelligenceReport}
            currentSurfaceLossPct={currentSurfaceLossPct}
            pm10Real={pm10Real}
            dustReal={dustReal}
            usAqiReal={usAqiReal}
            weatherAod={weatherData?.current?.aerosolOpticalDepth}
            istNow={istNow}
            plantCommissioningYmd={plantCommissioningYmd}
            isCleaningSaving={isCleaningSaving}
            onLogWash={handleLogWash}
            onOpenIntelligenceModal={() => setIsIntelligenceModalOpen(true)}
          />

          <TomorrowOutlookCard
            report={effectiveIntelligenceReport}
            snap={snap}
            tomorrowShortLabel={tomorrowIst.shortLabel}
            tomorrowYieldEst={tomorrowYieldEst}
            tomorrowSunshineHours={tomorrowSunshineHours}
            tomorrowMinTemp={tomorrowMinTemp}
            tomorrowMaxTemp={tomorrowMaxTemp}
          />
        </div>
      </section>

      <DailyReportCardModal
        isOpen={isReportCardOpen}
        onClose={() => setIsReportCardOpen(false)}
        selectedYmd={reportSelectedYmd || istNow.ymd}
        todayYmd={istNow.ymd}
        physicsModel={reportPhysicsModel ?? (reportSelectedYmd === istNow.ymd ? todayPhysics.model : undefined)}
        realPoints={reportRealPoints ?? undefined}
        rawSeries={reportSelectedYmd === istNow.ymd ? todayRawSeries : (reportSelectedYmd === yesterdayIst.ymd ? yesterdayRawSeries : undefined)}
        dayYieldKwh={reportYieldKwh ?? (reportSelectedYmd && reportSelectedYmd !== istNow.ymd ? (recent7DaysData.find((d) => `${istNow.year}-${String(istNow.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` === reportSelectedYmd)?.yield ?? 11.2) : effectiveTodayYield)}
        tariffPerKwh={snap.config.tariffPerKwh}
        peakKw={snap.reportCard.peakKw}
        peakTime={snap.reportCard.peakTime}
        activeHours={snap.tomorrow.sunshineHours.toFixed(1)}
        systemCapacity={snap.config.capacityKwp}
        tomorrowKwh={snap.reportCard.tomorrowKwh}
        dateStr={reportSelectedYmd && reportSelectedYmd !== istNow.ymd ? reportSelectedYmd : snap.clock.indianMediumLabel}
      />

      <SolarIntelligenceModal
        isOpen={isIntelligenceModalOpen}
        onClose={() => setIsIntelligenceModalOpen(false)}
        report={effectiveIntelligenceReport}
        plantName={
          snap.config.plantDisplayName || intelligenceRes?.plantName || currentLocation?.name || 'Solar Plant'
        }
        tiltDegrees={snap.config.arrayTiltDeg}
        nominalPrPct={+(snap.config.basePrAtStc * snap.config.inverterEfficiency * 100).toFixed(1)}
        onRefresh={handleRefreshIntelligence}
        onLogWash={async (dateYmd, note) => {
          await handleLogWash(dateYmd, note);
        }}
        onRemoveWash={handleRemoveWash}
      />

      <SatellitePhysicsModal
        isOpen={isPhysicsModalOpen}
        onClose={() => setIsPhysicsModalOpen(false)}
        snap={snap}
        safeCapacity={safeCapacity}
        locationName={currentLocation?.name || ''}
        todayRadMj={todayRadMj ?? null}
        todaySatCumEst={todaySatCumEst}
        todaySatFullDayEst={todaySatFullDayEst}
        currentSurfaceLossPct={currentSurfaceLossPct}
        shortDateLabel={istNow.shortLabel}
      />
    </div>
  );
};

export const HomeTab = OverviewTab;
