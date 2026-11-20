import React from 'react';
import {
  Activity,
  ArrowUpRight,
  CloudRain,
  Droplets,
  Gauge,
  Sun,
} from 'lucide-react';
import type {
  CanonicalSolarSnapshot,
  PeriodEnergyAttribution,
  TimescaleMode,
  WeightedEfficiencyResult,
} from '@solar-track/core';

interface PerformanceFooterLedgersProps {
  timescale: TimescaleMode;
  periodLabel: string;
  canonicalSnapshot: CanonicalSolarSnapshot;
  attribution: PeriodEnergyAttribution | null;
  dayWeightedEfficiency: WeightedEfficiencyResult | null;
  isCombined: boolean;
  onNavigateToHealth: () => void;
  isDayViewPastDate: boolean;
  daySunStats?: {
    sunriseText: string;
    sunsetText: string;
    radiationMjM2: number | null;
    condition: string;
    gtiPeakWm2?: number | null;
    prPct: number;
    surfaceLossPct: number;
  } | null;
}

export const PerformanceFooterLedgers: React.FC<PerformanceFooterLedgersProps> = ({
  timescale,
  periodLabel,
  canonicalSnapshot,
  attribution,
  dayWeightedEfficiency,
  isCombined,
  onNavigateToHealth,
  isDayViewPastDate,
  daySunStats,
}) => {
  const { sun, weatherNow, directDiffuse, effectivePrBreakdown, soiling, thermalAndElectrical, sunEfficiencyScore, truth } =
    canonicalSnapshot;

  // Headline Optics Index: uses evaluated period capture if inspecting a multi-day range, or canonical sun score on Today/lifetime
  const headlinePct =
    timescale !== 'day' && attribution?.capturePct != null
      ? attribution.capturePct
      : sunEfficiencyScore.scorePct;
  const headlineDaysCount =
    timescale !== 'day' && attribution && attribution.confirmedDays > 0
      ? attribution.confirmedDays
      : sunEfficiencyScore.syncedDaysEvaluated;

  // Energy-weighted Inverter Conversion Efficiency
  const renderInverterEfficiencyText = () => {
    if (isCombined) {
      return 'Multi-inverter fleet';
    }
    if (!isDayViewPastDate) {
      if (truth.isNight) {
        return `Standby (Wakes up at ${sun.sunriseText})`;
      }
      if (truth.isStale) {
        return 'Wi-Fi Offline';
      }
      if (dayWeightedEfficiency?.etaPct != null) {
        const instPart =
          dayWeightedEfficiency.latestAcKw != null
            ? `${dayWeightedEfficiency.latestAcKw.toFixed(2)} kW · `
            : '';
        return `${instPart}${dayWeightedEfficiency.etaPct.toFixed(1)}% efficiency`;
      }
      const instDc = thermalAndElectrical.dcKw ?? 0;
      const instAc = thermalAndElectrical.acKw ?? 0;
      if (instDc >= 0.08 && instAc > 0.01) {
        const instEta = Math.min(
          98.5,
          Math.max(45.0, (instAc / instDc) * 100),
        );
        return `${instAc.toFixed(2)} kW (${instEta.toFixed(1)}% conversion)`;
      }
      return 'Standby / Low Light';
    }

    // Past inspected date
    if (dayWeightedEfficiency?.etaPct != null) {
      return `${dayWeightedEfficiency.etaPct.toFixed(1)}% average conversion`;
    }
    return 'Normal Conversion (~97%)';
  };

  // Stacked Energy Attribution percentages (40/60 right card)
  const totalPotential = Math.max(
    attribution?.idealClearSkyKwh || 0,
    (attribution?.deliveredRealKwh || 0) +
      (attribution?.weatherLossKwh || 0) +
      (attribution?.hazeAndSoilingLossKwh || 0) +
      (attribution?.outageGapKwh || 0),
    0.1,
  );
  const deliveredPct = attribution ? Math.min(100, (attribution.deliveredRealKwh / totalPotential) * 100) : 0;
  const weatherPct = attribution ? Math.min(100 - deliveredPct, (attribution.weatherLossKwh / totalPotential) * 100) : 0;
  const dirtPct = attribution
    ? Math.min(100 - deliveredPct - weatherPct, (attribution.hazeAndSoilingLossKwh / totalPotential) * 100)
    : 0;
  const gapPct = Math.max(0, 100 - deliveredPct - weatherPct - dirtPct);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
      {/* LEFT (40% -> 5 cols): SOLAR & INVERTER HEALTH LEDGER */}
      <section className="lg:col-span-5 rounded-3xl apple-glass-static p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-500" />
                Solar & Inverter Health
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {isDayViewPastDate && daySunStats
                  ? `${daySunStats.condition} · ${daySunStats.sunriseText} – ${daySunStats.sunsetText}`
                  : `${sun.sunriseText} – ${sun.sunsetText} · ${weatherNow.conditionLabel}`}
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[18px] font-extrabold text-emerald-700 tabular-nums leading-none">
                {headlinePct != null ? `${headlinePct}%` : '—'}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 mt-0.5 whitespace-nowrap">
                {headlineDaysCount > 0 ? `Capture (${headlineDaysCount}d synced)` : 'Weather capture'}
              </div>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 text-[12px]">
            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
                Sunlight Type:
              </dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {isDayViewPastDate
                  ? `Clear-Sky Benchmark Verified`
                  : directDiffuse.available && directDiffuse.directPct != null
                    ? directDiffuse.directPct >= 65
                      ? `Bright Direct Sunlight (${directDiffuse.directPct}%)`
                      : `Scattered Sunlight (${directDiffuse.diffusePct ?? 0}%)`
                    : `Night Standby (${sun.sunriseText})`}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium shrink-0">Sun Strength on Roof:</dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {isDayViewPastDate && daySunStats
                  ? `${daySunStats.gtiPeakWm2 && daySunStats.gtiPeakWm2 >= 600 ? 'Strong Sunlight' : 'Moderate Sunlight'}${daySunStats.radiationMjM2 != null ? ` · ${(daySunStats.radiationMjM2 * 0.278).toFixed(1)} kWh/m²` : ''}`
                  : directDiffuse.available
                    ? weatherNow.gtiWm2 >= 600
                      ? `Strong Sun (${weatherNow.gtiWm2} W/m²)`
                      : weatherNow.gtiWm2 >= 200
                        ? `Moderate Sun (${weatherNow.gtiWm2} W/m²)`
                        : `Low Light (${weatherNow.gtiWm2} W/m²)`
                    : 'Night (0 W/m²)'}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium shrink-0">Overall System Efficiency:</dt>
              <dd className="font-semibold text-slate-800 text-right tabular-nums">
                {isDayViewPastDate && daySunStats
                  ? `${daySunStats.prPct.toFixed(1)}% (Cleanliness: ${(100 - daySunStats.surfaceLossPct).toFixed(0)}%)`
                  : `${effectivePrBreakdown.prPct.toFixed(1)}% (Good condition)`}
              </dd>
            </div>

            <div className="py-2.5 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium shrink-0">Inverter Conversion:</dt>
              <dd className="font-semibold text-slate-900 text-right tabular-nums">
                {renderInverterEfficiencyText()}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* RIGHT (60% -> 7 cols): Where Did The Solar Energy Go? */}
      <section className="lg:col-span-7 rounded-3xl apple-glass-static p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-sky-600" />
                Where Did The Solar Energy Go?
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {periodLabel} · Compared to clear-sky benchmark
              </p>
            </div>
            {attribution && (
              <div className="text-right tabular-nums">
                <span className="text-[13px] font-extrabold text-slate-900">
                  {attribution.deliveredRealKwh.toFixed(1)} kWh
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {' '}
                  / {attribution.idealClearSkyKwh.toFixed(1)} kWh Target
                </span>
              </div>
            )}
          </div>

          {/* Smooth Proportional Attribution Bar */}
          {attribution && attribution.idealClearSkyKwh > 0.1 ? (
            <div className="my-4 space-y-2">
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                {deliveredPct > 0 && (
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${deliveredPct.toFixed(1)}%` }}
                    title={`Delivered AC: ${attribution.deliveredRealKwh.toFixed(1)} kWh`}
                  />
                )}
                {weatherPct > 0 && (
                  <div
                    className="h-full bg-sky-400 transition-all duration-300"
                    style={{ width: `${weatherPct.toFixed(1)}%` }}
                    title={`Cloud & Rain: -${attribution.weatherLossKwh.toFixed(1)} kWh`}
                  />
                )}
                {dirtPct > 0 && (
                  <div
                    className="h-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${dirtPct.toFixed(1)}%` }}
                    title={`Haze & Soiling: -${attribution.hazeAndSoilingLossKwh.toFixed(1)} kWh`}
                  />
                )}
                {gapPct > 0.5 && (
                  <div
                    className="h-full bg-slate-300 transition-all duration-300"
                    style={{ width: `${gapPct.toFixed(1)}%` }}
                    title={`Unlogged / Outage: ${attribution.outageGapKwh.toFixed(1)} kWh`}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] font-medium text-slate-500 tabular-nums">
                <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
                  <span className="w-2 h-2 rounded-xs bg-emerald-500" />
                  Delivered to Home & Grid ({deliveredPct.toFixed(0)}%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs bg-sky-400" />
                  Cloud & Rain Losses (-{attribution.weatherLossKwh.toFixed(1)} kWh)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-xs bg-amber-400" />
                  Dust & Smog Losses (-{attribution.hazeAndSoilingLossKwh.toFixed(1)} kWh)
                </span>
                {attribution.outageGapKwh > 0.2 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-slate-300" />
                    Grid Power Cut Losses ({attribution.outageGapKwh.toFixed(1)} kWh)
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="my-4 py-2 text-[11.5px] text-slate-400">
              {isCombined
                ? 'Combined multi-plant aggregation enabled — switch to a single station for detailed particle & AOD dip attribution.'
                : 'Awaiting confirmed daily telemetry ledger for period attribution.'}
            </div>
          )}

          {/* Hairline Period Summary Rows */}
          <dl className="divide-y divide-slate-100 text-[12px]">
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium">Delivered to Home & Grid</dt>
              <dd className="font-semibold text-slate-900 tabular-nums text-right">
                {attribution
                  ? `${attribution.deliveredRealKwh.toFixed(1)} kWh across ${attribution.confirmedDays} confirmed ${attribution.confirmedDays === 1 ? 'day' : 'days'}`
                  : '—'}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-sky-500" />
                Cloud & Rain Losses
              </dt>
              <dd className="font-semibold text-slate-800 tabular-nums text-right">
                {attribution
                  ? attribution.cloudRainDays > 0
                    ? `-${attribution.weatherLossKwh.toFixed(1)} kWh (${attribution.cloudRainDays} cloudy days)`
                    : `-${attribution.weatherLossKwh.toFixed(1)} kWh (Clear conditions)`
                  : '—'}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between gap-3">
              <dt className="text-slate-500 font-medium flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-amber-500" />
                Dust & Smog Losses
              </dt>
              <dd className="font-semibold text-slate-800 tabular-nums text-right">
                {attribution
                  ? `-${attribution.hazeAndSoilingLossKwh.toFixed(1)} kWh · Dust -${soiling.surfaceLossPct.toFixed(1)}%`
                  : `Dust -${soiling.surfaceLossPct.toFixed(1)}%`}
              </dd>
            </div>
          </dl>
        </div>

        <div className="pt-2.5 mt-1 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
          <span className="text-slate-500 font-medium">
            {attribution && attribution.outageOrPendingDays > 0
              ? `Sync status: ${attribution.confirmedDays} days verified`
              : 'All period days verified'}
          </span>
          <button
            type="button"
            onClick={onNavigateToHealth}
            className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900 cursor-pointer transition-colors"
          >
            <span>Inspect System Health</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};
