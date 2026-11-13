import React from 'react';
import { BellRing, Radio, X } from 'lucide-react';
import type { NewWaareePacketEvent } from '@solar-track/core';

interface PacketNotificationToastProps {
  packet: NewWaareePacketEvent;
  fallbackEstimatedKw: number;
  onDismiss: () => void;
  onViewComparison: () => void;
}

/** Floating alert banner displayed when live inverter telemetry delivers a new packet. */
export const PacketNotificationToast: React.FC<PacketNotificationToastProps> = ({
  packet,
  fallbackEstimatedKw,
  onDismiss,
  onViewComparison,
}) => {
  const calcKw = packet.calcKwNow !== undefined ? packet.calcKwNow : fallbackEstimatedKw;
  const capturePct =
    packet.capturePct !== undefined && packet.capturePct !== null
      ? packet.capturePct
      : calcKw > 0.05
        ? Math.round((packet.livePowerKw / calcKw) * 100)
        : null;

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-[calc(100%-2rem)] rounded-2xl border border-emerald-200 bg-white/95 backdrop-blur-xl shadow-2xl p-3.5 animate-in fade-in slide-in-from-top-3 duration-200">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
          <BellRing className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              <Radio className="w-3 h-3 animate-pulse" />
              New Waaree Data Arrived
            </span>
            <button
              type="button"
              onClick={onDismiss}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md transition cursor-pointer"
              aria-label="Dismiss telemetry alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs font-bold text-slate-900 mt-1 leading-snug">{packet.reason}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] font-medium text-slate-500 tabular-nums">
            <span>
              Real AC {packet.livePowerKw.toFixed(2)} kW vs ~{calcKw.toFixed(2)} kW calc
            </span>
            {typeof packet.liveDcPowerKw === 'number' && packet.liveDcPowerKw > 0.02 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200/70">
                PV {packet.liveDcPowerKw.toFixed(2)} kW DC
              </span>
            )}
            {capturePct !== null && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/70">
                {capturePct}% capture
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px]">
            <span className="text-slate-400 tabular-nums">
              Today: {packet.yieldToday.toFixed(1)} kWh · {packet.detectedAtIst}
            </span>
            <button
              type="button"
              onClick={onViewComparison}
              className="font-bold text-sky-600 hover:text-sky-700 whitespace-nowrap cursor-pointer"
            >
              View Comparison →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
