import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings2,
  RotateCcw,
  Check,
  SlidersHorizontal,
  IndianRupee,
  ShieldAlert,
  Cpu,
} from 'lucide-react';
import { ApiService } from '../../shared/api/solarApi';
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
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<ProxyStatusResponse | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const panelTabs: Array<{
    id: SettingsWorkspaceTab;
    label: string;
    description: string;
    icon: React.ReactNode;
    badge: string;
  }> = [
    {
      id: 'plant',
      label: 'Plant & Rooftop',
      description: 'Rooftop plant name, location, and system capacity.',
      icon: <SlidersHorizontal className="w-4 h-4" />,
      badge: `${canonicalSnapshot.config.capacityKwp.toFixed(2)} kWp`,
    },
    {
      id: 'utility',
      label: 'Electricity & Rates',
      description: 'Grid electricity tariff, billing cycle day, and plant investment.',
      icon: <IndianRupee className="w-4 h-4" />,
      badge: `₹${settings.tariffPerKwh.toFixed(2)}/u`,
    },
    {
      id: 'alerts',
      label: 'Alerts & Maintenance',
      description: 'Inverter offline alerts, morning start-up checks, and cleaning log.',
      icon: <ShieldAlert className="w-4 h-4" />,
      badge: `${settings.offlineDelayMinutes}m delay`,
    },
    {
      id: 'engine',
      label: 'Cloud Connection',
      description: 'Waaree Cloud account status, connection testing, and data sync.',
      icon: <Cpu className="w-4 h-4" />,
      badge: syncMeta.sseConnected ? 'Connected' : 'Syncing',
    },
  ];

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
    [onUpdateSettings],
  );

  const handleConfirmReset = async () => {
    setIsResetting(true);
    await onResetSettings({ preserveLocation: true, preserveCleaning: true });
    setIsResetting(false);
    setConfirmResetOpen(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);
  };

  return (
    <div className="space-y-5 w-full pb-10 animate-in fade-in duration-300">
      {/* CLEAN APPLE HEADER */}
      <div className="apple-glass-static rounded-3xl p-5 border border-slate-100/90 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Settings2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-extrabold text-slate-900 tracking-tight">
                Settings
              </h2>
              {savedToast ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700 animate-in fade-in">
                  <Check className="w-3 h-3" /> Saved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full apple-glass-pill text-[11px] font-medium text-slate-600 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  All changes saved automatically
                </span>
              )}
            </div>
            <p className="text-[12px] text-slate-500 truncate mt-0.5">
              Plant details, utility rates, alert notifications, and cloud connections.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {confirmResetOpen ? (
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => void handleConfirmReset()}
                className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-[11.5px] font-bold hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[11.5px] font-semibold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[11.5px] font-semibold text-slate-600 hover:text-rose-700 hover:border-rose-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
            </button>
          )}
        </div>
      </div>

      {/* MASTER-DETAIL SHELL */}
      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* LEFT STREAMLINED NAVIGATION RAIL */}
        <aside
          className={`w-full md:w-64 shrink-0 apple-glass-static rounded-3xl p-3 space-y-1.5 md:sticky md:top-6 self-start shadow-2xs ${
            mobileDetailOpen ? 'hidden md:block' : 'block'
          }`}
        >
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Configuration
          </div>

          <div className="space-y-1">
            {panelTabs.map((t) => {
              const active = workspaceTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setWorkspaceTab(t.id);
                    setMobileDetailOpen(true);
                  }}
                  className={`w-full px-3 py-2.5 rounded-2xl text-[12.5px] font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                    active
                      ? 'bg-emerald-500/10 text-emerald-950 border border-emerald-300/80 shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`p-1.5 rounded-xl shrink-0 transition-colors ${
                        active ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.icon}
                    </span>
                    <span className="truncate">{t.label}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tabular-nums shrink-0 ml-1.5 ${
                      active
                        ? 'bg-emerald-100/90 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT ACTIVE WORKSPACE PANE */}
        <main
          className={`flex-1 w-full apple-glass-static rounded-3xl overflow-hidden shadow-2xs min-w-0 ${
            !mobileDetailOpen ? 'hidden md:block' : 'block'
          }`}
        >
          {/* Mobile Back Button */}
          <div className="md:hidden px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileDetailOpen(false)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 cursor-pointer"
            >
              ← Back to Settings Menu
            </button>
            <span className="text-xs font-bold text-slate-700">
              {panelTabs.find((t) => t.id === workspaceTab)?.label}
            </span>
          </div>

          {/* Section Header Banner */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-2">
                <span>{panelTabs.find((t) => t.id === workspaceTab)?.label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Active
                </span>
              </h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                {panelTabs.find((t) => t.id === workspaceTab)?.description}
              </p>
            </div>
          </div>

          {/* Active Panel Content */}
          <div key={workspaceTab} className="animate-in fade-in duration-200">
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
        </main>
      </div>
    </div>
  );
};
