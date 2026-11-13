import React from 'react';
import {
  formatINR,
  type CanonicalSolarSnapshot,
  type DiscomCycleBreakdown,
  type PaybackHorizonAnalysis,
} from '@solar-track/core';

interface FinancialsKpiStripProps {
  payback: PaybackHorizonAnalysis;
  discom: DiscomCycleBreakdown;
  canonicalSnapshot: CanonicalSolarSnapshot;
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
  payback,
  discom,
  canonicalSnapshot,
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

  const col1: FinKpiCol = {
    eyebrow: isWhatIfActive ? 'Projected Lifetime Value' : 'Total Lifetime Saved',
    accentDot: 'emerald',
    primary: formatINR(headlineSavedInr),
    primaryTone: 'emerald',
    primaryUnit: `${headlineLifetimeKwh.toFixed(1)} kWh`,
    rightMeta: `${headlinePaidOffPct}% of system paid off`,
    subtitle:
      payback.unloggedSavedInr > 0
        ? `${formatINR(payback.confirmedSavedInr)} Cloud + ${formatINR(payback.unloggedSavedInr)} ${canonicalSnapshot.lifetime.hardwareSource === 'waaree-api' ? 'Inverter Register' : canonicalSnapshot.lifetime.isEtotalAnchored ? 'LCD Synced' : 'Buffer'} · Net ${formatINR(payback.netCapexInr)}`
        : subsidyInr > 0
        ? `Net target ${formatINR(payback.netCapexInr)} (-₹${Math.round(subsidyInr / 1000)}k subsidy)`
        : `Remaining to CapEx: ${formatINR(payback.remainingInr)}`,
  };

  const hasCycleBuffer = discom.pendingUnitsKwh > 0.2;
  const headlineCycleUnits = hasCycleBuffer
    ? discom.accruedPlusPendingKwh
    : discom.confirmedUnitsKwh;

  const col2: FinKpiCol = {
    eyebrow: `Billing Cycle (Day ${discom.billingCycleDay})`,
    accentDot: hasCycleBuffer ? 'emerald' : 'sky',
    primary: hasCycleBuffer ? formatINR(discom.accruedPlusPendingInr) : discom.confirmedFormatted,
    primaryTone: 'slate',
    primaryUnit: `${headlineCycleUnits.toFixed(1)} kWh`,
    rightMeta: `Day ${discom.daysElapsedInCycle}/${discom.cycleTotalDays}`,
    subtitle:
      discom.pendingUnitsKwh > 0.1
        ? `${discom.confirmedUnitsKwh.toFixed(1)} Cloud + ${discom.pendingUnitsKwh.toFixed(1)} Buffer (${discom.confirmedFormatted})`
        : `Cycle projection: ${formatINR(discom.projectedCycleInr)} (${discom.projectedCycleUnitsKwh} kWh)`,
  };

  const col3: FinKpiCol = {
    eyebrow: 'Full Payback Date',
    accentDot: payback.breakevenYears !== null && payback.breakevenYears <= 5 ? 'emerald' : 'sky',
    primary: payback.breakevenLabel,
    primaryTone: 'slate',
    primaryUnit: payback.breakevenYears !== null ? `~${payback.breakevenYears} yrs` : undefined,
    rightMeta: `${payback.annualizedCashYieldPct}% annual return`,
    subtitle: `First year savings: ${formatINR(payback.year1ProjectedInr)} (${payback.year1SeasonalKwh} kWh)`,
  };

  const col4: FinKpiCol = {
    eyebrow: 'Your Solar Cost',
    accentDot: 'emerald',
    primary: `₹${payback.lcoeAllInInrPerKwh.toFixed(2)}`,
    primaryTone: 'slate',
    primaryUnit: '/ unit (25y)',
    rightMeta: `Saves ₹${payback.lcoeSavingsSpreadInr.toFixed(2)}/u vs grid`,
    subtitle:
      washCostInr > 0
        ? `Incl. ${payback.washesPerYear} washes/yr (${formatINR(payback.annualWashExpenseInr)}/yr)`
        : `25-year net earnings: ${formatINR(payback.netProfit25YrInr)}`,
  };

  const cols: [FinKpiCol, FinKpiCol, FinKpiCol, FinKpiCol] = [col1, col2, col3, col4];

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
