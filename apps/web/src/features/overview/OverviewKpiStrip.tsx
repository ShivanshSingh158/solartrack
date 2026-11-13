import React from 'react';
import { Leaf } from 'lucide-react';
import type { CanonicalSolarSnapshot, IstClockParts } from '@solar-track/core';

const CardSourceCue: React.FC<{
  kind: 'confirmed' | 'estimated' | 'through';
  label: string;
}> = ({ kind, label }) => {
  const dotClass =
    kind === 'confirmed'
      ? 'bg-emerald-500'
      : kind === 'estimated'
      ? 'bg-amber-500'
      : 'bg-slate-400';
  const textClass =
    kind === 'confirmed'
      ? 'text-emerald-700'
      : kind === 'estimated'
      ? 'text-amber-700'
      : 'text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap shrink-0 ${textClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
};

interface OverviewKpiStripProps {
  snap: CanonicalSolarSnapshot;
  istNow: IstClockParts;
  yesterdayIst: { upperLabel: string; shortLabel: string };
  isTodayConfirmed: boolean;
  isYesterdayConfirmed: boolean;
  isYesterdayUnloggedOutage: boolean;
  isPreSunrise: boolean;
  isPostSunset: boolean;
  isScrubbing?: boolean;
  todayOutputKwh: string;
  todayProgressPct: number;
  todayHardwarePeak: { peakKw: number; peakTimeLabel: string } | null;
  todaySatFullDayEst: number;
  todaySunriseText: string;
  todaySunsetText: string;
  yesterdayConfirmedYield: number;
  yesterdayEstYield: number;
  yesterdayPeakInfo: { peakKw: number; peakTimeLabel: string } | null;
  lastSyncedBenchmarkLabel: string;
  lastSyncedBenchmarkYield: number;
  monthSyncedLabel: string;
  offlinePendingDaysCount: number;
  monthHeadlineKwh: number;
  monthHeadlineSavingsInr: number;
  monthCloudBaseKwh: number;
  monthBufferDeltaKwh: number;
  monthHardwareSynced: boolean;
  resolvedMonthCueKind: 'confirmed' | 'estimated' | 'through';
  resolvedMonthCueLabel: string;
  confirmedActiveDaysCount: number;
  monthHeadlineAvgDaily: number;
  lifetimeHeadlineKwh: number;
  lifetimeHeadlineSavingsFormatted: string;
  lifetimeBufferDeltaKwh: number;
  lifetimeHardwareSynced: boolean;
  lifetimeHeadlineEnv: CanonicalSolarSnapshot['environmental']['lifetime'];
  syncAtIstLabel?: string;
  onOpenPhysicsModal: () => void;
}

export const OverviewKpiStrip: React.FC<OverviewKpiStripProps> = ({
  snap,
  istNow,
  yesterdayIst,
  isTodayConfirmed,
  isYesterdayConfirmed,
  isYesterdayUnloggedOutage: _isYesterdayUnloggedOutage,
  isPreSunrise: _isPreSunrise,
  isPostSunset: _isPostSunset,
  isScrubbing: _isScrubbing,
  todayOutputKwh,
  todayProgressPct,
  todayHardwarePeak,
  todaySatFullDayEst: _todaySatFullDayEst,
  todaySunriseText: _todaySunriseText,
  todaySunsetText,
  yesterdayConfirmedYield,
  yesterdayEstYield,
  yesterdayPeakInfo,
  lastSyncedBenchmarkLabel,
  lastSyncedBenchmarkYield: _lastSyncedBenchmarkYield,
  monthSyncedLabel: _monthSyncedLabel,
  offlinePendingDaysCount: _offlinePendingDaysCount,
  monthHeadlineKwh,
  monthHeadlineSavingsInr,
  monthCloudBaseKwh: _monthCloudBaseKwh,
  monthBufferDeltaKwh: _monthBufferDeltaKwh,
  monthHardwareSynced: _monthHardwareSynced,
  resolvedMonthCueKind: _resolvedMonthCueKind,
  resolvedMonthCueLabel: _resolvedMonthCueLabel,
  confirmedActiveDaysCount,
  monthHeadlineAvgDaily,
  lifetimeHeadlineKwh,
  lifetimeHeadlineSavingsFormatted,
  lifetimeBufferDeltaKwh: _lifetimeBufferDeltaKwh,
  lifetimeHardwareSynced: _lifetimeHardwareSynced,
  lifetimeHeadlineEnv,
  syncAtIstLabel: _syncAtIstLabel,
  onOpenPhysicsModal,
}) => {

  return (
    <>
      {/* Informational banner ONLY when inverter is offline / unsynced */}
      {(!isTodayConfirmed || !isYesterdayConfirmed) && (
        <div
          className={`rounded-2xl px-4 py-2.5 border flex flex-wrap items-center justify-between gap-2 text-xs transition-colors ${
            isTodayConfirmed
              ? 'bg-slate-50/90 border-slate-200/90 text-slate-800'
              : 'bg-amber-50/70 border-amber-200/85 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isTodayConfirmed ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <p className="font-medium leading-snug">
              {isTodayConfirmed ? (
                <>
                  <span className="font-semibold">Yesterday Wi-Fi Offline</span>
                  <span className="text-slate-600">
                    {' '}· Today live from hardware · Yesterday ({yesterdayIst.shortLabel}) unlogged in Cloud (~{yesterdayEstYield.toFixed(1)} kWh)
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold">⚠️ Inverter Standby</span>
                  <span className="text-amber-900/80">
                    {' '}({lastSyncedBenchmarkLabel} last connected) · Today's figures are model estimates (<span className="font-bold">~</span>)
                  </span>
                </>
              )}
            </p>
          </div>
          {!isTodayConfirmed && (
            <button
              type="button"
              onClick={onOpenPhysicsModal}
              className="text-[11px] font-semibold text-amber-900 hover:text-amber-700 underline decoration-amber-400/70 underline-offset-2 whitespace-nowrap cursor-pointer shrink-0"
            >
              How estimates work →
            </button>
          )}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: TODAY */}
        <div
          className={`p-5 card-floating-elevation flex flex-col justify-between min-h-[158px] ${
            isTodayConfirmed
              ? ''
              : '!bg-amber-50/30 !border-dashed !border-amber-300/90 hover:!border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-slate-400 font-semibold tracking-wider text-[11px] uppercase whitespace-nowrap">
              TODAY · {istNow.upperLabel}
            </span>
            <CardSourceCue
              kind={isTodayConfirmed ? 'confirmed' : 'estimated'}
              label={isTodayConfirmed ? 'Confirmed' : 'Estimated'}
            />
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                className={`text-[30px] sm:text-[32px] font-extrabold tracking-tight leading-none num ${
                  isTodayConfirmed ? 'text-slate-900' : 'text-amber-950'
                }`}
              >
                {todayOutputKwh}
              </span>
              <span className="text-sm font-semibold text-slate-400">kWh</span>
            </div>

            <div className="flex items-center gap-1.5 mt-1.5 text-[12.5px] font-semibold text-emerald-700">
              <span>₹{Math.round(parseFloat(todayOutputKwh || '0') * (snap.config.tariffPerKwh || 7.35))} saved today</span>
            </div>

            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isTodayConfirmed ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${todayProgressPct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
                {todayProgressPct}% of daylight
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[12px] font-medium text-slate-500">
            <span className="truncate">
              {todayHardwarePeak
                ? `Peak ${todayHardwarePeak.peakKw.toFixed(2)} kW @ ${todayHardwarePeak.peakTimeLabel}`
                : 'Inverter synced live'}
            </span>
            <span className="text-slate-400 font-medium text-[11px] shrink-0 tabular-nums">
              Sunset {todaySunsetText}
            </span>
          </div>
        </div>

        {/* CARD 2: YESTERDAY */}
        <div
          className={`p-5 card-floating-elevation flex flex-col justify-between min-h-[158px] ${
            isYesterdayConfirmed
              ? ''
              : '!bg-amber-50/30 !border-dashed !border-amber-300/90 hover:!border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-slate-400 font-semibold tracking-wider text-[11px] uppercase whitespace-nowrap">
              YESTERDAY · {yesterdayIst.upperLabel}
            </span>
            <CardSourceCue
              kind={isYesterdayConfirmed ? 'confirmed' : 'estimated'}
              label={isYesterdayConfirmed ? 'Confirmed' : 'Estimated'}
            />
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                className={`text-[30px] sm:text-[32px] font-extrabold tracking-tight leading-none num ${
                  isYesterdayConfirmed ? 'text-slate-900' : 'text-amber-950'
                }`}
              >
                {yesterdayConfirmedYield.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-400">kWh</span>
            </div>

            <div className="flex items-center gap-1.5 mt-1.5 text-[12.5px] font-semibold text-emerald-700">
              <span>₹{Math.round(yesterdayConfirmedYield * (snap.config.tariffPerKwh || 7.35))} saved</span>
            </div>

            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((yesterdayConfirmedYield / Math.max(0.5, yesterdayEstYield)) * 100))}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
                {Math.round((yesterdayConfirmedYield / Math.max(0.5, yesterdayEstYield)) * 100)}% of model
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[12px] font-medium text-slate-500">
            <span className="truncate">
              {yesterdayPeakInfo
                ? `Peak ${yesterdayPeakInfo.peakKw.toFixed(2)} kW @ ${yesterdayPeakInfo.peakTimeLabel}`
                : 'Day total archived'}
            </span>
            <span className="text-slate-400 font-medium text-[11px] shrink-0 tabular-nums">
              Model ~{yesterdayEstYield.toFixed(1)} kWh
            </span>
          </div>
        </div>

        {/* CARD 3: CURRENT MONTH MTD */}
        <div className="p-5 card-floating-elevation flex flex-col justify-between min-h-[158px]">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-slate-400 font-semibold tracking-wider text-[11px] uppercase whitespace-nowrap">
              THIS MONTH ({istNow.monthUpper})
            </span>
            <CardSourceCue kind="confirmed" label="Inverter Synced" />
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[30px] sm:text-[32px] font-extrabold tracking-tight text-slate-900 leading-none num">
                {monthHeadlineKwh.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-400">kWh</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[12.5px] font-semibold text-emerald-700">
              <span>₹{monthHeadlineSavingsInr.toLocaleString('en-IN')} saved</span>
              <span className="text-slate-300 font-normal">·</span>
              <span className="text-[12px] font-medium text-slate-500">
                {confirmedActiveDaysCount} synced days
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all duration-500"
                  style={{ width: `${snap.month.progressPctOfMonth}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums shrink-0">
                Day {snap.clock.day}/{snap.clock.daysInMonth}
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[12px] font-medium text-slate-500">
            <span className="truncate">Avg: {monthHeadlineAvgDaily.toFixed(1)} kWh/day</span>
            <span className="text-slate-400 font-medium text-[11px] shrink-0 tabular-nums">
              Proj ~{snap.month.projectedKwh} kWh
            </span>
          </div>
        </div>

        {/* CARD 4: LIFETIME TOTAL */}
        <div className="p-5 card-floating-elevation flex flex-col justify-between min-h-[158px]">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-slate-400 font-semibold tracking-wider text-[11px] uppercase whitespace-nowrap">
              LIFETIME TOTAL
            </span>
            <CardSourceCue kind="confirmed" label="Hardware Verified" />
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[30px] sm:text-[32px] font-extrabold tracking-tight text-slate-900 leading-none num">
                {lifetimeHeadlineKwh.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-400">kWh</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[12.5px] font-semibold text-emerald-700">
              <span>{lifetimeHeadlineSavingsFormatted} total saved</span>
              <span className="text-slate-300 font-normal">·</span>
              <span className="text-[12px] font-medium text-slate-500">Net metering active</span>
            </div>
            <div className="mt-2.5 flex items-center gap-2 text-[12px] font-medium text-slate-500">
              <Leaf className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{lifetimeHeadlineEnv.co2Kg} kg CO₂ prevented</span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[12px] font-medium text-slate-500">
            <span className="truncate">Commissioned 3.27 kWp</span>
            <span className="text-emerald-700 font-semibold text-[11px] shrink-0">
              Clean Solar Power
            </span>
          </div>
        </div>
      </section>
    </>
  );
};
