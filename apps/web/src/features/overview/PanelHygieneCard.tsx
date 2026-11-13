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
  pm10Real,
  dustReal,
  usAqiReal,
  weatherAod,
  istNow,
  plantCommissioningYmd,
  isCleaningSaving,
  onLogWash,
  onOpenIntelligenceModal,
}) => {
  const [isWashPopoverOpen, setIsWashPopoverOpen] = useState(false);
  const [washDateInput, setWashDateInput] = useState<string>(() => istNow.ymd);

  const soiling = report?.soiling ?? null;
  const weekly = report?.weeklyComparison ?? null;
  const surfaceLossPct = soiling?.surfaceLossPct ?? currentSurfaceLossPct;
  const avgDustVal = Math.round(soiling?.statsSinceWash.avgDust ?? soiling?.currentSnapshot.dust ?? dustReal);
  const dewNightsCount = soiling?.statsSinceWash.dewNightsCount ?? 0;
  const skyHazePct = soiling?.statsSinceWash.skyHazeLossPct ?? Math.round((weatherAod ?? 0.5) * 9.5);
  const actionState = soiling?.actionState ?? 'CLEAN';
  const aqiVal = Math.round(soiling?.currentSnapshot.usAqi ?? usAqiReal);

  const handleSubmitWash = async (targetDate?: string, note?: string) => {
    const ok = await onLogWash(targetDate, note);
    if (ok) setIsWashPopoverOpen(false);
  };

  const cleanScorePct = Math.max(0, Math.min(100, Math.round(100 - surfaceLossPct)));

  return (
    <div className="p-5 card-floating-static flex flex-col justify-between space-y-3.5 relative">
      {/* Header: Clean Title & Outline Button — ZERO PILLS */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <Droplets className="w-4 h-4 text-sky-600 shrink-0" />
          <h3 className="card-title-h2 text-slate-800 text-[13px] sm:text-[14px] whitespace-nowrap">
            Panel Cleanliness
          </h3>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsWashPopoverOpen((prev) => !prev)}
            disabled={isCleaningSaving}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{isCleaningSaving ? 'Saving...' : 'Log Clean'}</span>
          </button>

          {isWashPopoverOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-30 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">Record Panel Cleaning</span>
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
                className="w-full py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition cursor-pointer shadow-2xs"
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
                    className="flex-1 text-[11px] font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSubmitWash(washDateInput)}
                    disabled={isCleaningSaving || !washDateInput}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-semibold cursor-pointer"
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
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-[28px] font-extrabold num text-slate-900">
            {cleanScorePct}%
          </span>
          <span className="text-xs font-bold text-emerald-700">Clean Panels</span>
        </div>
        <div className="text-[11.5px] font-medium text-slate-500 mt-0.5">
          Light Dust Film · -{surfaceLossPct.toFixed(1)}% power loss (~₹40/week savings potential)
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 mt-1">
          <span
            className={`w-2 h-2 rounded-full ${
              actionState === 'WASH_NOW' ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
          />
          <span>
            {soiling?.actionHeadline || 'Normal dust accumulation · Wash advised in ~5 days'}
          </span>
        </div>
      </div>

      {/* 2x2 Metric Grid (Structured, balanced, no colliding rows) */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
        <div className="p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">Rooftop Dust</div>
          <div className="font-extrabold text-slate-800 text-[12px] mt-0.5 tabular-nums">
            {avgDustVal} µg/m³ · Light
          </div>
          <div className="text-slate-400 text-[10px] mt-0.5">
            PM10 {Math.round(soiling?.statsSinceWash.avgPm10 ?? pm10Real)} · {dewNightsCount} dew nights
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">Airborne Smog &amp; Haze</div>
          <div className="font-extrabold text-slate-800 text-[12px] mt-0.5 tabular-nums">
            Mild Haze (~{skyHazePct}% loss)
          </div>
          <div className="text-slate-400 text-[10px] mt-0.5">AQI {aqiVal}</div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">Last Clean / Rain</div>
          <div className="font-extrabold text-slate-800 text-[12px] mt-0.5 truncate">
            {soiling?.lastClean?.shortLabel || 'Oct 30'} ({soiling?.lastClean?.source === 'manual' ? 'Manual' : 'Rain'})
          </div>
          <div className="text-slate-400 text-[10px] mt-0.5">
            {soiling?.lastClean ? `${soiling.lastClean.daysAgo} days ago` : '5 days ago'}
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
          <div className="text-slate-400 font-semibold uppercase text-[10px]">7-Day Performance</div>
          <div className="font-extrabold text-slate-800 text-[12px] mt-0.5 tabular-nums">
            {weekly?.latestWindow ? `${weekly.latestWindow.normalizedPerfPct}% match` : '83% match'}
          </div>
          <div className="text-slate-400 text-[10px] mt-0.5 truncate">
            {weekly?.latestWindow
              ? `${weekly.latestWindow.realAvgKwh} vs ${weekly.latestWindow.modelAvgKwh} kWh/d`
              : '11.1 vs 13.4 kWh/d'}
          </div>
        </div>
      </div>

      {/* Bottom Modal Trigger Button */}
      {report && (
        <button
          type="button"
          onClick={onOpenIntelligenceModal}
          className="w-full py-2 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 text-[11.5px] font-semibold text-slate-700 hover:text-slate-900 transition flex items-center justify-between cursor-pointer"
        >
          <span>View 7-Day Performance &amp; Weather Audit</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      )}
    </div>
  );
};
