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
  isYesterdayUnloggedOutage,
  isPreSunrise,
  isPostSunset,
  isScrubbing,
  todayOutputKwh,
  todayProgressPct,
  todayHardwarePeak,
  todaySatFullDayEst,
  todaySunriseText,
  todaySunsetText,
  yesterdayConfirmedYield,
  yesterdayEstYield,
  yesterdayPeakInfo,
  lastSyncedBenchmarkLabel,
  lastSyncedBenchmarkYield,
  monthSyncedLabel,
  offlinePendingDaysCount,
  monthHeadlineKwh,
  monthHeadlineSavingsInr,
  monthCloudBaseKwh,
  monthBufferDeltaKwh,
  monthHardwareSynced,
  resolvedMonthCueKind,
  resolvedMonthCueLabel,
  confirmedActiveDaysCount,
  monthHeadlineAvgDaily,
  lifetimeHeadlineKwh,
  lifetimeHeadlineSavingsFormatted,
  lifetimeBufferDeltaKwh,
  lifetimeHardwareSynced,
  lifetimeHeadlineEnv,
  syncAtIstLabel,
  onOpenPhysicsModal,
}) => {
  const truth = snap.truth;

  return (
    <>
      <div
        className={`rounded-2xl px-4 py-2.5 border flex flex-wrap items-center justify-between gap-2 text-xs transition-colors ${
          isTodayConfirmed && isYesterdayConfirmed
            ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
            : isTodayConfirmed
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
            {isTodayConfirmed && isYesterdayConfirmed ? (
              <>
                <span className="font-semibold">🟢 Rooftop Inverter Online</span>
                <span className="text-emerald-800/80">
                  {' '}· Synced ({syncAtIstLabel || truth.relativeAgo || 'just now'}) · All readings are from your rooftop meter
                </span>
              </>
            ) : isTodayConfirmed ? (
              <>
                <span className="font-semibold">🟢 Rooftop Inverter Online</span>
                <span className="text-slate-600">
                  {' '}· Today's data is live from hardware · Yesterday ({yesterdayIst.shortLabel}) Wi-Fi offline all day (unlogged in Cloud; Twin est. ~{yesterdayEstYield.toFixed(1)} kWh)
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold">⚠️ Inverter Not Synced Yet</span>
                <span className="text-amber-900/80">
                  {' '}({lastSyncedBenchmarkLabel} last connected) · Today's figures are model estimates (<span className="font-bold">~</span>) · Month &amp; Lifetime count Cloud Confirmed through {monthSyncedLabel}
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
            <span className="text-slate-500 font-semibold tracking-wider text-[11px] uppercase whitespace-nowrap">
              TODAY · {istNow.upperLabel}
            </span>
            <CardSourceCue
              kind={isTodayConfirmed || snap.today.bufferKwh >= 0.05 ? 'confirmed' : 'estimated'}
              label={
                snap.today.isManualGridOff
                  ? 'Grid Off (0 kWh)'
                  : snap.today.bufferKwh >= 0.05
                  ? `Inverter Memory + ${snap.today.bufferKwh.toFixed(1)} Cloud`
                  : snap.today.eepromConfirmedGapKwh >= 0.1
                  ? 'Hardware Verified + Live'
                  : snap.today.isHybridStitched
                  ? 'Combined Sources'
                  : isTodayConfirmed
                  ? 'Confirmed'
                  : 'Estimated'
              }
            />
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                className={`text-[30px] sm:text-[32px] font-extrabold tracking-tight leading-none num ${
                  isTodayConfirmed || snap.today.bufferKwh >= 0.05 ? 'text-slate-900' : 'text-amber-950'
                }`}
              >
                {isTodayConfirmed || snap.today.bufferKwh >= 0.05 ? todayOutputKwh : `~${todayOutputKwh}`}
              </span>
              <span className="text-sm font-semibold text-slate-500">kWh</span>
              <span className="text-xs font-medium text-slate-500 ml-0.5">
                {isPreSunrise
                  ? 'before sunrise'
                  : isPostSunset
                  ? isTodayConfirmed || snap.today.bufferKwh >= 0.05
                    ? 'final today'
                    : 'estimated full day'
                  : !isScrubbing && snap.today.bufferKwh >= 0.05
                  ? 'Cloud + Memory'
                  : !isScrubbing && isTodayConfirmed && snap.today.isPartialCurve
                  ? 'Final Daily Total'
                  : 'generated today'}
              </span>
            </div>

            {!isScrubbing && snap.today.bufferKwh >= 0.05 && (
              <div className="mt-1 text-[11px] font-semibold text-amber-800/90 tabular-nums truncate">
                {snap.today.cloudKwh.toFixed(2)} kWh from cloud + {snap.today.bufferKwh.toFixed(2)} kWh recovered from inverter memory
              </div>
            )}

            {!isScrubbing && snap.today.bufferKwh < 0.05 && snap.today.eepromConfirmedGapKwh >= 0.1 && (
              <div className="mt-1 text-[11px] font-semibold text-teal-700 tabular-nums truncate">
                Includes +{snap.today.eepromConfirmedGapKwh.toFixed(1)} kWh hardware-verified recovery
              </div>
            )}

            {!isScrubbing &&
              isTodayConfirmed &&
              snap.today.bufferKwh < 0.05 &&
              snap.today.isPartialCurve &&
              snap.today.realYieldFromCurveKwh > 0 &&
              snap.today.curveStartLabel &&
              snap.today.curveEndLabel && (
                <div className="mt-1 text-[11px] font-medium text-slate-500 tabular-nums truncate">
                  {snap.today.realYieldFromCurveKwh.toFixed(1)} kWh ({snap.today.curveStartLabel}–{snap.today.curveEndLabel} Curve)
                </div>
              )}

            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200/75 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isTodayConfirmed ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${todayProgressPct}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-600 tabular-nums shrink-0">
                {todayProgressPct}% of day
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2 text-[12px] font-medium text-slate-500">
            <span className="truncate">
              {snap.today.isHybridStitched
                ? `Hardware ${snap.today.confirmedPartKwh.toFixed(1)} kWh + Forecast ${snap.today.stitchedSatDeltaKwh.toFixed(1)} kWh`
                : isPreSunrise
                ? `Sunrise at ${todaySunriseText}`
                : isTodayConfirmed
                ? todayHardwarePeak
                  ? `Peak ${todayHardwarePeak.peakKw.toFixed(2)} kW @ ${todayHardwarePeak.peakTimeLabel}`
                  : 'Inverter synced live'
                : isPostSunset
                ? 'Daylight complete · Awaiting upload'
                : `Estimated full day: ~${todaySatFullDayEst.toFixed(1)} kWh`}
            </span>
            <span className="text-slate-600 font-semibold text-[11px] shrink-0 tabular-nums">
              {isPreSunrise || isTodayConfirmed
                ? `Est ~${todaySatFullDayEst.toFixed(1)} kWh`
                : `Sunset ${todaySunsetText}`}
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
            <span className="text-slate-500 font-semibold tracking-wider text-[11px] uppercase whitespace-nowrap">
              YESTERDAY · {yesterdayIst.upperLabel}
            </span>
            <CardSourceCue
              kind={isYesterdayConfirmed ? 'confirmed' : 'estimated'}
              label={
                isYesterdayConfirmed
                  ? 'Confirmed'
                  : isYesterdayUnloggedOutage
                  ? 'Unlogged · Est'
                  : 'Estimated'
              }
            />
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span
                className={`text-[30px] sm:text-[32px] font-extrabold tracking-tight leading-none num ${
                  isYesterdayConfirmed ? 'text-slate-900' : 'text-amber-950'
                }`}
              >
                {isYesterdayConfirmed ? yesterdayConfirmedYield.toFixed(1) : `~${yesterdayEstYield.toFixed(1)}`}
              </span>
              <span className="text-sm font-semibold text-slate-500">kWh</span>
              <span className="text-xs font-medium text-slate-500 ml-0.5">
                {isYesterdayConfirmed
                  ? 'final total'
                  : isYesterdayUnloggedOutage
                  ? 'unlogged est.'
                  : 'expected total'}
              </span>
            </div>

            <p className="mt-2 text-[12px] font-medium text-slate-600">
              {isYesterdayConfirmed
                ? `${Math.round((yesterdayConfirmedYield / Math.max(0.5, yesterdayEstYield)) * 100)}% of ~${yesterdayEstYield.toFixed(1)} kWh model`
                : isYesterdayUnloggedOutage
                ? 'Wi-Fi offline past midnight · Missed by Cloud'
                : 'Awaiting Wi-Fi sync before 00:00 IST'}
            </p>
          </div>

          <div className="pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2 text-[12px] font-medium text-slate-500">
            <span className="truncate">
              {isYesterdayConfirmed
                ? yesterdayPeakInfo
                  ? `Peak ${yesterdayPeakInfo.peakKw.toFixed(2)} kW @ ${yesterdayPeakInfo.peakTimeLabel}`
                  : 'Day energy archived'
                : `Last synced: ${lastSyncedBenchmarkLabel} (${lastSyncedBenchmarkYield.toFixed(1)} kWh)`}
            </span>
            <span className="text-slate-600 font-semibold text-[11px] shrink-0 tabular-nums">
              {isYesterdayConfirmed
                ? `${yesterdayConfirmedYield >= yesterdayEstYield ? '+' : ''}${(yesterdayConfirmedYield - yesterdayEstYield).toFixed(1)} vs est`
                : isYesterdayUnloggedOutage
                ? 'Twin Outage Est.'
                : 'Sat. Model'}
            </span>
          </div>
        </div>

        {/* CARD 3: CURRENT MONTH MTD */}
        <div className="p-5 card-floating-elevation flex flex-col justify-between min-h-[158px]">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-slate-500 font-semibold tracking-wider text-[11px] uppercase whitespace-nowrap">
              THIS MONTH ({istNow.monthUpper})
            </span>
            <CardSourceCue kind={resolvedMonthCueKind} label={resolvedMonthCueLabel} />
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[30px] sm:text-[32px] font-extrabold tracking-tight text-slate-900 leading-none num">
                {snap.month.isEmonthAnchored ? monthHeadlineKwh.toFixed(2) : monthHeadlineKwh.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-500">kWh</span>
              {!snap.month.isEmonthAnchored && monthBufferDeltaKwh > 0.05 && (
                <span className="text-xs font-medium text-slate-500 ml-0.5">total</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[12.5px] font-semibold text-emerald-700">
              <span>₹{monthHeadlineSavingsInr.toLocaleString('en-IN')} saved</span>
              <span className="text-slate-300 font-normal">·</span>
              <span className="text-[12px] font-medium text-slate-500">
                {confirmedActiveDaysCount} synced {confirmedActiveDaysCount === 1 ? 'day' : 'days'}
              </span>
            </div>
            {monthBufferDeltaKwh > 0.05 && (
              <div
                className={`mt-1 text-[11px] font-semibold tabular-nums ${
                  snap.month.isEmonthAnchored ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {snap.month.isEmonthAnchored
                  ? `${monthCloudBaseKwh.toFixed(1)} kWh Cloud + ${monthBufferDeltaKwh.toFixed(2)} kWh ${monthHardwareSynced ? 'Inverter Register' : 'LCD Synced'}`
                  : `${monthCloudBaseKwh.toFixed(1)} kWh Cloud + ${monthBufferDeltaKwh.toFixed(1)} kWh Outage Buffer`}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2.5">
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
            <span
              className={`font-semibold text-[11px] shrink-0 tabular-nums ${
                offlinePendingDaysCount > 0 && monthBufferDeltaKwh <= 0.1
                  ? 'text-amber-700'
                  : 'text-slate-600'
              }`}
            >
              {offlinePendingDaysCount > 0 && monthBufferDeltaKwh <= 0.1
                ? `+${offlinePendingDaysCount} ${offlinePendingDaysCount === 1 ? 'day' : 'days'} pending`
                : `Proj ~${snap.month.projectedKwh} kWh`}
            </span>
          </div>
        </div>

        {/* CARD 4: LIFETIME TOTAL */}
        <div className="p-5 card-floating-elevation flex flex-col justify-between min-h-[158px]">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-slate-500 font-semibold tracking-wider text-[11px] uppercase whitespace-nowrap">
              LIFETIME TOTAL
            </span>
            <CardSourceCue
              kind="confirmed"
              label={
                snap.lifetime.isEtotalAnchored
                  ? lifetimeHardwareSynced
                    ? 'Hardware Verified'
                    : 'Meter Reading'
                  : lifetimeBufferDeltaKwh > 0.1
                  ? 'Cloud + Recovered'
                  : 'Confirmed'
              }
            />
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[30px] sm:text-[32px] font-extrabold tracking-tight text-slate-900 leading-none num">
                {lifetimeHeadlineKwh.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-500">kWh</span>
              {!snap.lifetime.isEtotalAnchored && lifetimeBufferDeltaKwh > 0.1 && (
                <span className="text-xs font-medium text-slate-500 ml-0.5">total</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[12.5px] font-semibold text-emerald-700">
              <span>{lifetimeHeadlineSavingsFormatted} total saved</span>
              <span className="text-slate-300 font-normal">·</span>
              <span className="text-[12px] font-medium text-slate-500">Net metering active</span>
            </div>
            {lifetimeBufferDeltaKwh > 0.1 && (
              <div
                className={`mt-1 text-[11px] font-semibold tabular-nums ${
                  snap.lifetime.isEtotalAnchored ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {snap.lifetime.isEtotalAnchored
                  ? `${snap.lifetime.confirmedKwh.toFixed(1)} kWh Cloud + ${lifetimeBufferDeltaKwh.toFixed(1)} kWh ${lifetimeHardwareSynced ? 'Inverter Register' : 'LCD Synced'}`
                  : `${snap.lifetime.confirmedKwh.toFixed(1)} kWh Cloud + ${lifetimeBufferDeltaKwh.toFixed(1)} kWh Outage Buffer`}
              </div>
            )}
          </div>

          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[12px] font-medium text-slate-500">
            <span
              className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px] truncate"
              title={
                lifetimeBufferDeltaKwh > 0.1
                  ? `Cloud: ${snap.environmental.lifetime.co2Kg} kg · Total: ${lifetimeHeadlineEnv.co2Kg} kg CO₂ avoided`
                  : undefined
              }
            >
              <Leaf className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {lifetimeHeadlineEnv.co2Kg} kg CO₂ prevented
            </span>
            <span className="text-slate-500 text-[11px] shrink-0 tabular-nums">
              Since {snap.lifetime.commissioningDisplay.replace(/ 20\d\d$/, '')} · ≈ {Math.max(1, Math.round(lifetimeHeadlineEnv.co2KgNum / 21))} trees
            </span>
          </div>
        </div>
      </section>
    </>
  );
};
