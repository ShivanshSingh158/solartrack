import React, { useState } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Radio,
  CloudSun,
} from 'lucide-react';
import { ApiService } from '../../shared/api/solarApi';
import type {
  Account,
  LiveFlowData,
  ProxyStatusResponse,
  SolarWeatherResponse,
} from '@solar-track/core';
import type { BasePanelProps } from './SettingsShared';

interface AccountsEnginePanelProps extends BasePanelProps {
  accounts: Account[];
  activeContext: string;
  onSelectContext: (ctx: string) => void;
  onOpenAddAccount: () => void;
  onOpenDataCatalog: () => void;
  onAccountsUpdated: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  proxyStatus: ProxyStatusResponse | null;
  onProxyStatusRefresh: () => Promise<void>;
  weatherData: SolarWeatherResponse | null;
  rawStatusText: string;
  todayRawSeries?: any[];
  liveFlow?: LiveFlowData | null;
  onLogout?: () => void;
}

export const AccountsEnginePanel: React.FC<AccountsEnginePanelProps> = ({
  accounts,
  onOpenAddAccount,
  onAccountsUpdated,
  onRefresh,
  isRefreshing,
  onProxyStatusRefresh,
  weatherData,
  rawStatusText,
  onLogout,
}) => {
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isRebuildingCache, setIsRebuildingCache] = useState(false);
  const [engineFeedback, setEngineFeedback] = useState<string | null>(null);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    const res = await ApiService.testCloudConnection();
    setTestResult(res);
    setIsTestingConn(false);
    setTimeout(() => setTestResult(null), 5000);
  };

  const handleRemoveAccount = async (id: string) => {
    await ApiService.removeAccount(id);
    setConfirmRemoveId(null);
    await onAccountsUpdated();
  };

  const handleRebuildCaches = async () => {
    setIsRebuildingCache(true);
    setEngineFeedback(null);
    const res = await ApiService.refreshBackendCaches();
    if (res && res.errno === 0) {
      setEngineFeedback('Successfully refreshed 365-day satellite weather history.');
      await Promise.all([onRefresh(), onProxyStatusRefresh()]);
    } else {
      setEngineFeedback('Failed to rebuild satellite cache. Check server logs.');
    }
    setIsRebuildingCache(false);
    setTimeout(() => setEngineFeedback(null), 5000);
  };

  const baseline = weatherData?.annualBaseline;

  return (
    <div className="p-5 sm:p-6 space-y-6 max-w-3xl">
      {/* 1. CONNECTED WAAREE CLOUD ACCOUNT */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              Connected Waaree Cloud Account
            </h4>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Live link to digital.waaree.com for automated rooftop telemetry sync.
            </p>
          </div>

          {accounts.length === 0 && (
            <button
              type="button"
              onClick={onOpenAddAccount}
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" /> Connect Account
            </button>
          )}
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[12.5px] text-slate-500 space-y-2">
            <p>No Waaree cloud account connected yet.</p>
            <button
              type="button"
              onClick={onOpenAddAccount}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 cursor-pointer"
            >
              Connect Waaree Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-3 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[14px] font-bold text-slate-900 truncate">
                        {acc.username}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Live Connected
                      </span>
                    </div>
                    <div className="text-[11.5px] text-slate-500 mt-1 truncate">
                      Last inverter packet: {rawStatusText || 'Live streaming'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isTestingConn}
                      onClick={handleTestConnection}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Radio className="w-3.5 h-3.5 text-emerald-600" />
                      {isTestingConn ? 'Testing...' : 'Test Connection'}
                    </button>

                    <button
                      type="button"
                      disabled={isRefreshing}
                      onClick={() => void onRefresh()}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
                      Sync Now
                    </button>

                    {confirmRemoveId === acc.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveAccount(acc.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-medium text-slate-600 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(acc.id)}
                        aria-label="Remove account"
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Test Connection Feedback */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-[12px] flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>
                      {testResult.message} ({testResult.latencyMs}ms response)
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. SOLAR WEATHER BASELINE ARCHIVE */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CloudSun className="w-4 h-4 text-sky-600" />
              365-Day Solar Weather History
            </h4>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Satellite irradiance and clear-sky benchmark data for your rooftop array.
            </p>
          </div>

          <button
            type="button"
            disabled={isRebuildingCache}
            onClick={handleRebuildCaches}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRebuildingCache ? 'animate-spin text-sky-600' : ''}`} />
            {isRebuildingCache ? 'Rebuilding...' : 'Rebuild Weather Cache'}
          </button>
        </div>

        {baseline && (
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/70 text-[12px] flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-800">
              Weather Archive Period: {baseline.startYmd} to {baseline.endYmd}
            </span>
            <span className="text-emerald-700 font-bold tabular-nums">
              Expected Annual Benchmark: ~{baseline.annualKwhPerKwp.toFixed(0)} kWh/kWp
            </span>
          </div>
        )}

        {engineFeedback && (
          <p className="text-[11.5px] font-medium text-emerald-700 mt-2">{engineFeedback}</p>
        )}
      </div>

      {/* 3. SESSION & SIGN OUT */}
      {onLogout && (
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[12.5px] font-bold text-slate-800 block">Sign Out &amp; Lock System</span>
            <span className="text-[11.5px] text-slate-500">
              Disconnects your current session and locks the dashboard.
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50/60 text-rose-700 text-[12px] font-bold hover:bg-rose-100 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Log Out
          </button>
        </div>
      )}
    </div>
  );
};
