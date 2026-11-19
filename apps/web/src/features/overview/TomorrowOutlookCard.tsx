import React from 'react';
import { Clock, Sun, CloudSun } from 'lucide-react';
import type { CanonicalSolarSnapshot, SolarIntelligenceReport } from '@solar-track/core';

interface TomorrowOutlookCardProps {
  report: SolarIntelligenceReport | null;
  snap: CanonicalSolarSnapshot;
  tomorrowShortLabel: string;
  tomorrowYieldEst: number;
  tomorrowSunshineHours: number;
  tomorrowMinTemp: number;
  tomorrowMaxTemp: number;
}

export const TomorrowOutlookCard: React.FC<TomorrowOutlookCardProps> = ({
  report,
  snap,
  tomorrowShortLabel,
  tomorrowYieldEst,
  tomorrowSunshineHours,
  tomorrowMinTemp,
  tomorrowMaxTemp,
}) => {
  const tmrw = report?.tomorrowOutlook ?? null;
  const peekDays = report?.extendedForecast?.slice(1, 4) ?? [];
  const tmrwKwh = tmrw ? tmrw.asIsExpectedKwh : snap?.tomorrow.expectedKwh ?? tomorrowYieldEst;
  const tmrwSunHrs = tmrw ? tmrw.sunshineHours : snap?.tomorrow.sunshineHours ?? tomorrowSunshineHours;
  const tempRangeStr = snap
    ? `${snap.tomorrow.tempMinFormatted.replace(/°[CF]$/, '')}° – ${snap.tomorrow.tempMaxFormatted}`
    : `${tomorrowMinTemp.toFixed(1)}° – ${tomorrowMaxTemp.toFixed(1)}°C`;

  return (
    <div className="p-5 sm:p-6 apple-glass-card rounded-3xl bg-white/80 border border-slate-200/70 shadow-xs flex-1 flex flex-col justify-between space-y-3.5">
      {/* Header: Clean Icon Box, Title & Apple Status Tag (Zero Pills) */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight">
              Tomorrow&apos;s Solar Forecast
            </h3>
            <p className="text-[11px] text-slate-400 font-normal">
              Satellite radiation &amp; temperature model
            </p>
          </div>
        </div>

        <span className="text-xs font-semibold text-slate-600 tabular-nums px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/70 shrink-0">
          {tmrw ? `${tmrw.shortLabel} · ${tmrw.condition}` : tomorrowShortLabel}
        </span>
      </div>

      {/* Main Expected Yield & Atmospheric Note */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tabular-nums tracking-tight">
              ~{tmrwKwh.toFixed(1)}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-500">kWh Expected</span>
          </div>

          {tmrw && (
            <span className="text-xs font-semibold text-slate-500 tabular-nums text-right">
              {tmrw.soilingPenaltyKwh >= 0.2
                ? `incl. -${tmrw.soilingPenaltyKwh.toFixed(1)} kWh light dust`
                : `Midday peak ~${tmrw.peakKw.toFixed(1)} kW`}
            </span>
          )}
        </div>
      </div>

      {/* High-Impact Appliance Run Window Box (Apple-Style Tile) */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-200/70 flex items-center justify-center text-amber-900 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-[13px] font-bold text-amber-950 truncate">
              Best Solar Hours (Heavy Loads)
            </div>
            <div className="text-[11px] font-medium text-amber-900/80 truncate">
              Run AC, water pump &amp; washing machine for free
            </div>
          </div>
        </div>
        <span className="text-xs sm:text-sm font-black text-amber-950 tabular-nums whitespace-nowrap shrink-0">
          {tmrw?.peakWindowStart && tmrw?.peakWindowEnd
            ? `${tmrw.peakWindowStart} – ${tmrw.peakWindowEnd}`
            : '09:16 AM – 02:41 PM'}
        </span>
      </div>

      {/* Key Atmospheric Metrics (Spacious 2-row layout) */}
      <div className="divide-y divide-slate-100 border-t border-slate-100 text-xs sm:text-[13px]">
        <div className="py-2.5 flex items-center justify-between gap-3">
          <span className="text-slate-500 font-medium">Sunlight &amp; Temperature</span>
          <span className="font-bold text-slate-800 tabular-nums text-right">
            {tmrwSunHrs.toFixed(1)} hrs sun · {tempRangeStr}
          </span>
        </div>

        <div className="py-2.5 flex items-center justify-between gap-3">
          <span className="text-slate-500 font-medium">Morning Sky &amp; Rain Chance</span>
          <span className="font-bold text-slate-800 tabular-nums text-right">
            {tmrw
              ? `${tmrw.skyBadgeText.replace(/AOD\s*[\d.]+/i, 'Clear Haze')} · ${tmrw.rainProbPct}% rain`
              : 'Syncing morning forecast'}
          </span>
        </div>
      </div>

      {/* 3-Day Solar Horizon Grid */}
      {peekDays.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              3-Day Solar Horizon
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              Satellite Projection
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {peekDays.map((d) => (
              <div
                key={d.ymd}
                className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-col justify-between space-y-1.5"
              >
                <div className="flex items-center justify-between gap-1 text-xs font-bold text-slate-700 truncate">
                  <span>{d.shortLabel}</span>
                  <CloudSun className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                </div>
                <div className="text-sm sm:text-base font-black text-slate-900 tabular-nums">
                  ~{d.asIsExpectedKwh.toFixed(1)}{' '}
                  <span className="text-[10px] font-semibold text-slate-400">kWh</span>
                </div>
                <div className="text-[11px] font-medium text-slate-500 truncate">
                  {d.condition.replace(/^(Mainly |Partly )/, '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
