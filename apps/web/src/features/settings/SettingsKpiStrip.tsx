import React from 'react';
import {
  formatAzimuthLabel,
  formatInrCompact,
  getTechPresetLabel,
} from './settingsFormatters';
import type {
  Account,
  CanonicalSolarSnapshot,
  PersistedAppSettings,
  ProxyStatusResponse,
  SolarWeatherResponse,
} from '@solar-track/core';

interface SettingsKpiStripProps {
  settings: PersistedAppSettings;
  canonicalSnapshot: CanonicalSolarSnapshot;
  accounts: Account[];
  proxyStatus: ProxyStatusResponse | null;
  weatherData: SolarWeatherResponse | null;
  syncMeta: { sseConnected: boolean; syncedAtIstLabel: string };
}

export const SettingsKpiStrip: React.FC<SettingsKpiStripProps> = ({
  settings,
  canonicalSnapshot,
  accounts,
  proxyStatus,
  weatherData,
  syncMeta,
}) => {
  const capacityKwp = settings.systemCapacity || canonicalSnapshot.config.capacityKwp || 3.0;
  const tilt = settings.arrayTiltDeg ?? 26.5;
  const azimuth = settings.arrayAzimuthDeg ?? 0;
  const techLabel = getTechPresetLabel(settings.panelTechPreset);

  const effectivePrPct = canonicalSnapshot.effectivePrBreakdown.prPct.toFixed(1);

  const subsidy = Math.max(0, Number(settings.govtSubsidyInr) || 0);
  const netCapex = Math.max(0, (Number(settings.systemCost) || 180000) - subsidy);

  const armedGuardsCount = [
    settings.packetAlertsEnabled,
    settings.alertOfflineDelay,
    settings.alertMorningYield,
    settings.alertUnderperformance,
    settings.alertVoltageSpike,
  ].filter(Boolean).length;

  const isBackoff = Boolean(proxyStatus?.backoffActive);
  const feedDotCls = isBackoff
    ? 'bg-amber-500'
    : syncMeta.sseConnected
      ? 'bg-emerald-500'
      : 'bg-sky-500';
  const feedHeadline = isBackoff
    ? `Cooldown ${Math.ceil((proxyStatus?.backoffRemainingSec || 0) / 60)}m`
    : syncMeta.sseConnected
      ? 'Live Stream & Proxy Active'
      : 'Polling Fallback';

  const archiveBadge = weatherData?.annualBaseline
    ? `Archive ${weatherData.annualBaseline.annualKwhPerKwp.toFixed(0)} kWh/kWp`
    : 'Archive awaiting sync';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100 bg-white">
      {/* 1. Array & Physics */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Solar Array Setup
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[19px] font-extrabold text-slate-900 tabular-nums tracking-tight">
            {capacityKwp.toFixed(2)} kWp
          </span>
          <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
            {tilt.toFixed(1)}° / {formatAzimuthLabel(azimuth)}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 truncate">
          {techLabel} · {effectivePrPct}% System Efficiency · °{settings.tempUnit}
        </div>
      </div>

      {/* 2. Utility & Capital */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          Electricity &amp; Investment
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[19px] font-extrabold text-slate-900 tabular-nums tracking-tight">
            ₹{settings.tariffPerKwh.toFixed(2)}/u
          </span>
          <span className="text-[11px] font-semibold text-emerald-700 tabular-nums">
            Net {formatInrCompact(netCapex)}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 truncate">
          Billing starts Day {settings.billingCycleDay} · Panels degrade {(settings.panelDegradationPctYr ?? 0.55).toFixed(2)}%/yr
        </div>
      </div>

      {/* 3. Armed Guards & Soiling */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${armedGuardsCount >= 3 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          Alert Guards &amp; Panel Care
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[19px] font-extrabold text-slate-900 tabular-nums tracking-tight">
            {armedGuardsCount} of 5 Guards Active
          </span>
          <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
            Wash trigger: {Number(settings.washRecommendPct ?? 7).toFixed(1)}% loss
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 truncate">
          Offline ≥{settings.offlineDelayMinutes ?? 30}m · Drift &lt;{settings.underperformanceThresholdPct ?? 82}% · Rain {(settings.rainResetDailyMm ?? 5).toFixed(1)}mm
        </div>
      </div>

      {/* 4. Cloud & Satellite Feed */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${feedDotCls}`} />
          Data Connections
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[17px] font-extrabold text-slate-900 tracking-tight truncate">
            {feedHeadline}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 truncate">
          {accounts.length} acct · Poll every {settings.weatherCacheTtlMin ?? 12}m · {archiveBadge}
        </div>
      </div>
    </div>
  );
};
