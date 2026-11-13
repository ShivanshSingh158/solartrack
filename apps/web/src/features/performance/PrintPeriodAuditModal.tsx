import React from 'react';
import { Printer, ShieldCheck, X } from 'lucide-react';
import { SOLAR_CONSTANTS, type TimescaleMode } from '@solar-track/core';

export interface PrintPeriodAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantTitle: string;
  locationName: string;
  capacityKwp: number;
  periodTitle: string;
  timescale: TimescaleMode;
  realKwh: number;
  modelKwh: number | null;
  capturePct: number | null;
  confirmedDaysCount: number;
  tariffPerKwh: number;
  co2FactorKgPerKwh?: number;
  rows: Array<{
    label: string;
    real: string;
    model: string;
    capture: string;
    reason: string;
  }>;
}

/**
 * Printable period performance audit dialog summarizing output, capture %, and attribution rows.
 */
export const PrintPeriodAuditModal: React.FC<PrintPeriodAuditModalProps> = ({
  isOpen,
  onClose,
  plantTitle,
  locationName,
  capacityKwp,
  periodTitle,
  timescale,
  realKwh,
  modelKwh,
  capturePct,
  confirmedDaysCount,
  tariffPerKwh,
  co2FactorKgPerKwh = SOLAR_CONSTANTS.CO2_KG_PER_KWH,
  rows,
}) => {
  if (!isOpen) return null;

  const estimatedSavingsInr = Math.round(realKwh * tariffPerKwh);
  const co2AvoidedKg = +(realKwh * co2FactorKgPerKwh).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Print Period Performance Audit"
    >
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">
                Verified Period Performance Audit
              </h3>
              <p className="text-[11px] font-medium text-slate-500">
                {plantTitle} · {locationName} · {capacityKwp.toFixed(2)} kWp
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold cursor-pointer transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close audit modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-[12px]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Audit Scope ({timescale})
              </span>
              <div className="text-[16px] font-extrabold text-slate-900">{periodTitle}</div>
            </div>
            <div className="text-right tabular-nums">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Verified Coverage
              </span>
              <div className="text-[13px] font-bold text-slate-700">
                {confirmedDaysCount > 0 ? `${confirmedDaysCount} confirmed intervals` : 'Active period'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-2xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
            <div className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Verified Output
              </div>
              <div className="text-[16px] font-extrabold text-slate-900 tabular-nums mt-0.5">
                {realKwh.toFixed(1)} kWh
              </div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Physics Benchmark
              </div>
              <div className="text-[16px] font-extrabold text-sky-700 tabular-nums mt-0.5">
                {modelKwh != null ? `${modelKwh.toFixed(1)} kWh` : '—'}
              </div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Weather Capture
              </div>
              <div className="text-[16px] font-extrabold text-emerald-700 tabular-nums mt-0.5">
                {capturePct != null ? `${capturePct}%` : '—'}
              </div>
            </div>
            <div className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Est. Value & CO₂
              </div>
              <div className="text-[14px] font-extrabold text-slate-900 tabular-nums mt-0.5">
                ₹{estimatedSavingsInr.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 tabular-nums">
                {co2AvoidedKg} kg CO₂ ({co2FactorKgPerKwh} kg/kWh)
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[11.5px] tabular-nums">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 px-3">Period / Interval</th>
                  <th className="py-2 px-3 text-right">Verified Real</th>
                  <th className="py-2 px-3 text-right">Physics Model</th>
                  <th className="py-2 px-3 text-right">Capture</th>
                  <th className="py-2 px-3">Attribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 35).map((r, i) => (
                  <tr key={`${r.label}-${i}`}>
                    <td className="py-2 px-3 font-semibold text-slate-800">{r.label}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">{r.real}</td>
                    <td className="py-2 px-3 text-right font-medium text-sky-700">{r.model}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-700">{r.capture}</td>
                    <td className="py-2 px-3 text-slate-600">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-[10.5px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>
              Tariff Basis: ₹{tariffPerKwh.toFixed(2)}/kWh · Net-metering billing in Financials tab
            </span>
            <span>Generated via SolarTrack Telemetry Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
};
