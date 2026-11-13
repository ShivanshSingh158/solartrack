import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings2,
  Download,
  RotateCcw,
  Check,
  SlidersHorizontal,
  IndianRupee,
  ShieldAlert,
  Cpu,
} from 'lucide-react';
import { ApiService } from '../../shared/api/solarApi';
import { SettingsKpiStrip } from './SettingsKpiStrip';
import { PlantArrayPanel } from './PlantArrayPanel';
import { UtilityRoiPanel } from './UtilityRoiPanel';
import { AlertsSoilingPanel } from './AlertsSoilingPanel';
import { AccountsEnginePanel } from './AccountsEnginePanel';
import type { SettingsWorkspaceTab } from './settingsFormatters';
import type {
  Account,
  CanonicalSolarSnapshot,
  LiveFlowData,
  PersistedAppSettings,
  ProxyStatusResponse,
  SolarIntelligenceReport,
  SolarWeatherResponse,
} from '@solar-track/core';

export interface SettingsTabProps {
  settings: PersistedAppSettings;
  onUpdateSettings: (partial: Partial<PersistedAppSettings>) => Promise<any>;
  onResetSettings: (options?: { preserveLocation?: boolean; preserveCleaning?: boolean }) => Promise<any>;
  canonicalSnapshot: CanonicalSolarSnapshot;
  weatherData: SolarWeatherResponse | null;
  intelligenceReport: SolarIntelligenceReport | null;
  onIntelligenceReportChange: (rep: SolarIntelligenceReport) => void;
  syncMeta: { syncedAtIso: string; syncedAtIstLabel: string; sseConnected: boolean };
  rawStatusText: string;
  accounts: Account[];
  activeContext: string;
  onSelectContext: (ctx: string) => void;
  onOpenAddAccount: () => void;
  onOpenDataCatalog: () => void;
  onAccountsUpdated: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  cloudPlantName: string;
  cloudCapacityKwp: number;
  portalCreatedDate: string;
  stationId: string;
  todayRawSeries?: any[];
  liveFlow?: LiveFlowData | null;
  onLogout?: () => void;
}

const WORKSPACE_TABS: Array<{ id: SettingsWorkspaceTab; label: string; icon: React.ReactNode }> = [
  { id: 'plant', label: 'Plant & Array', icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
  { id: 'utility', label: 'Tariff & Returns', icon: <IndianRupee className="w-3.5 h-3.5" /> },
  { id: 'alerts', label: 'Alerts & Soiling', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  { id: 'engine', label: 'Cloud & Engine', icon: <Cpu className="w-3.5 h-3.5" /> },
];

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  canonicalSnapshot,
  weatherData,
  intelligenceReport,
  onIntelligenceReportChange,
  syncMeta,
  rawStatusText,
  accounts,
  activeContext,
  onSelectContext,
  onOpenAddAccount,
  onOpenDataCatalog,
  onAccountsUpdated,
  onRefresh,
  isRefreshing,
  cloudPlantName,
  cloudCapacityKwp,
  portalCreatedDate,
  stationId,
  todayRawSeries,
  liveFlow,
  onLogout,
}) => {
  const [workspaceTab, setWorkspaceTab] = useState<SettingsWorkspaceTab>('plant');
  const [proxyStatus, setProxyStatus] = useState<ProxyStatusResponse | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadProxyStatus = useCallback(async () => {
    const res = await ApiService.getProxyStatus();
    if (res && res.errno === 0) setProxyStatus(res);
  }, []);

  useEffect(() => {
    let active = true;
    ApiService.getProxyStatus()
      .then((res) => {
        if (active && res && res.errno === 0) setProxyStatus(res);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleUpdateWithToast = useCallback(
    async (partial: Partial<PersistedAppSettings>) => {
      const res = await onUpdateSettings(partial);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2200);
      return res;
    },
    [onUpdateSettings]
  );

  const handleExportJson = () => {
    const payload = {
      exportedAtIso: new Date().toISOString(),
      stationId,
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solartrack-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    await onResetSettings({ preserveLocation: true, preserveCleaning: true });
    setIsResetting(false);
    setConfirmResetOpen(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);
  };

  return (
    <div className="space-y-4">
      <div className="card-floating-static rounded-3xl overflow-hidden">
        {/* TOP COCKPIT HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Settings2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] sm:text-[17px] font-extrabold text-slate-900 tracking-tight">
                  Plant Physics, Utility &amp; System Control
                </h2>
                {savedToast ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                    <Check className="w-3 h-3" /> Saved &amp; Propagated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200/80 text-[11px] font-semibold text-slate-600">
                    <span className={`h-1.5 w-1.5 rounded-full ${syncMeta.sseConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {syncMeta.sseConnected ? `Live · ${syncMeta.syncedAtIstLabel || 'Synced'}` : 'Reconnecting SSE'}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-slate-500 truncate mt-0.5">
                Single source of truth synced across Overview, Performance, System Health &amp; Financials
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sliding Segmented Workspace Bar */}
            <div className="inline-flex flex-wrap items-center rounded-xl bg-slate-100 p-1 gap-0.5">
              {WORKSPACE_TABS.map((t) => {
                const active = workspaceTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setWorkspaceTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>

            {confirmResetOpen ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => void handleConfirmReset()}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Confirm Reset'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(false)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 hover:text-rose-700 hover:border-rose-200 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>
        </div>

        {/* 4-CELL READINESS STRIP */}
        <SettingsKpiStrip
          settings={settings}
          canonicalSnapshot={canonicalSnapshot}
          accounts={accounts}
          proxyStatus={proxyStatus}
          weatherData={weatherData}
          syncMeta={syncMeta}
        />

        {/* ACTIVE WORKSPACE PANEL */}
        <div key={workspaceTab} className="transition-opacity duration-200">
          {workspaceTab === 'plant' && (
            <PlantArrayPanel
              settings={settings}
              onUpdateSettings={handleUpdateWithToast}
              canonicalSnapshot={canonicalSnapshot}
              intelligenceReport={intelligenceReport}
              cloudPlantName={cloudPlantName}
              cloudCapacityKwp={cloudCapacityKwp}
              portalCreatedDate={portalCreatedDate}
            />
          )}

          {workspaceTab === 'utility' && (
            <UtilityRoiPanel
              settings={settings}
              onUpdateSettings={handleUpdateWithToast}
              canonicalSnapshot={canonicalSnapshot}
              intelligenceReport={intelligenceReport}
              weatherData={weatherData}
            />
          )}

          {workspaceTab === 'alerts' && (
            <AlertsSoilingPanel
              settings={settings}
              onUpdateSettings={handleUpdateWithToast}
              canonicalSnapshot={canonicalSnapshot}
              stationId={stationId}
              intelligenceReport={intelligenceReport}
              onIntelligenceReportChange={onIntelligenceReportChange}
              weatherData={weatherData}
              todayRawSeries={todayRawSeries}
              liveFlow={liveFlow}
            />
          )}

          {workspaceTab === 'engine' && (
            <AccountsEnginePanel
              settings={settings}
              onUpdateSettings={handleUpdateWithToast}
              canonicalSnapshot={canonicalSnapshot}
              accounts={accounts}
              activeContext={activeContext}
              onSelectContext={onSelectContext}
              onOpenAddAccount={onOpenAddAccount}
              onOpenDataCatalog={onOpenDataCatalog}
              onAccountsUpdated={onAccountsUpdated}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              proxyStatus={proxyStatus}
              onProxyStatusRefresh={loadProxyStatus}
              weatherData={weatherData}
              rawStatusText={rawStatusText}
              todayRawSeries={todayRawSeries}
              liveFlow={liveFlow}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </div>
  );
};
