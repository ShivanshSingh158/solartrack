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
    <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex-1 flex flex-col justify-between space-y-3.5">
      {/* Card Header: Plain text, no pills */}
      <div className="pb-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <Sun className="w-4 h-4 text-amber-500 shrink-0" />
          <h3 className="card-title-h2 text-slate-800 text-[13px] sm:text-[14px] whitespace-nowrap">
            Tomorrow&apos;s Solar Forecast
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-500 num shrink-0">
          {tmrw ? `${tmrw.shortLabel} · ${tmrw.condition}` : tomorrowShortLabel}
        </span>
      </div>

      {/* Main Expected Yield & Advice */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <span className="text-2xl font-bold num text-slate-900">~{tmrwKwh.toFixed(1)}</span>
          <span className="text-xs font-semibold text-slate-500 ml-1.5">kWh Expected</span>
        </div>
        {tmrw && (
          <span className="text-[11px] font-medium text-slate-500 num text-right">
            {tmrw.soilingPenaltyKwh >= 0.2
              ? `incl. -${tmrw.soilingPenaltyKwh.toFixed(1)} kWh light dust`
              : `Midday peak ~${tmrw.peakKw.toFixed(1)} kW`}
          </span>
        )}
      </div>

      {/* High-Impact Appliance Run Window Box */}
      <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/75 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-amber-200/70 text-amber-900 shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold text-amber-950 truncate">
              Best Solar Hours (Heavy Loads)
            </div>
            <div className="text-[10px] font-medium text-amber-800/80 truncate">
              Run AC, water pump &amp; washing machine for free
            </div>
          </div>
        </div>
        <span className="text-[12px] font-black text-amber-950 tabular-nums whitespace-nowrap shrink-0">
          {tmrw?.peakWindowStart && tmrw?.peakWindowEnd
            ? `${tmrw.peakWindowStart} – ${tmrw.peakWindowEnd}`
            : '09:30 AM – 02:30 PM'}
        </span>
      </div>

      {/* Key Atmospheric Metrics (Clean 2-row layout) */}
      <div className="divide-y divide-slate-100 border-t border-slate-100 text-[12px]">
        <div className="py-2 flex items-center justify-between gap-2">
          <span className="text-slate-500 font-medium">Sunlight &amp; Temperature</span>
          <span className="font-semibold text-slate-800 num text-right">
            {tmrwSunHrs.toFixed(1)} hrs sun · {tempRangeStr}
          </span>
        </div>

        <div className="py-2 flex items-center justify-between gap-2">
          <span className="text-slate-500 font-medium">Morning Sky &amp; Rain Chance</span>
          <span className="font-semibold text-slate-800 num text-right">
            {tmrw
              ? `${tmrw.skyBadgeText.replace(/AOD\s*[\d.]+/i, 'Clear Haze')} · ${tmrw.rainProbPct}% rain`
              : 'Syncing morning forecast'}
          </span>
        </div>
      </div>

      {/* 3-Day Solar Horizon Grid (3 separate columns — zero text collision) */}
      {peekDays.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              3-Day Solar Horizon
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              Satellite Projection
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {peekDays.map((d) => (
              <div
                key={d.ymd}
                className="p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-slate-700 truncate">
                  <span>{d.shortLabel}</span>
                  <CloudSun className="w-3 h-3 text-amber-500/80 shrink-0" />
                </div>
                <div className="text-[14px] font-extrabold text-slate-900 num mt-1 tabular-nums">
                  ~{d.asIsExpectedKwh.toFixed(1)}{' '}
                  <span className="text-[10px] font-semibold text-slate-500">kWh</span>
                </div>
                <div className="text-[10px] font-medium text-slate-400 truncate mt-0.5">
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
