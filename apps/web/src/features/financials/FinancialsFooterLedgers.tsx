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
import type { FinancialsStageView } from './FinancialsCockpitStage';

interface FinancialsFooterLedgersProps {
  stageView?: FinancialsStageView;
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
  stageView = 'payback',
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

  const sortedSeasons = payback.seasonalProfile.toSorted((a, b) => b.avgDailyKwh - a.avgDailyKwh);
  const peakMonth = sortedSeasons[0];
  const lowMonth = sortedSeasons[sortedSeasons.length - 1];

  const dailySoilingLossInr = Math.max(0, soiling.recoverableKwhPerDay * activeTariff);
  const washBreakEvenDays =
    washCostInr > 0 && dailySoilingLossInr > 1
      ? Math.max(1, Math.round(washCostInr / dailySoilingLossInr))
      : null;

  // View 1: DISCOM Billing & Solar Baseline Ledger (Dedicated to Bill Credits)
  const renderDiscomLedger = (isFullWidth: boolean) => (
    <section
      className={`${
        isFullWidth ? 'col-span-12' : 'lg:col-span-6'
      } rounded-3xl apple-glass-static p-5 sm:p-6 flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div>
            <h3 className="text-[13.5px] font-bold text-slate-900 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-600" />
              DISCOM Utility Billing & Tariff Baseline
            </h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {payback.archiveWindowLabel
                ? `365-Day Solar Weather History (${payback.archiveWindowLabel}) · Calibrated for rooftop array`
                : 'Live solar baseline (calibrated for rooftop array)'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[17px] font-extrabold text-emerald-700 tabular-nums leading-none">
              {formatINR(discom.accruedPlusPendingInr)}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">Cycle total incl. buffer</div>
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
              Meter Verified vs Pending Sync
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {discom.confirmedFormatted} verified
              {discom.pendingInr > 0 ? (
                <span className="text-amber-700"> + {formatINR(discom.pendingInr)} pending sync</span>
              ) : (
                ' · 100% Synced'
              )}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Coins className="w-3.5 h-3.5 text-slate-400" />
              Utility Grid Tariff
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              ₹{activeTariff.toFixed(2)} / kWh
              {tariffEscalationPct > 0 ? ` (+${tariffEscalationPct.toFixed(1)}%/yr escalation)` : ' · Flat rate'}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              Peak Harvest vs Winter Low
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
              Estimated Full-Month Total
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              ~{formatINR(discom.projectedCycleInr)} (~{discom.projectedCycleUnitsKwh} kWh)
            </dd>
          </div>
        </dl>
      </div>

      <div className="pt-3 mt-1 border-t border-slate-100 text-[11px] font-medium text-slate-500 flex items-center justify-between gap-2">
        <span className="truncate">
          Cycle ends in {discom.daysRemainingInCycle} days · Estimated bill credit: {formatINR(discom.projectedCycleInr)}
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
  );

  // View 2: Long-Term Wealth & 25-Year Asset Return Ledger (Dedicated to Investment Payback)
  const renderPaybackLedger = (isFullWidth: boolean) => (
    <section
      className={`${
        isFullWidth ? 'col-span-12' : 'lg:col-span-6'
      } rounded-3xl apple-glass-static p-5 sm:p-6 flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div>
            <h3 className="text-[13.5px] font-bold text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              10-Year Return & 25-Year Plant Wealth
            </h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Long-term asset growth based on standard panel aging and utility tariff escalation
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[17px] font-extrabold text-slate-900 tabular-nums leading-none">
              {formatINR(payback.netProfit25YrInr)}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">25-yr net earnings</div>
          </div>
        </div>

        <dl className="divide-y divide-slate-100 text-[12px]">
          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Coins className="w-3.5 h-3.5 text-slate-400" />
              Net Investment (Gross CapEx − Subsidy)
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {formatINR(activeSystemCost)}
              {subsidyInr > 0 ? ` − ${formatINR(subsidyInr)} = ${formatINR(payback.netCapexInr)}` : ' (₹0 subsidy)'}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              10-Year Net Gain & Yield
            </dt>
            <dd className="font-semibold text-emerald-700 text-right tabular-nums">
              {payback.netProfit10YrInr >= 0 ? '+' : ''}
              {formatINR(payback.netProfit10YrInr)} · {payback.annualizedCashYieldPct}%/yr return
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              Solar Cost per Unit vs Grid Tariff
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              ₹{payback.lcoeAllInInrPerKwh.toFixed(2)} solar vs ₹{activeTariff.toFixed(2)} grid (+₹
              {payback.lcoeSavingsSpreadInr.toFixed(2)}/kWh saved)
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              Projected Year-1 Harvest & Cash
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {payback.year1SeasonalKwh.toLocaleString('en-IN')} kWh/yr · {formatINR(payback.year1ProjectedInr)}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Droplets className="w-3.5 h-3.5 text-slate-400" />
              Panel Wash Economics
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {washCostInr > 0
                ? washBreakEvenDays !== null
                  ? `₹${washCostInr} wash recovers in ~${washBreakEvenDays} days`
                  : `${formatINR(payback.annualWashExpenseInr)}/yr (${payback.washesPerYear} washes)`
                : soiling.actionBadgeText}
            </dd>
          </div>
        </dl>
      </div>

      <div className="pt-3 mt-1 border-t border-slate-100 text-[11px] font-medium text-slate-500 flex items-center justify-between gap-2">
        <span className="truncate">
          Lifetime Net Wealth: {formatINR(payback.netProfit25YrInr)} over 25-year lifespan
        </span>
        <button
          type="button"
          onClick={onNavigateToSettings}
          className="text-emerald-700 hover:text-emerald-800 font-semibold shrink-0 inline-flex items-center gap-0.5 cursor-pointer"
        >
          Configure Investment <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </section>
  );

  // View 3: Cash Flow Attribution & Daily Reconciliation Ledger (Dedicated to Daily Cash Flow)
  const renderCashPnlLedger = (isFullWidth: boolean) => (
    <section
      className={`${
        isFullWidth ? 'col-span-12' : 'lg:col-span-6'
      } rounded-3xl apple-glass-static p-5 sm:p-6 flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div>
            <h3 className="text-[13.5px] font-bold text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-sky-600" />
              Daily Cash Reconciliation & Cleaning Economics
            </h3>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Reconciled across {pnlSummary.daysCount} days against theoretical clear-sky solar potential
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[17px] font-extrabold text-slate-900 tabular-nums leading-none">
              {formatINR(pnlSummary.earnedInr)}
            </div>
            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
              {pnlSummary.earnedPct}% realized
            </div>
          </div>
        </div>

        <dl className="divide-y divide-slate-100 text-[12px]">
          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
              Realized Cash vs Potential
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              {formatINR(pnlSummary.earnedInr)} / {formatINR(pnlSummary.idealPotentialInr)} ideal ({pnlSummary.earnedPct}%)
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Droplets className="w-3.5 h-3.5 text-slate-400" />
              Dust & Soiling Impact
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              -{formatINR(pnlSummary.soilLossInr)} surface film loss ·{' '}
              {washCostInr > 0
                ? washBreakEvenDays !== null
                  ? `₹${washCostInr} wash recovers in ~${washBreakEvenDays}d`
                  : `${formatINR(payback.annualWashExpenseInr)}/yr`
                : soiling.actionBadgeText}
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              Weather Cloud & Rain Dip
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              -{formatINR(pnlSummary.weatherDipInr)} ({pnlSummary.weatherDipPct}% atmospheric dip)
            </dd>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-3">
            <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Coins className="w-3.5 h-3.5 text-slate-400" />
              Pending / Transmission Delay
            </dt>
            <dd className="font-semibold text-slate-800 text-right tabular-nums">
              -{formatINR(pnlSummary.pendingOutageInr)} (recovers automatically upon meter refresh)
            </dd>
          </div>
        </dl>
      </div>

      <div className="pt-3 mt-1 border-t border-slate-100 text-[11px] font-medium text-slate-500 flex items-center justify-between gap-2">
        <span className="truncate">
          Total Month Potential: {formatINR(pnlSummary.idealPotentialInr)} · Realized: {formatINR(pnlSummary.earnedInr)}
        </span>
        <button
          type="button"
          onClick={() => onNavigateToPerformance('month')}
          className="text-emerald-700 hover:text-emerald-800 font-semibold shrink-0 inline-flex items-center gap-0.5 cursor-pointer"
        >
          Inspect Generation Log <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </section>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
      {stageView === 'payback' && renderPaybackLedger(true)}
      {stageView === 'cycle' && renderDiscomLedger(true)}
      {stageView === 'pnl' && renderCashPnlLedger(true)}
    </div>
  );
};
