import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Clock,
  Cpu,
  Droplets,
  HardDrive,
  Radio,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import type { CanonicalSolarSnapshot, SystemHealthReport } from '@solar-track/core';

export interface ThermalStressLedgerCardProps {
  report: SystemHealthReport;
  canonicalSnapshot: CanonicalSolarSnapshot;
  onNavigateToSettings: () => void;
}

export const ThermalStressLedgerCard: React.FC<ThermalStressLedgerCardProps> = ({
  report,
  canonicalSnapshot,
  onNavigateToSettings,
}) => {
  const { thermalStress, mpptTiming } = report;
  const { sun } = canonicalSnapshot;

  return (
    <section className="rounded-3xl apple-glass-static p-5 sm:p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div>
            <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-500" />
              Thermal Stress & Panel Wake Audit
            </h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Panel operating temperature and morning startup timing
            </p>
          </div>
          <div className="text-right shrink-0">
            <div
              className={`text-[17px] font-extrabold tabular-nums leading-none ${
                mpptTiming.status === 'lag_warning'
                  ? 'text-rose-600'
                  : mpptTiming.status === 'moderate'
                    ? 'text-amber-600'
                    : 'text-emerald-700'
              }`}
            >
              {mpptTiming.wakeLagMinutes !== null
                ? `${mpptTiming.wakeLagMinutes > 0 ? '+' : ''}${mpptTiming.wakeLagMinutes} min`
                : 'On Time'}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Morning wake timing</div>
          </div>
        </div>

        <dl className="divide-y divide-slate-100 text-[12px]">
          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Thermometer className="w-3.5 h-3.5 text-slate-400" />
              Panel Cell Temperature:
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {thermalStress.cellTempFormatted} · Outdoor {thermalStress.ambientTempFormatted}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              Heat Derating & Headroom:
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              -{thermalStress.heatDeratingPct.toFixed(1)}% power impact ({thermalStress.thermalSafetyMarginC}°C safe headroom)
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Wind className="w-3.5 h-3.5 text-slate-400" />
              Natural Wind Cooling:
            </dt>
            <dd
              className={`font-semibold text-right tabular-nums ${
                thermalStress.gustAlert ? 'text-amber-700' : 'text-slate-800'
              }`}
            >
              {thermalStress.windSpeedKmh} km/h sustained
              {thermalStress.windGustsKmh !== null ? ` · ${thermalStress.windGustsKmh} km/h gusts` : ''}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Sun className="w-3.5 h-3.5 text-slate-400" />
              First Solar Watt Generated:
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {mpptTiming.firstWattMin !== null
                ? `${mpptTiming.firstWattText} (Dawn was ${mpptTiming.sunriseText})`
                : mpptTiming.headline}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Evening Sleep vs Sunset:
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {mpptTiming.lastWattMin !== null
                ? `${mpptTiming.lastWattText} (Sunset ${mpptTiming.sunsetText})`
                : `Sunset window ${sun.sunsetText}`}
            </dd>
          </div>
        </dl>
      </div>

      <div className="pt-3 mt-1 border-t border-slate-100 text-[11px] font-medium text-slate-500 flex items-center justify-between gap-2">
        <span className="truncate">{mpptTiming.detail}</span>
        <button
          type="button"
          onClick={onNavigateToSettings}
          className="text-emerald-700 hover:text-emerald-800 font-semibold shrink-0 inline-flex items-center gap-0.5 cursor-pointer"
        >
          Alert Rules <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </section>
  );
};

export interface CloudOutageLedgerCardProps {
  report: SystemHealthReport;
  canonicalSnapshot: CanonicalSolarSnapshot;
  lastUpdateDate: string;
  syncMeta: {
    syncedAtIstLabel: string;
    sseConnected: boolean;
    nextPollInSec: number;
    inBackoff: boolean;
    backoffRemainingSec: number;
  };
  onInspectDayInPerformance: (ymd: string) => void;
}

export const CloudOutageLedgerCard: React.FC<CloudOutageLedgerCardProps> = ({
  report,
  canonicalSnapshot,
  lastUpdateDate,
  syncMeta,
  onInspectDayInPerformance,
}) => {
  const { logger, pendingEepromDays, unloggedOutageDays, clearSkyHealthPct, clearCheckDaysCount } = report;
  const { soiling, weatherNow, effectivePrBreakdown } = canonicalSnapshot;

  return (
    <section className="rounded-3xl apple-glass-static p-5 sm:p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div>
            <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-600" />
              Cloud Outage & Logger History
            </h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Datalogger communication integrity & sync verification
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[17px] font-extrabold text-slate-900 tabular-nums leading-none">
              {clearSkyHealthPct !== null ? `${clearSkyHealthPct}%` : '—'}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Verified sync ({clearCheckDaysCount}d)
            </div>
          </div>
        </div>

        <dl className="divide-y divide-slate-100 text-[12px]">
          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Radio className="w-3.5 h-3.5 text-slate-400" />
              Live Inverter Feed Status:
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {syncMeta.inBackoff
                ? `Retrying (${syncMeta.backoffRemainingSec}s)`
                : `${syncMeta.sseConnected ? 'Connected (Live Stream)' : 'Active (Polling)'} · ${
                    syncMeta.syncedAtIstLabel || lastUpdateDate
                  }`}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              Packet Delivery Reliability:
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {logger.rawDeliveryPct !== null
                ? `${logger.rawDeliveryPct}% (${logger.rawReceivedSlots}/${logger.expectedSlots} packets received)`
                : logger.daylightSyncNote}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              Wi-Fi Outages & Missing Days:
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {unloggedOutageDays.length === 0 && pendingEepromDays.length === 0 ? (
                <span className="text-emerald-700">All period days verified (0 missing)</span>
              ) : (
                <span className={unloggedOutageDays.length > 0 ? 'text-rose-700' : 'text-amber-700'}>
                  {[
                    unloggedOutageDays.length > 0
                      ? `${unloggedOutageDays.map((d) => d.shortLabel).join(', ')} (${unloggedOutageDays.length}d offline)`
                      : '',
                    pendingEepromDays.length > 0
                      ? `${pendingEepromDays.map((d) => d.shortLabel).join(', ')} (${pendingEepromDays.length}d pending sync)`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Droplets className="w-3.5 h-3.5 text-slate-400" />
              Surface Cleanliness:
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {100 - Math.round(soiling.surfaceLossPct)}% clean (-{soiling.surfaceLossPct.toFixed(1)}% dust) ·{' '}
              {effectivePrBreakdown.smogLossPct <= 0
                ? 'Clear sky'
                : `-${effectivePrBreakdown.smogLossPct.toFixed(1)}% smog`}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Sun className="w-3.5 h-3.5 text-slate-400" />
              Latest Reading & Sun Strength:
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {canonicalSnapshot.truth.relativeAgo} · {weatherNow.conditionLabel} ({weatherNow.gtiWm2} W/m²)
            </dd>
          </div>
        </dl>
      </div>

      <div className="pt-3 mt-1 border-t border-slate-100 text-[11px] font-medium text-slate-500 flex items-center justify-between gap-2">
        <span className="truncate">
          {unloggedOutageDays.length > 0
            ? `Offline gap recorded · Full data preserved in inverter registers`
            : `All daily telemetry packets synchronized and verified`}
        </span>
        <button
          type="button"
          onClick={() =>
            onInspectDayInPerformance(
              unloggedOutageDays[0]?.ymd || pendingEepromDays[0]?.ymd || canonicalSnapshot.clock.ymd,
            )
          }
          className="text-emerald-700 hover:text-emerald-800 font-semibold shrink-0 inline-flex items-center gap-0.5 cursor-pointer"
        >
          Inspect 5-min curve <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </section>
  );
};

export interface HealthFooterLedgersProps {
  report: SystemHealthReport;
  canonicalSnapshot: CanonicalSolarSnapshot;
  lastUpdateDate: string;
  syncMeta: {
    syncedAtIstLabel: string;
    sseConnected: boolean;
    nextPollInSec: number;
    inBackoff: boolean;
    backoffRemainingSec: number;
  };
  onInspectDayInPerformance: (ymd: string) => void;
  onNavigateToSettings: () => void;
}

export const HealthFooterLedgers: React.FC<HealthFooterLedgersProps> = ({
  report,
  canonicalSnapshot,
  lastUpdateDate,
  syncMeta,
  onInspectDayInPerformance,
  onNavigateToSettings,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
      <div className="lg:col-span-6">
        <ThermalStressLedgerCard
          report={report}
          canonicalSnapshot={canonicalSnapshot}
          onNavigateToSettings={onNavigateToSettings}
        />
      </div>
      <div className="lg:col-span-6">
        <CloudOutageLedgerCard
          report={report}
          canonicalSnapshot={canonicalSnapshot}
          lastUpdateDate={lastUpdateDate}
          syncMeta={syncMeta}
          onInspectDayInPerformance={onInspectDayInPerformance}
        />
      </div>
    </div>
  );
};
