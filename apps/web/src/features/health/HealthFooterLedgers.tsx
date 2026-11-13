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

interface HealthFooterLedgersProps {
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
  const { thermalStress, mpptTiming, logger, pendingEepromDays, unloggedOutageDays, clearSkyHealthPct, clearCheckDaysCount } = report;
  const { soiling, sun, weatherNow, effectivePrBreakdown } = canonicalSnapshot;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
      {/* LEFT (50% -> 6 cols): THERMAL STRESS & MPPT WAKE DIAGNOSTIC LEDGER */}
      <section className="lg:col-span-6 rounded-3xl card-floating-static p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-amber-500" />
                Thermal Stress & MPPT Wake Audit
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                NOCT silicon model + DC isolator wake lag check ({mpptTiming.basisLabel})
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
                  : '—'}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 mt-0.5">MPPT wake lag</div>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 text-[12px]">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Thermometer className="w-3.5 h-3.5 text-slate-400" />
                NOCT Cell / Ambient Temp
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {thermalStress.cellTempFormatted} cell · {thermalStress.ambientTempFormatted} ambient
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Activity className="w-3.5 h-3.5 text-slate-400" />
                Heat Derating & Headroom
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                -{thermalStress.heatDeratingPct.toFixed(1)}% ({thermalStress.tempFactorPct}% thermal eff ·{' '}
                {thermalStress.thermalSafetyMarginC}°C below 65°C)
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Wind className="w-3.5 h-3.5 text-slate-400" />
                Wind Cooling & Gussets
              </dt>
              <dd
                className={`font-semibold text-right tabular-nums ${
                  thermalStress.gustAlert ? 'text-amber-700' : 'text-slate-800'
                }`}
              >
                {thermalStress.windSpeedKmh} km/h sustained
                {thermalStress.windGustsKmh !== null ? ` · ${thermalStress.windGustsKmh} km/h gusts` : ''}
                {thermalStress.gustAlert ? ' (High Wind Check)' : ''}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Sun className="w-3.5 h-3.5 text-slate-400" />
                First Watt vs Astronomical Sunrise
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {mpptTiming.firstWattMin !== null
                  ? `${mpptTiming.firstWattText} vs ${mpptTiming.sunriseText} (${
                      mpptTiming.morningGtiAtWake !== null ? `${mpptTiming.morningGtiAtWake} W/m² GTI` : 'daylight'
                    })`
                  : mpptTiming.headline}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Evening Sleep vs Sunset
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {mpptTiming.lastWattMin !== null
                  ? `${mpptTiming.lastWattText} vs ${mpptTiming.sunsetText} sunset`
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

      {/* RIGHT (50% -> 6 cols): CLOUD OUTAGE, SYNC HEALTH & OPTICS PARITY LEDGER */}
      <section className="lg:col-span-6 rounded-3xl card-floating-static p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-600" />
                Cloud Outage & Logger Ledger
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                Strict raw cloud delivery vs interpolated healing & clear-sky drift
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[17px] font-extrabold text-slate-900 tabular-nums leading-none">
                {clearSkyHealthPct !== null ? `${clearSkyHealthPct}%` : '—'}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                Clear-sky ({clearCheckDaysCount}d)
              </div>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 text-[12px]">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Radio className="w-3.5 h-3.5 text-slate-400" />
                SSE Stream & Polling Heartbeat
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {syncMeta.inBackoff
                  ? `Backoff (${syncMeta.backoffRemainingSec}s) · ${syncMeta.syncedAtIstLabel || lastUpdateDate}`
                  : `${syncMeta.sseConnected ? 'SSE Live' : 'Polling'} · ${
                      syncMeta.syncedAtIstLabel || lastUpdateDate
                    }`}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Activity className="w-3.5 h-3.5 text-slate-400" />
                Raw Cloud Packets vs Healed
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {logger.rawDeliveryPct !== null
                  ? `${logger.rawDeliveryPct}% raw (${logger.rawReceivedSlots}/${logger.expectedSlots})${
                      logger.healedDropCount > 0 ? ` · ${logger.healedCoveragePct}% healed` : ''
                    }`
                  : logger.daylightSyncNote}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                Cloud Outage &amp; Pending Sync
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {unloggedOutageDays.length === 0 && pendingEepromDays.length === 0 ? (
                  <span className="text-emerald-700">0 days missing · Archive complete</span>
                ) : (
                  <span className={unloggedOutageDays.length > 0 ? 'text-rose-700' : 'text-amber-700'}>
                    {[
                      unloggedOutageDays.length > 0
                        ? `${unloggedOutageDays.map((d) => d.shortLabel).join(', ')} (${unloggedOutageDays.length}d unlogged Wi-Fi)`
                        : '',
                      pendingEepromDays.length > 0
                        ? `${pendingEepromDays.map((d) => d.shortLabel).join(', ')} (${pendingEepromDays.length}d pending <00:00)`
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
                Surface Glass & Haze Film
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                -{soiling.surfaceLossPct.toFixed(1)}% soil ·{' '}
                {effectivePrBreakdown.smogLossPct <= 0
                  ? `+${Math.abs(effectivePrBreakdown.smogLossPct).toFixed(1)}% clean sky`
                  : `-${effectivePrBreakdown.smogLossPct.toFixed(1)}% smog haze`}{' '}
                ({soiling.actionBadgeText})
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Sun className="w-3.5 h-3.5 text-slate-400" />
                Last Hardware Packet & Weather
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
              ? `Dongles wipe EDay at 00:00 IST; unlogged days use Twin est. or Settings LCD E-Total`
              : pendingEepromDays.length > 0
                ? `Same-day EDay accumulates offline until 00:00 IST midnight reset`
                : `Last packet ${canonicalSnapshot.truth.exactTimestampIST || 'Active'} · Zero unlogged days`}
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
    </div>
  );
};
