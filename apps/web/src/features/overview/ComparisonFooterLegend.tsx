import React from 'react';
import { Clock } from 'lucide-react';
import {
  formatMinutes12hUpper,
  type DailySolarPhysicsModel,
  type LiveNowcastResult,
  type ParsedDayTelemetry,
  type ReconstructedGapCurveResult,
} from '@solar-track/core';

interface ComparisonFooterLegendProps {
  isDaytimeToday: boolean;
  isScrubbing: boolean;
  todayNowcast: LiveNowcastResult | null;
  parsedReal: ParsedDayTelemetry;
  gapRecovery: ReconstructedGapCurveResult;
  selectedManualGridOff: boolean;
  physicsModel: DailySolarPhysicsModel;
}

export const ComparisonFooterLegend: React.FC<ComparisonFooterLegendProps> = ({
  isDaytimeToday,
  isScrubbing,
  todayNowcast,
  parsedReal,
  gapRecovery,
  selectedManualGridOff,
  physicsModel,
}) => (
  <div className="mt-2 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px] font-medium text-slate-500">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
        <span className="w-3.5 h-[2.5px] rounded-full bg-emerald-600 inline-block" />
        Your Solar Power (kW)
      </span>
      <span className="inline-flex items-center gap-1.5 text-sky-700 font-semibold">
        <span className="w-3.5 border-t-2 border-dashed border-sky-600 inline-block" />
        {isDaytimeToday && !isScrubbing && todayNowcast?.active ? 'Sky-Adjusted Tracker' : 'Expected Sun Target (kW)'}
      </span>
      {parsedReal.hasData && (
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/35 border border-emerald-500/40 inline-block" />
            Surplus
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/30 border border-amber-500/40 inline-block" />
            Below Model
          </span>
        </>
      )}
      {gapRecovery.eepromRecoveredKwh > 0.05 && (
        <span className="inline-flex items-center gap-1.5 text-teal-700 font-semibold">
          <span className="w-3.5 border-t-2 border-dashed border-teal-600 inline-block" />
          EDay-Confirmed Bridge (+{gapRecovery.eepromRecoveredKwh.toFixed(1)} kWh)
        </span>
      )}
      {gapRecovery.bufferedKwh > 0.05 && (
        <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
          <span className="w-3.5 border-t-2 border-dashed border-amber-600 inline-block" />
          Recovered Generation (+{gapRecovery.bufferedKwh.toFixed(1)} kWh)
        </span>
      )}
      {!gapRecovery.hasBridgedGaps && parsedReal.gaps.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 border border-slate-300 inline-block" />
          {selectedManualGridOff || gapRecovery.suspectedGridCut ? 'Grid Off' : 'Wi-Fi Outage'}
        </span>
      )}
    </div>

    <div className="flex items-center gap-2 text-slate-500 tabular-nums">
      <Clock className="w-3.5 h-3.5 text-slate-400" />
      <span>
        Solar Noon {physicsModel.solarNoonText} ·{' '}
        {parsedReal.peakKw > 0
          ? `Measured Peak ${parsedReal.peakKw.toFixed(2)} kW (${formatMinutes12hUpper(parsedReal.peakMinutes)})`
          : `Model Peak ~${physicsModel.peakKw.toFixed(2)} kW (${physicsModel.peakTimeText})`}
      </span>
    </div>
  </div>
);
