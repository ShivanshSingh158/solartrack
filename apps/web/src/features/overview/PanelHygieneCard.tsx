import React, { useState } from 'react';
import { ArrowUpRight, Calendar, Droplets, X } from 'lucide-react';
import type { IstClockParts, SolarIntelligenceReport } from '@solar-track/core';

interface PanelHygieneCardProps {
  report: SolarIntelligenceReport | null;
  currentSurfaceLossPct: number;
  pm10Real: number;
  dustReal: number;
  usAqiReal: number;
  weatherAod?: number | null;
  istNow: IstClockParts;
  plantCommissioningYmd: string;
  isCleaningSaving: boolean;
  onLogWash: (targetDateYmd?: string, note?: string) => Promise<boolean>;
  onOpenIntelligenceModal: () => void;
}

export const PanelHygieneCard: React.FC<PanelHygieneCardProps> = ({
  report,
  currentSurfaceLossPct,
  pm10Real: _pm10Real,
  dustReal: _dustReal,
  usAqiReal,
  weatherAod: _weatherAod,
  istNow,
  plantCommissioningYmd,
  isCleaningSaving,
  onLogWash,
  onOpenIntelligenceModal,
}) => {
  const [isWashPopoverOpen, setIsWashPopoverOpen] = useState(false);
  const [washDateInput, setWashDateInput] = useState<string>(() => istNow.ymd);

  const soiling = report?.soiling ?? null;
  const surfaceLossPct = soiling?.surfaceLossPct ?? currentSurfaceLossPct;
  const actionState = soiling?.actionState ?? 'CLEAN';
  const aqiVal = Math.round(soiling?.currentSnapshot.usAqi ?? usAqiReal);

  const handleSubmitWash = async (targetDate?: string, note?: string) => {
    const ok = await onLogWash(targetDate, note);
    if (ok) setIsWashPopoverOpen(false);
  };

  const cleanScorePct = Math.max(0, Math.min(100, Math.round(100 - surfaceLossPct)));

  return (
    <div className="p-5 sm:p-6 apple-glass-card rounded-3xl bg-white/80 border border-slate-200/70 shadow-xs flex flex-col justify-between space-y-3.5 relative">
      {/* Header: Clean Icon Box, Title & Apple Action Button (Zero Pills) */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 shrink-0">
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight">
              Panel Cleanliness
            </h3>
            <p className="text-[11px] text-slate-400 font-normal">
              Radiative night dew &amp; particulate physics
            </p>
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsWashPopoverOpen((prev) => !prev)}
            disabled={isCleaningSaving}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200/80 transition cursor-pointer shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{isCleaningSaving ? 'Saving...' : 'Log Clean'}</span>
          </button>

          {isWashPopoverOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-30 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Record Panel Cleaning</span>
                <button
                  type="button"
                  onClick={() => setIsWashPopoverOpen(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleSubmitWash(istNow.ymd, 'Washed panels today')}
                disabled={isCleaningSaving}
                className="w-full py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                ✓ Mark Washed Today ({istNow.shortLabel})
              </button>
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Or Backdate Previous Date
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={washDateInput}
                    min={plantCommissioningYmd}
                    max={istNow.ymd}
                    onChange={(e) => setWashDateInput(e.target.value)}
                    className="flex-1 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSubmitWash(washDateInput)}
                    disabled={isCleaningSaving || !washDateInput}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hero Cleanliness Score */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tabular-nums tracking-tight">
            {cleanScorePct}%
          </span>
          <span className="text-xs sm:text-sm font-bold text-emerald-700">Clean Panels</span>
        </div>
        <p className="text-xs sm:text-[13px] font-medium text-slate-500">
          Light Dust Film · -{surfaceLossPct.toFixed(1)}% power loss (~₹40/week savings potential)
        </p>

        {/* Action Callout Bar (Clean Subtle Tile) */}
        <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/70 flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              actionState === 'WASH_NOW' ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          />
          <span className="text-xs font-semibold text-slate-700">
            {soiling?.actionHeadline || 'Normal dust accumulation · Wash advised in ~5 days'}
          </span>
        </div>
      </div>

      {/* Clean Status Details (Apple-style spacing, zero micro-box clutter) */}
      <div className="divide-y divide-slate-100 border-t border-slate-100 text-xs sm:text-[13px]">
        <div className="py-2.5 flex items-center justify-between gap-3">
          <span className="text-slate-500 font-medium">Last Clean / Rain</span>
          <span className="font-bold text-slate-800 tabular-nums">
            {soiling?.lastClean?.shortLabel || 'Oct 30'} ({soiling?.lastClean?.source === 'manual' ? 'Manual' : 'Rain'}) · {soiling?.lastClean ? `${soiling.lastClean.daysAgo}d ago` : '14d ago'}
          </span>
        </div>

        <div className="py-2.5 flex items-center justify-between gap-3">
          <span className="text-slate-500 font-medium">Environmental Loss</span>
          <span className="font-bold text-slate-800 tabular-nums">
            AQI {aqiVal} · Light dust (-{surfaceLossPct.toFixed(1)}%)
          </span>
        </div>

        <div className="py-2.5 flex items-center justify-between gap-3">
          <span className="text-slate-500 font-medium">Dew &amp; Grime Bond</span>
          <span className="font-bold text-slate-800 tabular-nums">
            {soiling?.statsSinceWash?.dewNightsCount
              ? `${soiling.statsSinceWash.dewNightsCount} dew nights · ${soiling.stickyFilmActive ? 'Cemented film' : 'Loose particle layer'}`
              : soiling?.stickyFilmActive
              ? 'Cemented grime film'
              : 'Dry loose particulate layer'}
          </span>
        </div>

        <div className="py-2.5 flex items-center justify-between gap-3">
          <span className="text-slate-500 font-medium">Auto-Wash Outlook</span>
          <span className="font-bold text-slate-800 tabular-nums text-right">
            {soiling?.incomingRainHold
              ? `Rain expected ${soiling.incomingRainHold.shortLabel} (~${soiling.incomingRainHold.rainMm.toFixed(1)} mm) · Hold wash`
              : soiling?.estimatedNextWashLabel
              ? `Next wash ~${soiling.estimatedNextWashLabel} (before 07:30 AM)`
              : 'Clean water rinse recommended before 07:30 AM'}
          </span>
        </div>
      </div>

      {/* Bottom Modal Trigger Button */}
      {report && (
        <button
          type="button"
          onClick={onOpenIntelligenceModal}
          className="w-full py-2.5 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 hover:text-slate-900 transition flex items-center justify-between cursor-pointer group"
        >
          <span>View 7-Day Performance &amp; Weather Audit</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition" />
        </button>
      )}
    </div>
  );
};
