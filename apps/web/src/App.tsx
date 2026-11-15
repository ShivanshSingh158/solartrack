import React, { useState, useEffect, useCallback } from 'react';
import {
  auditRawChannelsFromTelemetry,
  getIstClockParts,
  type TabType,
  type TimescaleMode,
} from '@solar-track/core';
import { MobileNav } from './features/layout/MobileNav';
import { TopHeader } from './features/layout/TopHeader';
import { OverviewTab } from './features/overview/OverviewTab';
import { PerformanceTab } from './features/performance/PerformanceTab';
import { HealthTab } from './features/health/HealthTab';
import { FinancialsTab as SavingsTab } from './features/financials/FinancialsTab';
import { SettingsTab } from './features/settings/SettingsTab';
import { AddAccountModal } from './features/modals/AddAccountModal';
import { DataCatalogModal } from './features/modals/DataCatalogModal';
import { LocationEditModal } from './features/modals/LocationEditModal';
import { DailyReportCardModal } from './features/modals/DailyReportCardModal';
import { LoginScreen } from './features/auth/LoginScreen';
import { OverviewSkeleton } from './features/overview/OverviewSkeleton';
import { PacketNotificationToast } from './app/components/PacketNotificationToast';
import { useAppSettings } from './app/hooks/useAppSettings';
import { useLiveTelemetry } from './app/hooks/useLiveTelemetry';
import { ApiService } from './shared/api/solarApi';

const VALID_TABS: readonly TabType[] = ['home', 'performance', 'health', 'savings', 'settings'];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as TabType;
      if (VALID_TABS.includes(hash)) return hash;
    }
    return 'home';
  });

  const handleSelectTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as TabType;
      if (VALID_TABS.includes(hash)) setActiveTab(hash);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const [timescale, setTimescale] = useState<TimescaleMode>('month');
  const [proMode, setProMode] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => getIstClockParts().ymd);
  const [selectedWeekEndYmd, setSelectedWeekEndYmd] = useState<string>(() => getIstClockParts().ymd);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getIstClockParts().ym);
  const [selectedYear, setSelectedYear] = useState<number>(() => getIstClockParts().year);

  const [isAddAccountOpen, setIsAddAccountOpen] = useState<boolean>(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [isReportCardOpen, setIsReportCardOpen] = useState<boolean>(false);

  const [authStatus, setAuthStatus] = useState<{
    isChecked: boolean;
    authenticated: boolean;
    user?: any;
  }>({
    isChecked: false,
    authenticated: true,
  });

  useEffect(() => {
    let isMounted = true;
    ApiService.getAuthStatus().then((status) => {
      if (!isMounted) return;
      setAuthStatus({
        isChecked: true,
        authenticated: status.authenticated,
        user: status.user,
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await ApiService.logout();
    } finally {
      setAuthStatus({ isChecked: true, authenticated: false });
    }
  }, []);

  const settings = useAppSettings();
  const telemetry = useLiveTelemetry({
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
    alertsEnabled: settings.alertsEnabled,
    plantDisplayName: settings.plantDisplayName,
    commissioningDateOverride: settings.commissioningDateOverride,
    resolvedDcDisplayCap: settings.resolvedDcDisplayCap,
    resolveAcDisplayCap: settings.resolveAcDisplayCap,
    buildFullPersistedSettings: settings.buildFullPersistedSettings,
    lastCleanedDate: settings.lastCleanedDate,
    setLastCleanedDate: settings.setLastCleanedDate,
    applyHydratedSettings: settings.applyHydratedSettings,
    setAfterResetHandler: settings.setAfterResetHandler,
  });

  const handleLoginSuccess = useCallback(
    (user?: any) => {
      setAuthStatus({ isChecked: true, authenticated: true, user });
      telemetry.handleFullRefresh();
    },
    [telemetry],
  );

  const navigateToDayPerformance = useCallback(
    (ymd?: string) => {
      if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        setSelectedDate(ymd);
        setSelectedMonth(ymd.slice(0, 7));
        const parsedYear = parseInt(ymd.slice(0, 4), 10);
        if (parsedYear > 2000) setSelectedYear(parsedYear);
      }
      setTimescale('day');
      handleSelectTab('performance');
    },
    [handleSelectTab],
  );

  const handleLocationUpdated = useCallback(
    async (newLoc: { name: string; lat: number; lon: number }) => {
      settings.setCurrentLocation(newLoc);
      setIsLocationModalOpen(false);
      await telemetry.handleFullRefresh();
    },
    [settings, telemetry],
  );

  const activePlantLabel = telemetry.isCombined
    ? 'Combined Fleet Overview'
    : settings.plantDisplayName || telemetry.activePlantObj?.plantName || 'Solar Station';

  if (!authStatus.isChecked) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FFFDF5] font-sans">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-md flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (authStatus.isChecked && !authStatus.authenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col antialiased bg-transparent text-[#0F172A] w-full">
      <TopHeader
        title={telemetry.headerTitle}
        subtitle={telemetry.headerSubtitle}
        capacityText={telemetry.headerCapacity}
        lastUpdateText={telemetry.rawStatusText}
        onRefresh={telemetry.handleFullRefresh}
        isRefreshing={telemetry.isRefreshing}
        locationName={telemetry.canonicalSnapshot.config.locationName}
        onOpenLocationEdit={() => setIsLocationModalOpen(true)}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        accounts={telemetry.accounts}
        activeContext={telemetry.effectiveContext}
        onSelectContext={telemetry.setActiveContext}
        onOpenAddAccount={() => setIsAddAccountOpen(true)}
        onOpenCatalog={() => setIsCatalogOpen(true)}
        tariffPerKwh={telemetry.canonicalSnapshot.config.tariffPerKwh}
        liveKw={telemetry.headerRealKw}
        estimatedKw={telemetry.headerEstimatedKw}
        isEstimatedLive={telemetry.headerIsEstimatedLive}
        isNight={telemetry.headerIsNight}
        alertsEnabled={settings.alertsEnabled}
        onToggleAlerts={settings.handleToggleAlerts}
        latestNewData={telemetry.latestNewData}
        syncMeta={telemetry.syncMeta}
        onLogout={handleLogout}
        syncStatusText={
          telemetry.syncMeta.syncedAtIstLabel
            ? `${telemetry.syncMeta.sseConnected ? 'SSE Live' : 'Synced'} ${telemetry.syncMeta.syncedAtIstLabel}`
            : 'Connecting live sync...'
        }
      />

      {telemetry.activePacketToast && (
        <PacketNotificationToast
          packet={telemetry.activePacketToast}
          fallbackEstimatedKw={telemetry.headerEstimatedKw}
          onDismiss={() => telemetry.setActivePacketToast(null)}
          onViewComparison={() => {
            handleSelectTab('home');
            telemetry.setActivePacketToast(null);
            setTimeout(() => {
              document.getElementById('solar-comparison-chart')?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }, 80);
          }}
        />
      )}

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-7 pb-8 pt-0">
        {activeTab === 'home' &&
          (telemetry.isInitialLoading ? (
            <OverviewSkeleton />
          ) : (
            <OverviewTab
              livePower={telemetry.liveInstantPower}
              solarDcPower={telemetry.solarPower}
              todayYield={telemetry.todayYield}
              yesterdayYieldOverride={telemetry.singleSummary?.generationYesterday ?? null}
              monthYield={telemetry.monthYield}
              lifetimeYield={telemetry.lifetimeYield}
              plantCapacity={settings.resolvedDcDisplayCap}
              tariffPerKwh={settings.tariffPerKwh}
              lastUpdateText={telemetry.rawStatusText}
              stationId={telemetry.effectiveContext}
              plantCommissioningYmd={telemetry.resolvedCommissioningYmd}
              recent7DaysData={telemetry.monthlyDaysData.slice(-7)}
              monthlyDaysData={telemetry.monthlyDaysData}
              weatherData={telemetry.weatherData}
              todayRawSeries={telemetry.todayRawSeries}
              yesterdayRawSeries={telemetry.yesterdayRawSeries}
              lastSyncedDay={telemetry.lastSyncedDay}
              istClock={telemetry.istClock}
              syncMeta={telemetry.syncMeta}
              latestNewData={telemetry.latestNewData}
              currentLocation={settings.currentLocation}
              onOpenLocationEdit={() => setIsLocationModalOpen(true)}
              onNavigateToPerformance={navigateToDayPerformance}
              peakTimeText={telemetry.peakTimeText}
              onRefresh={telemetry.handleFullRefresh}
              isRefreshing={telemetry.isRefreshing}
              canonicalSnapshot={telemetry.canonicalSnapshot}
              intelligenceReport={telemetry.intelligenceReport}
              onIntelligenceReportChange={telemetry.handleIntelligenceReportChange}
              onUpdateSettings={settings.handleUpdateSettingsPartial}
              manualGridOffDates={settings.manualGridOffDates}
            />
          ))}

        {activeTab === 'performance' && (
          <PerformanceTab
            timescale={timescale}
            onChangeTimescale={setTimescale}
            selectedDate={selectedDate}
            onChangeDate={(ymd) => {
              setSelectedDate(ymd);
              setSelectedMonth(ymd.slice(0, 7));
              const parsedYear = parseInt(ymd.slice(0, 4), 10);
              if (parsedYear > 2000) setSelectedYear(parsedYear);
            }}
            selectedWeekEndYmd={selectedWeekEndYmd}
            onChangeWeekEndYmd={setSelectedWeekEndYmd}
            selectedMonth={selectedMonth}
            onChangeMonth={(ym) => {
              setSelectedMonth(ym);
              const parsedYear = parseInt(ym.slice(0, 4), 10);
              if (parsedYear > 2000) setSelectedYear(parsedYear);
            }}
            selectedYear={selectedYear}
            onChangeYear={setSelectedYear}
            onExportCSV={telemetry.handleExportCSV}
            chartData={telemetry.chartData}
            tableRows={telemetry.tableRows}
            isLoading={telemetry.isChartLoading}
            proMode={proMode}
            onToggleProMode={() => setProMode((prev) => !prev)}
            liveAcPower={telemetry.liveInstantPower}
            liveDcPower={telemetry.solarPower}
            weatherData={telemetry.weatherData}
            canonicalSnapshot={telemetry.canonicalSnapshot}
            intelligenceReport={telemetry.intelligenceReport}
            onIntelligenceReportChange={telemetry.handleIntelligenceReportChange}
            todayRawSeries={telemetry.todayRawSeries}
            yesterdayRawSeries={telemetry.yesterdayRawSeries}
            lastSyncedDay={telemetry.lastSyncedDay}
            monthlyDaysData={
              selectedMonth === telemetry.istClock.ym && telemetry.monthlyDaysData.length > 0
                ? telemetry.monthlyDaysData
                : telemetry.selectedMonthDaysState.ym === selectedMonth
                  ? telemetry.selectedMonthDaysState.days
                  : []
            }
            currentMonthDaysData={telemetry.monthlyDaysData}
            prevMonthDaysData={telemetry.prevMonthDays}
            yearlyMonthsData={
              telemetry.selectedYearMonthsState.year === selectedYear
                ? telemetry.selectedYearMonthsState.months
                : []
            }
            combinedDayRaw={telemetry.combinedDayRaw}
            stationId={telemetry.effectiveContext}
            isCombined={telemetry.isCombined}
            commissioningYmd={telemetry.resolvedCommissioningYmd}
            istClock={telemetry.istClock}
            syncMeta={telemetry.syncMeta}
            location={settings.currentLocation}
            plantCapacity={settings.resolvedDcDisplayCap}
            onNavigateToHealth={() => handleSelectTab('health')}
            onUpdateSettings={settings.handleUpdateSettingsPartial}
            manualGridOffDates={settings.manualGridOffDates}
          />
        )}

        {activeTab === 'health' && (
          <HealthTab
            canonicalSnapshot={telemetry.canonicalSnapshot}
            todayRawSeries={telemetry.todayRawSeries}
            yesterdayRawSeries={telemetry.yesterdayRawSeries}
            lastSyncedDay={telemetry.lastSyncedDay}
            liveFlow={telemetry.liveFlow}
            weatherData={telemetry.weatherData}
            intelligenceReport={telemetry.intelligenceReport}
            syncMeta={telemetry.syncMeta}
            stationId={telemetry.effectiveContext}
            alertSettings={{
              alertOfflineDelay: settings.alertOfflineDelay,
              alertMorningYield: settings.alertMorningYield,
              alertUnderperformance: settings.alertUnderperformance,
              alertVoltageSpike: settings.alertVoltageSpike,
              offlineDelayMinutes: settings.offlineDelayMinutes,
              underperformanceThresholdPct: settings.underperformanceThresholdPct,
              packetAlertsEnabled: settings.alertsEnabled,
            }}
            onInspectDayInPerformance={navigateToDayPerformance}
            onNavigateToSettings={() => handleSelectTab('settings')}
          />
        )}

        {activeTab === 'savings' && (
          <SavingsTab
            canonicalSnapshot={telemetry.canonicalSnapshot}
            intelligenceReport={telemetry.intelligenceReport}
            weatherData={telemetry.weatherData}
            govtSubsidyInr={settings.govtSubsidyInr}
            panelWashCostInr={settings.panelWashCostInr}
            tariffEscalationPct={settings.tariffEscalationPct}
            onChangeTariff={settings.handleUpdateTariff}
            onChangeSystemCost={settings.handleUpdateSystemCost}
            onChangeGovtSubsidy={settings.handleUpdateGovtSubsidy}
            onChangePanelWashCost={settings.handleUpdatePanelWashCost}
            onNavigateToSettings={() => handleSelectTab('settings')}
            onNavigateToPerformance={(mode) => {
              if (mode) setTimescale(mode);
              handleSelectTab('performance');
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={telemetry.fullPersistedSettings}
            onUpdateSettings={settings.handleUpdateSettingsPartial}
            onResetSettings={settings.handleResetSettings}
            canonicalSnapshot={telemetry.canonicalSnapshot}
            weatherData={telemetry.weatherData}
            intelligenceReport={telemetry.intelligenceReport}
            onIntelligenceReportChange={telemetry.handleIntelligenceReportChange}
            syncMeta={telemetry.syncMeta}
            rawStatusText={telemetry.rawStatusText}
            accounts={telemetry.accounts}
            activeContext={telemetry.activeContext}
            onSelectContext={telemetry.setActiveContext}
            onOpenAddAccount={() => setIsAddAccountOpen(true)}
            onOpenDataCatalog={() => setIsCatalogOpen(true)}
            onAccountsUpdated={telemetry.loadAccounts}
            onRefresh={telemetry.handleFullRefresh}
            isRefreshing={telemetry.isRefreshing}
            cloudPlantName={telemetry.activePlantObj?.plantName || ''}
            cloudCapacityKwp={
              parseFloat(String(telemetry.activePlantObj?.capacity || telemetry.singleSummary?.capacity || 3.0)) ||
              3.0
            }
            portalCreatedDate={telemetry.activePlantObj?.createdDate || ''}
            stationId={telemetry.effectiveContext}
            todayRawSeries={telemetry.todayRawSeries}
            liveFlow={telemetry.liveFlow}
            onLogout={handleLogout}
          />
        )}
      </main>

      <MobileNav activeTab={activeTab} onSelectTab={handleSelectTab} />

      <AddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        onAccountAdded={telemetry.handleFullRefresh}
      />

      <DataCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        plantLabel={activePlantLabel}
        channels={auditRawChannelsFromTelemetry(
          telemetry.todayRawSeries || [],
          telemetry.liveFlow || null,
          telemetry.canonicalSnapshot,
        )}
      />

      {isLocationModalOpen && (
        <LocationEditModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          onLocationUpdated={handleLocationUpdated}
          currentLocation={settings.currentLocation}
        />
      )}

      <DailyReportCardModal
        isOpen={isReportCardOpen}
        onClose={() => setIsReportCardOpen(false)}
        dayYieldKwh={telemetry.canonicalSnapshot.reportCard.todayKwh}
        tariffPerKwh={telemetry.canonicalSnapshot.config.tariffPerKwh}
        peakKw={telemetry.canonicalSnapshot.reportCard.peakKw}
        peakTime={telemetry.canonicalSnapshot.reportCard.peakTime}
        activeHours={telemetry.canonicalSnapshot.tomorrow.sunshineHours.toFixed(1)}
        systemCapacity={telemetry.canonicalSnapshot.config.capacityKwp}
        tomorrowKwh={telemetry.canonicalSnapshot.reportCard.tomorrowKwh}
        plantName={telemetry.canonicalSnapshot.config.locationName}
        grade={telemetry.canonicalSnapshot.reportCard.grade}
        gradeLabel={telemetry.canonicalSnapshot.reportCard.gradeLabel}
        specificYield={telemetry.canonicalSnapshot.reportCard.specificYield}
        dateStr={telemetry.canonicalSnapshot.clock.indianMediumLabel}
      />
    </div>
  );
};

export default App;
