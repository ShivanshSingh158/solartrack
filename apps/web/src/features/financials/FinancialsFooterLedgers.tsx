import React from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Coins,
  Droplets,
  IndianRupee,
  Receipt,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  formatINR,
  type CanonicalSolarSnapshot,
  type DiscomCycleBreakdown,
  type PaybackHorizonAnalysis,
  type ReconciledCashPnlSummary,
  type TimescaleMode,
} from '@solar-track/core';

interface FinancialsFooterLedgersProps {
  payback: PaybackHorizonAnalysis;
  discom: DiscomCycleBreakdown;
  pnlSummary: ReconciledCashPnlSummary;
  canonicalSnapshot: CanonicalSolarSnapshot;
  activeTariff: number;
  activeSystemCost: number;
  subsidyInr: number;
  washCostInr: number;
  tariffEscalationPct: number;
  onNavigateToSettings: () => void;
  onNavigateToPerformance: (mode?: TimescaleMode) => void;
}

export const FinancialsFooterLedgers: React.FC<FinancialsFooterLedgersProps> = ({
  payback,
  discom,
  pnlSummary,
  canonicalSnapshot,
  activeTariff,
  activeSystemCost,
  subsidyInr,
  washCostInr,
  tariffEscalationPct,
  onNavigateToSettings,
  onNavigateToPerformance,
}) => {
  const { soiling } = canonicalSnapshot;

  const sortedSeasons = [...payback.seasonalProfile].sort((a, b) => b.avgDailyKwh - a.avgDailyKwh);
  const peakMonth = sortedSeasons[0];
  const lowMonth = sortedSeasons[sortedSeasons.length - 1];

  // Clean now wash ROI payback days check when wash fee entered
  const dailySoilingLossInr = Math.max(0, soiling.recoverableKwhPerDay * activeTariff);
  const washBreakEvenDays =
    washCostInr > 0 && dailySoilingLossInr > 1
      ? Math.max(1, Math.round(washCostInr / dailySoilingLossInr))
      : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
      {/* LEFT (50% -> 6 cols): DISCOM BILLING, TARIFF & OPEN-METEO ARCHIVE BASIS */}
      <section className="lg:col-span-6 rounded-3xl card-floating-static p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-600" />
                DISCOM Billing & Solar Baseline
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {payback.baselineSource === 'open_meteo_365d_archive' && payback.archiveWindowLabel
                  ? `Open-Meteo 365d Archive (${payback.archiveWindowLabel}) · Calibrated ${payback.empiricalFactor}x`
                  : 'Live weather baseline (awaiting 365d archive sync)'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[17px] font-extrabold text-emerald-700 tabular-nums leading-none">
                {formatINR(discom.accruedPlusPendingInr)}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Cycle est. incl. unlogged</div>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 text-[12px]">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                Active DISCOM Billing Window
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {discom.cyclePeriodText} (Day {discom.daysElapsedInCycle}/{discom.cycleTotalDays})
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                Cloud Metered vs Unlogged Value
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {discom.confirmedFormatted} cloud
                {discom.pendingInr > 0 ? (
                  <span className="text-amber-700"> + {formatINR(discom.pendingInr)} unlogged</span>
                ) : (
                  ' · 0 unlogged'
                )}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Coins className="w-3.5 h-3.5 text-slate-400" />
                Utility Tariff & Escalation
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                ₹{activeTariff.toFixed(2)} / kWh
                {tariffEscalationPct > 0 ? ` (+${tariffEscalationPct.toFixed(1)}%/yr)` : ' · Flat rate'}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                Satellite Peak vs Monsoon/Winter Low
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {peakMonth && lowMonth
                  ? `${peakMonth.shortMonth} ${peakMonth.avgDailyKwh} kWh/d vs ${lowMonth.shortMonth} ${lowMonth.avgDailyKwh} kWh/d`
                  : `${payback.year1SeasonalKwh} kWh/yr`}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                Projected Year-1 Harvest & Cash
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {payback.year1SeasonalKwh.toLocaleString('en-IN')} kWh/yr · {formatINR(payback.year1ProjectedInr)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="pt-3 mt-1 border-t border-slate-100 text-[11px] font-medium text-slate-500 flex items-center justify-between gap-2">
          <span className="truncate">
            Cycle end estimate: {formatINR(discom.projectedCycleInr)} ({discom.projectedCycleUnitsKwh} kWh)
          </span>
          <button
            type="button"
            onClick={onNavigateToSettings}
            className="text-emerald-700 hover:text-emerald-800 font-semibold shrink-0 inline-flex items-center gap-0.5 cursor-pointer"
          >
            Edit Tariff & CapEx <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </section>

      {/* RIGHT (50% -> 6 cols): CASH P&L RECONCILIATION, WASH ROI & 25-YR RETURN */}
      <section className="lg:col-span-6 rounded-3xl card-floating-static p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-sky-600" />
                Cash P&L, Wash ROI & Asset Return
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                Reconciled {pnlSummary.daysCount}-day revenue bridge + 25-year PERC degradation model
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[17px] font-extrabold text-slate-900 tabular-nums leading-none">
                {formatINR(payback.netProfit25YrInr)}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 mt-0.5">25-yr net profit</div>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 text-[12px]">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                Reconciled Month Cash vs Ideal
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {formatINR(pnlSummary.earnedInr)} / {formatINR(pnlSummary.idealPotentialInr)} ideal ({pnlSummary.earnedPct}%)
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Droplets className="w-3.5 h-3.5 text-slate-400" />
                Soiling vs Wash Economics
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                -{formatINR(pnlSummary.soilLossInr)} surface film ·{' '}
                {washCostInr > 0
                  ? washBreakEvenDays !== null
                    ? `₹${washCostInr} wash recovers in ~${washBreakEvenDays}d`
                    : `${formatINR(payback.annualWashExpenseInr)}/yr`
                  : soiling.actionBadgeText}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Coins className="w-3.5 h-3.5 text-slate-400" />
                Net Cost Structure (Gross − Subsidy)
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {formatINR(activeSystemCost)}
                {subsidyInr > 0 ? ` − ${formatINR(subsidyInr)} = ${formatINR(payback.netCapexInr)}` : ' (₹0 subsidy)'}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                10-Year Net Gain & Tax-Free Yield
              </dt>
              <dd className="font-semibold text-emerald-700 text-right tabular-nums">
                {payback.netProfit10YrInr >= 0 ? '+' : ''}
                {formatINR(payback.netProfit10YrInr)} · {payback.annualizedCashYieldPct}%/yr yield
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                All-In Solar LCOE vs Grid Margin
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                ₹{payback.lcoeAllInInrPerKwh.toFixed(2)} solar vs ₹{activeTariff.toFixed(2)} grid (+₹
                {payback.lcoeSavingsSpreadInr.toFixed(2)}/kWh saved)
              </dd>
            </div>
          </dl>
        </div>

        <div className="pt-3 mt-1 border-t border-slate-100 text-[11px] font-medium text-slate-500 flex items-center justify-between gap-2">
          <span className="truncate">
            Weather clouds -{formatINR(pnlSummary.weatherDipInr)} · Wi-Fi Outage / Unlogged -{formatINR(pnlSummary.pendingOutageInr)}
          </span>
          <button
            type="button"
            onClick={() => onNavigateToPerformance('month')}
            className="text-emerald-700 hover:text-emerald-800 font-semibold shrink-0 inline-flex items-center gap-0.5 cursor-pointer"
          >
            Inspect Energy Ledger <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </section>
    </div>
  );
};
