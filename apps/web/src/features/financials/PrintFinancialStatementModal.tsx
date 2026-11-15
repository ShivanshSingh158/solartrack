import React from 'react';
import { Printer, X } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import {
  formatINR,
  type CanonicalSolarSnapshot,
  type DiscomCycleBreakdown,
  type PaybackHorizonAnalysis,
  type ReconciledCashPnlSummary,
} from '@solar-track/core';

export interface PrintFinancialStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  payback: PaybackHorizonAnalysis;
  discom: DiscomCycleBreakdown;
  pnlSummary: ReconciledCashPnlSummary;
  canonicalSnapshot: CanonicalSolarSnapshot;
  activeTariff: number;
  activeSystemCost: number;
  subsidyInr: number;
  washCostInr: number;
}

/**
 * Printable financial statement dialog: Asset summary, CapEx ROI,
 * LCOE, and 100% Reconciled Cash Flow Bridge.
 */
export const PrintFinancialStatementModal: React.FC<PrintFinancialStatementModalProps> = ({
  isOpen,
  onClose,
  payback,
  discom,
  pnlSummary,
  canonicalSnapshot,
  activeTariff,
  activeSystemCost,
  subsidyInr,
  washCostInr,
}) => {
  const { config, lifetime, clock } = canonicalSnapshot;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogBackdrop className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm print:hidden animate-in fade-in duration-200" />
      <DialogContent className="fixed inset-0 z-50 flex items-center justify-center p-4 print:bg-white print:p-0 pointer-events-none">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto print:shadow-none print:border-0 print:max-h-none">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 sticky top-0 bg-white z-10 print:hidden">
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900">Financial Return & DISCOM Statement</DialogTitle>
              <p className="text-[11px] font-medium text-slate-500">
                {config.locationName} · {config.capacityKwp.toFixed(1)} kWp · Generated {clock.indianMediumLabel}
              </p>
            </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-800 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close statement modal"
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 text-xs">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                SOLARTRACK ASSET SUMMARY
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">{config.locationName}</div>
              <div className="text-slate-500 mt-0.5">
                Commissioned {config.commissioningDisplay} · {config.capacityKwp.toFixed(2)} kWp ·
                Tariff ₹{activeTariff.toFixed(2)}/kWh
              </div>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-lg font-extrabold text-emerald-700">
                {formatINR(
                  payback.unloggedSavedInr > 0 || lifetime.isEtotalAnchored
                    ? payback.physicalSavedInr
                    : payback.confirmedSavedInr,
                )}
              </div>
              <div className="text-[11px] font-semibold text-slate-500">
                {(payback.unloggedSavedInr > 0 || lifetime.isEtotalAnchored
                  ? lifetime.physicalTotalKwh
                  : lifetime.confirmedKwh
                ).toFixed(1)}{' '}
                kWh total lifetime
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-2xl border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Net CapEx</div>
              <div className="text-sm font-extrabold text-slate-900 mt-1 tabular-nums">
                {formatINR(payback.netCapexInr)}
              </div>
              <div className="text-[10px] text-slate-500">
                {subsidyInr > 0
                  ? `${formatINR(activeSystemCost)} − ${formatINR(subsidyInr)}`
                  : `Gross ${formatINR(activeSystemCost)} · ₹0 subsidy`}
              </div>
            </div>
            <div className="p-3 rounded-2xl border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Breakeven</div>
              <div className="text-sm font-extrabold text-emerald-700 mt-1 tabular-nums">
                {payback.breakevenLabel}
              </div>
              <div className="text-[10px] text-slate-500">
                {payback.breakevenYears !== null ? `~${payback.breakevenYears} yrs` : '>25 yrs'}
              </div>
            </div>
            <div className="p-3 rounded-2xl border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">All-In LCOE</div>
              <div className="text-sm font-extrabold text-slate-900 mt-1 tabular-nums">
                ₹{payback.lcoeAllInInrPerKwh.toFixed(2)}/kWh
              </div>
              <div className="text-[10px] text-slate-500">
                {washCostInr > 0 ? `Incl ₹${washCostInr}/wash` : '25-yr avg cost'}
              </div>
            </div>
            <div className="p-3 rounded-2xl border border-slate-200/80">
              <div className="text-[10px] font-bold uppercase text-slate-400">Cycle Accrued</div>
              <div className="text-sm font-extrabold text-slate-900 mt-1 tabular-nums">
                {formatINR(discom.accruedPlusPendingInr)}
              </div>
              <div className="text-[10px] text-slate-500">
                {discom.confirmedFormatted} + {formatINR(discom.pendingInr)} unlogged
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-2">100% Reconciled Cash Flow Bridge ({pnlSummary.daysCount} Days)</h4>
            <table className="w-full text-left border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-400">
                  <th className="py-1.5">Bucket</th>
                  <th className="py-1.5 text-right">Amount (₹)</th>
                  <th className="py-1.5 text-right">Share of Ideal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-1.5 font-semibold text-emerald-700">Confirmed Earned Revenue</td>
                  <td className="py-1.5 text-right font-bold">{formatINR(pnlSummary.earnedInr)}</td>
                  <td className="py-1.5 text-right">{pnlSummary.earnedPct}%</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-medium text-sky-700">Weather / Cloud Dip Opportunity</td>
                  <td className="py-1.5 text-right font-semibold">{formatINR(pnlSummary.weatherDipInr)}</td>
                  <td className="py-1.5 text-right">{pnlSummary.weatherDipPct}%</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-medium text-amber-700">Surface Soiling & Aerosol Haze Loss</td>
                  <td className="py-1.5 text-right font-semibold">{formatINR(pnlSummary.soilLossInr)}</td>
                  <td className="py-1.5 text-right">{pnlSummary.soilLossPct}%</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-medium text-rose-700">Wi-Fi Outage / Unlogged Days</td>
                  <td className="py-1.5 text-right font-semibold">{formatINR(pnlSummary.pendingOutageInr)}</td>
                  <td className="py-1.5 text-right">{pnlSummary.pendingOutagePct}%</td>
                </tr>
                <tr className="border-t border-slate-300 font-extrabold text-slate-900">
                  <td className="py-1.5">100% Ideal Clear-Sky Potential</td>
                  <td className="py-1.5 text-right">{formatINR(pnlSummary.idealPotentialInr)}</td>
                  <td className="py-1.5 text-right">100.0%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-2">
              Open-Meteo 12-Month Solar Baseline ({payback.archiveWindowLabel || 'Live Estimate'})
            </h4>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-center tabular-nums">
              {payback.seasonalProfile.map((m) => (
                <div key={m.month} className="p-2 rounded-xl border border-slate-100">
                  <div className="font-bold text-slate-800">{m.shortMonth}</div>
                  <div className="text-[11px] font-semibold text-emerald-700">{m.avgDailyKwh} kWh/d</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
