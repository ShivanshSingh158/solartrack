import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  Trash2,
  Database,
  Activity,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { ApiService } from '../../shared/api/solarApi';
import {
  auditRawChannelsFromTelemetry,
  type Account,
  type LiveFlowData,
  type PersistedAppSettings,
  type ProxyStatusResponse,
  type SolarWeatherResponse,
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

const POLL_TTL_OPTIONS = [10, 12, 15, 20, 30];

export const AccountsEnginePanel: React.FC<AccountsEnginePanelProps> = ({
  settings,
  onUpdateSettings,
  canonicalSnapshot,
  accounts,
  activeContext,
  onSelectContext,
  onOpenAddAccount,
  onOpenDataCatalog,
  onAccountsUpdated,
  onRefresh,
  isRefreshing,
  proxyStatus,
  onProxyStatusRefresh,
  weatherData,
  rawStatusText,
  todayRawSeries,
  liveFlow,
  onLogout,
}) => {
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [isRebuildingCache, setIsRebuildingCache] = useState(false);
  const [engineFeedback, setEngineFeedback] = useState<string | null>(null);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    const res = await ApiService.testCloudConnection();
    setTestResult(res);
    setIsTestingConn(false);
  };

  const channels = useMemo(
    () =>
      auditRawChannelsFromTelemetry(
        todayRawSeries || [],
        liveFlow || null,
        canonicalSnapshot
      ),
    [todayRawSeries, liveFlow, canonicalSnapshot]
  );

  const channelCounts = useMemo(() => {
    let live = 0;
    let dormant = 0;
    let missing = 0;
    for (const c of channels) {
      if (c.state === 'LIVE_ACTIVE') live += 1;
      else if (c.state === 'STANDBY_NIGHT' || c.state === 'PHYSICS_MODEL') dormant += 1;
      else missing += 1;
    }
    return { total: channels.length, live, dormant, missing };
  }, [channels]);

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
      setEngineFeedback(
        `Rebuilt Open-Meteo weather & 365d archive (${res.archivePeriod || `${res.baselineMonths} months`})`
      );
      await Promise.all([onRefresh(), onProxyStatusRefresh()]);
    } else {
      setEngineFeedback('Failed to rebuild satellite caches. Check server logs.');
    }
    setIsRebuildingCache(false);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const src = parsed?.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed;
      const patch: Partial<PersistedAppSettings> = {};
      if (typeof src.tariffPerKwh === 'number') patch.tariffPerKwh = src.tariffPerKwh;
      if (typeof src.systemCapacity === 'number') patch.systemCapacity = src.systemCapacity;
      if (typeof src.dcCapacityKwp === 'number') patch.dcCapacityKwp = src.dcCapacityKwp;
      if (typeof src.acInverterCapacityKw === 'number') patch.acInverterCapacityKw = src.acInverterCapacityKw;
      if (src.mountingType === 'open_rack' || src.mountingType === 'flush_rcc') patch.mountingType = src.mountingType;
      if (typeof src.roofAlbedo === 'number') patch.roofAlbedo = src.roofAlbedo;
      if (typeof src.dcCleanFactor === 'number') patch.dcCleanFactor = src.dcCleanFactor;
      if (typeof src.useCalibratedTwin === 'boolean') patch.useCalibratedTwin = src.useCalibratedTwin;
      if (typeof src.kSiteOverride === 'number' || src.kSiteOverride === null) patch.kSiteOverride = src.kSiteOverride;
      if (typeof src.systemCost === 'number') patch.systemCost = src.systemCost;
      if (typeof src.govtSubsidyInr === 'number') patch.govtSubsidyInr = src.govtSubsidyInr;
      if (typeof src.panelWashCostInr === 'number') patch.panelWashCostInr = src.panelWashCostInr;
      if (typeof src.tariffEscalationPct === 'number') patch.tariffEscalationPct = src.tariffEscalationPct;
      if (typeof src.billingCycleDay === 'number') patch.billingCycleDay = src.billingCycleDay;
      if (typeof src.arrayTiltDeg === 'number') patch.arrayTiltDeg = src.arrayTiltDeg;
      if (typeof src.arrayAzimuthDeg === 'number') patch.arrayAzimuthDeg = src.arrayAzimuthDeg;
      if (src.panelTechPreset) patch.panelTechPreset = src.panelTechPreset;
      if (typeof src.thermalCoeffPerC === 'number') patch.thermalCoeffPerC = src.thermalCoeffPerC;
      if (typeof src.basePrAtStc === 'number') patch.basePrAtStc = src.basePrAtStc;
      if (typeof src.inverterEfficiency === 'number') patch.inverterEfficiency = src.inverterEfficiency;
      if (typeof src.panelDegradationPctYr === 'number') patch.panelDegradationPctYr = src.panelDegradationPctYr;
      if (typeof src.co2KgPerKwh === 'number') patch.co2KgPerKwh = src.co2KgPerKwh;
      if (src.tempUnit === 'C' || src.tempUnit === 'F') patch.tempUnit = src.tempUnit;
      if (src.plantDisplayName !== undefined) patch.plantDisplayName = src.plantDisplayName;
      if (src.commissioningDateOverride !== undefined) patch.commissioningDateOverride = src.commissioningDateOverride;
      if (src.plantLocation?.name && typeof src.plantLocation.lat === 'number' && typeof src.plantLocation.lon === 'number') {
        patch.plantLocation = src.plantLocation;
      }
      if (Object.keys(patch).length === 0) {
        setEngineFeedback('No valid SolarTrack config fields found in JSON file.');
      } else {
        await onUpdateSettings(patch);
        setEngineFeedback(`Imported ${Object.keys(patch).length} setting keys from ${file.name}.`);
      }
    } catch {
      setEngineFeedback('Invalid JSON configuration file.');
    } finally {
      e.target.value = '';
    }
  };

  const baseline = weatherData?.annualBaseline;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
      {/* LEFT COLUMN: Connected Waaree Accounts & Telemetry Registers */}
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            Connected Waaree Cloud Accounts ({accounts.length})
          </h4>
          <button
            type="button"
            onClick={onOpenAddAccount}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Account
          </button>
        </div>

        <div className="space-y-2.5">
          {accounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[12px] text-slate-500">
              No Waaree cloud account connected. Add your digital.waaree.com credentials to begin syncing inverter telemetry.
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[13px] font-bold text-slate-900 truncate">
                        {acc.username}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        {acc.plants?.length || 0} station{(acc.plants?.length || 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Last cloud packet: {rawStatusText}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isTestingConn}
                      onClick={handleTestConnection}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50"
                      title="Test live round-trip connection to Waaree Cloud API"
                    >
                      <Activity className={`w-3 h-3 text-emerald-600 ${isTestingConn ? 'animate-spin' : ''}`} />
                      Test Connection
                    </button>

                    <button
                      type="button"
                      disabled={isRefreshing}
                      onClick={() => void onRefresh()}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Sync
                    </button>

                    {confirmRemoveId === acc.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleRemoveAccount(acc.id)}
                          className="px-2 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700"
                        >
                          Confirm Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(acc.id)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200"
                        aria-label={`Remove account ${acc.username}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {Array.isArray(acc.plants) && acc.plants.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                    {acc.plants.map((p) => {
                      const isActive = activeContext === p.stationID;
                      return (
                        <button
                          key={p.stationID}
                          type="button"
                          onClick={() => onSelectContext(p.stationID)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            isActive
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {p.plantName} · {p.capacity || '3.00'} kWp
                        </button>
                      );
                    })}
                  </div>
                )}

                {testResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-between gap-2 border ${
                      testResult.success
                        ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200/80'
                        : 'bg-rose-50/80 text-rose-800 border-rose-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          testResult.success ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="truncate">{testResult.message}</span>
                    </div>
                    {testResult.latencyMs > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/70 border border-slate-200/60 tabular-nums shrink-0">
                        {testResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Real Hardware Channel Audit & Config Import */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[12px] font-bold text-slate-800">
                Inverter Telemetry Channels
              </div>
              <div className="text-[11px] text-slate-500">
                {channelCounts.live} live · {channelCounts.dormant} derived/standby · {channelCounts.missing} unpublished by dongle
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenDataCatalog}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50"
            >
              Inspect Raw Registers →
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleImportJson(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Import Config JSON
            </button>
          </div>
        </div>

        {/* Station Security & Session Enclave */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Waaree Cloud Session &amp; Access
            </h4>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
              AES-256 Protected
            </span>
          </div>

          <p className="text-[11px] text-slate-500">
            System authentication is strictly verified directly against your digital.waaree.com cloud credentials. Sessions are cryptographically isolated with SameSite=Strict cookies.
          </p>

          {onLogout && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span>Log Out &amp; Lock System</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Live Proxy Diagnostics, Weather TTL & 365d Archive Engine */}
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-sky-600" />
            Weather Engine &amp; Proxy Diagnostics
          </h4>
          {proxyStatus && (
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                proxyStatus.backoffActive
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {proxyStatus.backoffActive
                ? `429 Backoff (${proxyStatus.backoffRemainingSec}s)`
                : 'Proxy Healthy'}
            </span>
          )}
        </div>

        {/* Open-Meteo Daytime Poll TTL */}
        <div className="rounded-xl border border-slate-200/80 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[13px] font-bold text-slate-800">Open-Meteo Daytime Poll TTL</div>
              <div className="text-[11px] text-slate-500">
                SSE heartbeats reuse cached satellite weather inside this window (nighttime fixed at 30m) to stay far below API quota limits.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {POLL_TTL_OPTIONS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => void onUpdateSettings({ weatherCacheTtlMin: mins })}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  (settings.weatherCacheTtlMin ?? 12) === mins
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>
        </div>

        {/* 365-Day Archive Baseline Card */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-bold text-slate-800">365-Day Satellite Baseline Archive</div>
            <button
              type="button"
              disabled={isRebuildingCache}
              onClick={() => void handleRebuildCaches()}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${isRebuildingCache ? 'animate-spin' : ''}`} />
              Rebuild Caches
            </button>
          </div>

          {baseline ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-2">
                <div className="text-slate-400 font-semibold uppercase text-[10px]">Archive Window</div>
                <div className="font-bold text-slate-800 tabular-nums mt-0.5">
                  {baseline.startYmd} → {baseline.endYmd}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-2">
                <div className="text-slate-400 font-semibold uppercase text-[10px]">Site Yield Index</div>
                <div className="font-bold text-emerald-700 tabular-nums mt-0.5">
                  {baseline.annualKwhPerKwp.toFixed(1)} kWh/kWp/yr
                </div>
              </div>
              <div className="bg-white rounded-lg border border-slate-200/80 px-2.5 py-2 col-span-2 sm:col-span-1">
                <div className="text-slate-400 font-semibold uppercase text-[10px]">Geometry</div>
                <div className="font-bold text-slate-800 tabular-nums mt-0.5">
                  {baseline.tiltDegrees ?? settings.arrayTiltDeg}° tilt · {baseline.azimuthDegrees ?? settings.arrayAzimuthDeg ?? 0}° az
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Archive baseline is being hydrated from Open-Meteo for your site coordinates &amp; tilt angle.
            </p>
          )}
        </div>

        {/* Live Proxy Diagnostics Ledger */}
        <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 text-[11px]">
          <div className="px-3.5 py-2 flex items-center justify-between bg-slate-50/70">
            <span className="font-bold text-slate-600 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              Live Server Protection Telemetry
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              {proxyStatus?.activeFlowCachedStations?.length ?? 0} cached flow · {proxyStatus?.lastKnownCachedEndpointsCount ?? 0} fallback keys
            </span>
          </div>
          {proxyStatus ? (
            Object.entries(proxyStatus.rules).map(([key, val]) => (
              <div key={key} className="px-3.5 py-2 flex items-start justify-between gap-3">
                <span className="font-semibold text-slate-500 shrink-0">
                  {key
                    .replace(/^rule\d+_/, '')
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^\w/, (ch) => ch.toUpperCase())}
                </span>
                <span className="text-slate-800 font-medium text-right">{val}</span>
              </div>
            ))
          ) : (
            <div className="px-3.5 py-3 text-slate-400 text-center">Loading proxy status...</div>
          )}
        </div>

        {engineFeedback && (
          <div
            className={`rounded-xl px-3 py-2 text-[11px] font-semibold flex items-center gap-2 border ${
              engineFeedback.toLowerCase().includes('fail') || engineFeedback.toLowerCase().includes('invalid')
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {engineFeedback.toLowerCase().includes('fail') ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{engineFeedback}</span>
          </div>
        )}
      </div>
    </div>
  );
};
