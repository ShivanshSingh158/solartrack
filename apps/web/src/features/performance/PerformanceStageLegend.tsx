import React from 'react';
import {
  formatIndianDate,
  type DailySolarPhysicsModel,
  type ReconstructedGapCurveResult,
  type TimescaleMode,
} from '@solar-track/core';

interface StageLayerTogglesProps {
  timescale: TimescaleMode;
  viewMode: 'chart' | 'table';
  isCombined: boolean;
  showModelOverlay: boolean;
  onToggleModelOverlay: () => void;
  showPvDcOverlay: boolean;
  onTogglePvDcOverlay: () => void;
  showPriorWeekOverlay: boolean;
  onTogglePriorWeekOverlay: () => void;
  showClearSkyTicks: boolean;
  onToggleClearSkyTicks: () => void;
  showCaptureLineOverlay: boolean;
  onToggleCaptureLineOverlay: () => void;
}

/**
 * Quiet layer overlay switches displayed beside the chart title.
 */
export const PerformanceStageLayerToggles: React.FC<StageLayerTogglesProps> = ({
  timescale,
  viewMode,
  isCombined,
  showModelOverlay,
  onToggleModelOverlay,
  showPvDcOverlay,
  onTogglePvDcOverlay,
  showPriorWeekOverlay,
  onTogglePriorWeekOverlay,
  showClearSkyTicks,
  onToggleClearSkyTicks,
  showCaptureLineOverlay,
  onToggleCaptureLineOverlay,
}) => {
  if (viewMode !== 'chart') return null;

  if (timescale === 'day') {
    return (
      <div className="flex flex-wrap items-center gap-3 text-[11.5px] font-semibold">
        <button
          type="button"
          onClick={onToggleModelOverlay}
          className={`inline-flex items-center gap-1.5 cursor-pointer transition-opacity ${
            showModelOverlay ? 'text-sky-700 opacity-100' : 'text-slate-400 opacity-65 hover:opacity-100'
          }`}
        >
          <span className="w-3.5 border-t-2 border-dashed border-sky-600 inline-block" />
          <span>Physics Model</span>
        </button>

        {!isCombined && (
          <button
            type="button"
            onClick={onTogglePvDcOverlay}
            className={`inline-flex items-center gap-1.5 cursor-pointer transition-opacity ${
              showPvDcOverlay ? 'text-amber-700 opacity-100' : 'text-slate-400 opacity-75 hover:opacity-100'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-xs border inline-block ${
                showPvDcOverlay
                  ? 'bg-amber-400/35 border-amber-500'
                  : 'bg-slate-100 border-slate-300'
              }`}
            />
            <span>PV DC + Loss Band</span>
          </button>
        )}
      </div>
    );
  }

  if (timescale === 'week') {
    return (
      <div className="flex flex-wrap items-center gap-3 text-[11.5px] font-semibold">
        <button
          type="button"
          onClick={onTogglePriorWeekOverlay}
          className={`inline-flex items-center gap-1.5 cursor-pointer transition-opacity ${
            showPriorWeekOverlay ? 'text-indigo-700 opacity-100' : 'text-slate-400 opacity-75 hover:opacity-100'
          }`}
        >
          <span
            className={`w-3 h-0.5 inline-block ${
              showPriorWeekOverlay ? 'bg-indigo-500' : 'bg-slate-300'
            }`}
          />
          <span>Prior 7d</span>
        </button>

        <button
          type="button"
          onClick={onToggleClearSkyTicks}
          className={`inline-flex items-center gap-1.5 cursor-pointer transition-opacity ${
            showClearSkyTicks ? 'text-slate-700 opacity-100' : 'text-slate-400 opacity-75 hover:opacity-100'
          }`}
        >
          <span className="w-3 border-t border-slate-400 inline-block" />
          <span>Clear-Sky Ticks</span>
        </button>
      </div>
    );
  }

  if (timescale === 'month') {
    return (
      <div className="flex flex-wrap items-center gap-3 text-[11.5px] font-semibold">
        <button
          type="button"
          onClick={onToggleCaptureLineOverlay}
          className={`inline-flex items-center gap-1.5 cursor-pointer transition-opacity ${
            showCaptureLineOverlay ? 'text-indigo-700 opacity-100' : 'text-slate-400 opacity-75 hover:opacity-100'
          }`}
        >
          <span
            className={`w-3 border-t-2 border-dotted inline-block ${
              showCaptureLineOverlay ? 'border-indigo-500' : 'border-slate-300'
            }`}
          />
          <span>Capture % Line</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
        Active Month
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-1 rounded-full bg-slate-200 inline-block" />
        Pre-Install
      </span>
    </div>
  );
};

interface PerformanceStageLegendProps {
  timescale: TimescaleMode;
  isCombined: boolean;
  showModelOverlay: boolean;
  showPvDcOverlay: boolean;
  compareDateYmd: string | null;
  primaryGapCurve?: ReconstructedGapCurveResult | null;
  dayRadiationMjM2?: number | null;
  physicsModel: DailySolarPhysicsModel;
}

/**
 * Compact inline bottom legend bar rendered beneath the SVG stage.
 */
export const PerformanceStageLegend: React.FC<PerformanceStageLegendProps> = ({
  timescale,
  isCombined,
  showModelOverlay,
  showPvDcOverlay,
  compareDateYmd,
  primaryGapCurve,
  dayRadiationMjM2,
  physicsModel,
}) => (
  <div className="mt-2 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
    {timescale === 'day' && (
      <>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
            <span className="w-3.5 h-[2.5px] rounded-full bg-emerald-600 inline-block" />
            Real Inverter AC (kW)
          </span>
          {showModelOverlay && (
            <span className="inline-flex items-center gap-1.5 text-sky-700 font-semibold">
              <span className="w-3.5 border-t-2 border-dashed border-sky-600 inline-block" />
              Physics Model (kW)
            </span>
          )}
          {showPvDcOverlay && !isCombined && (
            <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
              <span className="w-3.5 border-t-2 border-dashed border-amber-600 inline-block" />
              PV DC & Loss Band
            </span>
          )}
          {compareDateYmd && (
            <span className="inline-flex items-center gap-1.5 text-indigo-700 font-semibold">
              <span className="w-3.5 border-t-2 border-dotted border-indigo-600 inline-block" />
              Compare ({formatIndianDate(compareDateYmd, 'short')})
            </span>
          )}
          {primaryGapCurve?.hasBridgedGaps && (
            <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
              <span className="w-3.5 border-t-2 border-dashed border-amber-600 inline-block" />
              EDay-Confirmed Wi-Fi Gap (+{primaryGapCurve.recoveredKwh.toFixed(1)} kWh)
            </span>
          )}
        </div>
        <span className="text-[10.5px] text-slate-400 tabular-nums">
          {dayRadiationMjM2 ? `${dayRadiationMjM2.toFixed(1)} MJ/m² day · ` : ''}
          Solar Noon {physicsModel.solarNoonText}
        </span>
      </>
    )}

    {(timescale === 'week' || timescale === 'month') && (
      <>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-2 rounded-xs bg-sky-500/15 border-t-2 border-sky-600 inline-block" />
            Physics Model Target
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
            On Track
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" />
            Cloud/Rain
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
            Fog/Haze
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
            Soiling/Gap
          </span>
        </div>
        <span className="text-[10.5px] text-slate-400">
          Click any bar to inspect 5-minute solar curve
        </span>
      </>
    )}

    {timescale === 'year' && (
      <>
        <span className="text-slate-500">
          Monthly generation separated cleanly into Pre-Install vs Active Commissioned months
        </span>
        <span className="text-[10.5px] text-slate-400">
          Click active month → Daily audit
        </span>
      </>
    )}
  </div>
);
