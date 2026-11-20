import React from 'react';
import {
  formatINR,
  type CanonicalSolarSnapshot,
  type DiscomCycleBreakdown,
  type PaybackHorizonAnalysis,
  type ReconciledCashPnlSummary,
} from '@solar-track/core';
import type { FinancialsStageView } from './FinancialsCockpitStage';

interface FinancialsKpiStripProps {
  stageView: FinancialsStageView;
  payback: PaybackHorizonAnalysis;
  discom: DiscomCycleBreakdown;
  pnlSummary: ReconciledCashPnlSummary;
  canonicalSnapshot: CanonicalSolarSnapshot;
  draftSystemCost: number;
  subsidyInr: number;
  washCostInr: number;
  isWhatIfActive: boolean;
}

interface FinKpiCol {
  eyebrow: string;
  accentDot: 'emerald' | 'sky' | 'amber' | 'slate';
  primary: string;
  primaryTone: 'slate' | 'emerald' | 'sky' | 'amber';
  primaryUnit?: string;
  rightMeta?: string;
  subtitle: string;
}

const DOT_CLASS: Record<FinKpiCol['accentDot'], string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
};

const TONE_CLASS: Record<FinKpiCol['primaryTone'], string> = {
  slate: 'text-slate-900',
  emerald: 'text-emerald-700',
  sky: 'text-sky-700',
  amber: 'text-amber-700',
};

export const FinancialsKpiStrip: React.FC<FinancialsKpiStripProps> = ({
  stageView,
  payback,
  discom,
  pnlSummary,
  canonicalSnapshot,
  draftSystemCost,
  subsidyInr,
  washCostInr,
  isWhatIfActive,
}) => {
  const hasLifetimeGapOrAnchor =
    payback.unloggedSavedInr > 0 || canonicalSnapshot.lifetime.isEtotalAnchored;
  const headlineSavedInr = hasLifetimeGapOrAnchor
    ? payback.physicalSavedInr
    : payback.confirmedSavedInr;
  const headlineLifetimeKwh = hasLifetimeGapOrAnchor
    ? canonicalSnapshot.lifetime.physicalTotalKwh
    : canonicalSnapshot.lifetime.confirmedKwh;
  const headlinePaidOffPct = hasLifetimeGapOrAnchor
    ? payback.physicalPaidOffPct
    : payback.paidOffPct;

  let cols: [FinKpiCol, FinKpiCol, FinKpiCol, FinKpiCol];

  if (stageView === 'cycle') {
    const cycleCompletionPct = Math.round(
      (discom.confirmedInr / Math.max(1, discom.projectedCycleInr)) * 100,
    );
    cols = [
      {
        eyebrow: 'Active Billing Cycle',
        accentDot: 'emerald',
        primary: discom.cyclePeriodText,
        primaryTone: 'slate',
        primaryUnit: `Day ${discom.daysElapsedInCycle}/${discom.cycleTotalDays}`,
        rightMeta: `${discom.daysRemainingInCycle} days left`,
        subtitle: 'DISCOM Net-Metered Window',
      },
      {
        eyebrow: 'Confirmed Bill Credit',
        accentDot: 'emerald',
        primary: discom.confirmedFormatted,
        primaryTone: 'emerald',
        primaryUnit: `${discom.confirmedUnitsKwh.toFixed(1)} kWh`,
        rightMeta: `${cycleCompletionPct}% of cycle`,
        subtitle: 'Verified by meter telemetry',
      },
      {
        eyebrow: 'Pending Sync Buffer',
        accentDot: discom.pendingInr > 0 ? 'amber' : 'slate',
        primary: `+${formatINR(discom.pendingInr)}`,
        primaryTone: discom.pendingInr > 0 ? 'amber' : 'slate',
        primaryUnit: `${discom.pendingUnitsKwh.toFixed(1)} kWh`,
        rightMeta: discom.pendingInr > 0 ? 'Awaiting sync' : '100% Synced',
        subtitle: 'Real-time generation buffer',
      },
      {
        eyebrow: 'Projected Cycle Total',
        accentDot: 'sky',
        primary: `~${formatINR(discom.projectedCycleInr)}`,
        primaryTone: 'slate',
        primaryUnit: `~${discom.projectedCycleUnitsKwh} kWh`,
        rightMeta: `Target: ₹${(discom.projectedCycleInr * 12).toLocaleString('en-IN')}/yr`,
        subtitle: 'Estimated full-month credit',
      },
    ];
  } else if (stageView === 'pnl') {
    cols = [
      {
        eyebrow: 'Month-to-Date Earned',
        accentDot: 'emerald',
        primary: formatINR(pnlSummary.earnedInr),
        primaryTone: 'emerald',
        primaryUnit: `${pnlSummary.earnedPct}% optimal`,
        rightMeta: `${pnlSummary.daysCount} days logged`,
        subtitle: 'Realized solar electricity savings',
      },
      {
        eyebrow: 'Weather Impact',
        accentDot: 'sky',
        primary: `-${formatINR(pnlSummary.weatherDipInr)}`,
        primaryTone: 'sky',
        primaryUnit: `${pnlSummary.weatherDipPct}% dip`,
        rightMeta: 'Clouds / Rain',
        subtitle: 'Natural atmospheric attenuation',
      },
      {
        eyebrow: 'Dust & Smog Dip',
        accentDot: 'amber',
        primary: `-${formatINR(pnlSummary.soilLossInr)}`,
        primaryTone: 'amber',
        primaryUnit: `${pnlSummary.soilLossPct}% dip`,
        rightMeta: 'Surface film',
        subtitle: 'Recoverable with module wash',
      },
      {
        eyebrow: 'Delay / Pending Sync',
        accentDot: 'slate',
        primary: `-${formatINR(pnlSummary.pendingOutageInr)}`,
        primaryTone: 'slate',
        primaryUnit: `${pnlSummary.pendingOutagePct}%`,
        rightMeta: 'Wi-Fi / Delay',
        subtitle: 'Recovers upon meter refresh',
      },
    ];
  } else {
    // stageView === 'payback'
    cols = [
      {
        eyebrow: isWhatIfActive ? 'Projected Lifetime Saved' : 'Total Lifetime Saved',
        accentDot: 'emerald',
        primary: formatINR(headlineSavedInr),
        primaryTone: 'emerald',
        primaryUnit: `${headlineLifetimeKwh.toFixed(1)} kWh`,
        rightMeta: `${headlinePaidOffPct}% of system paid off`,
        subtitle: `Remaining to CapEx: ${formatINR(payback.remainingInr)}`,
      },
      {
        eyebrow: 'Net Plant Investment',
        accentDot: 'slate',
        primary: formatINR(payback.netCapexInr),
        primaryTone: 'slate',
        primaryUnit: subsidyInr > 0 ? `Gross ${formatINR(draftSystemCost)}` : undefined,
        rightMeta:
          subsidyInr > 0
            ? `-₹${Math.round(subsidyInr / 1000)}k subsidy`
            : '₹0 subsidy',
        subtitle: `Initial rooftop investment`,
      },
      {
        eyebrow: 'Full Payback Date',
        accentDot: payback.breakevenYears !== null && payback.breakevenYears <= 5 ? 'emerald' : 'sky',
        primary: payback.breakevenLabel,
        primaryTone: 'slate',
        primaryUnit: payback.breakevenYears !== null ? `~${payback.breakevenYears} yrs` : undefined,
        rightMeta: `${payback.annualizedCashYieldPct}% annual yield`,
        subtitle: `First year savings: ${formatINR(payback.year1ProjectedInr)} (${payback.year1SeasonalKwh} kWh)`,
      },
      {
        eyebrow: 'Solar Cost per Unit',
        accentDot: 'emerald',
        primary: `₹${payback.lcoeAllInInrPerKwh.toFixed(2)}`,
        primaryTone: 'slate',
        primaryUnit: '/ unit (25y)',
        rightMeta: `Saves ₹${payback.lcoeSavingsSpreadInr.toFixed(2)}/u vs grid`,
        subtitle:
          washCostInr > 0
            ? `Incl. ${payback.washesPerYear} washes/yr (${formatINR(payback.annualWashExpenseInr)}/yr)`
            : `25-year net profit: ${formatINR(payback.netProfit25YrInr)}`,
      },
    ];
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/75 border-b border-slate-200/75 bg-slate-50/40">
      {cols.map((col, idx) => (
        <div
          key={`${col.eyebrow}-${idx}`}
          className="px-4 sm:px-5 py-3 flex flex-col justify-between gap-1 min-w-0"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASS[col.accentDot]}`} />
              <span className="truncate">{col.eyebrow}</span>
            </span>
            {col.rightMeta && (
              <span className="text-[10.5px] font-semibold text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                {col.rightMeta}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1.5 min-w-0">
            <span
              className={`text-[18px] sm:text-[19px] font-extrabold tracking-tight tabular-nums whitespace-nowrap ${
                TONE_CLASS[col.primaryTone]
              }`}
            >
              {col.primary}
            </span>
            {col.primaryUnit && (
              <span className="text-[11px] font-semibold text-slate-500 truncate tabular-nums">
                {col.primaryUnit}
              </span>
            )}
          </div>

          <div className="text-[11px] font-medium text-slate-500 tabular-nums truncate">
            {col.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
};
