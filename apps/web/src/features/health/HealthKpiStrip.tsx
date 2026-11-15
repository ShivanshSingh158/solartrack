import React from 'react';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import type { CanonicalSolarSnapshot, SystemHealthReport } from '@solar-track/core';

interface HealthKpiStripProps {
  report: SystemHealthReport;
  canonicalSnapshot: CanonicalSolarSnapshot;
}

interface HealthKpiCol {
  eyebrow: string;
  accentDot: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';
  primary: string;
  primaryTone: 'slate' | 'emerald' | 'sky' | 'amber' | 'rose';
  primaryUnit?: string;
  rightMeta?: string;
  subtitle: string;
  gauge?: React.ReactNode;
}

const DOT_CLASS: Record<HealthKpiCol['accentDot'], string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
};

const TONE_CLASS: Record<HealthKpiCol['primaryTone'], string> = {
  slate: 'text-slate-900',
  emerald: 'text-emerald-700',
  sky: 'text-sky-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
};

export const HealthKpiStrip: React.FC<HealthKpiStripProps> = ({ report, canonicalSnapshot }) => {
  const {
    conversion,
    thermalStress,
    logger,
    mpptTiming,
    pendingEepromDays,
    unloggedOutageDays,
    clearSkyHealthPct,
  } = report;
  const { truth, thermalAndElectrical } = canonicalSnapshot;

  const etaVal = conversion.weightedEtaPct ?? conversion.liveEtaPct;
  const col1: HealthKpiCol = {
    eyebrow: 'Inverter Efficiency',
    accentDot: truth.isNight || truth.isStale ? 'slate' : etaVal !== null && etaVal < 92 ? 'amber' : 'emerald',
    primary: truth.isNight
      ? 'Standby'
      : truth.isStale
        ? 'Offline'
        : etaVal !== null
          ? `${etaVal.toFixed(1)}%`
          : 'Awaiting ≥0.08kW',
    primaryTone: truth.isNight || truth.isStale ? 'slate' : etaVal !== null && etaVal < 92 ? 'amber' : 'emerald',
    primaryUnit:
      !truth.isNight && !truth.isStale && conversion.avgHeatLossWatts !== null
        ? `· ${conversion.avgHeatLossWatts}W heat loss`
        : undefined,
    rightMeta:
      conversion.skewedSamplesCount > 0
        ? `${conversion.skewedSamplesCount} skew filtered`
        : conversion.cleanSamplesCount > 0
          ? `${conversion.cleanSamplesCount} clean pts`
          : undefined,
    subtitle:
      thermalAndElectrical.dcKw !== null && thermalAndElectrical.acKw !== null && !truth.isNight && !truth.isStale
        ? `${thermalAndElectrical.dcKw.toFixed(2)} DC → ${thermalAndElectrical.acKw.toFixed(2)} AC (${conversion.liveLoadPct ?? 0}% load)`
        : `Peak AC today ${conversion.peakAcKw.toFixed(2)} kW`,
    gauge:
      !truth.isNight && !truth.isStale && etaVal !== null ? (
        <Gauge
          value={etaVal}
          valueMin={80}
          valueMax={100}
          startAngle={-100}
          endAngle={100}
          innerRadius="70%"
          outerRadius="100%"
          width={38}
          height={32}
          sx={{
            [`& .${gaugeClasses.valueArc}`]: {
              fill: etaVal >= 95 ? '#059669' : etaVal >= 90 ? '#d97706' : '#e11d48',
            },
            [`& .${gaugeClasses.referenceArc}`]: { fill: '#e2e8f0' },
            [`& .${gaugeClasses.valueText}`]: { display: 'none' },
          }}
        />
      ) : undefined,
  };

  const col2: HealthKpiCol = {
    eyebrow: 'Panel Temperature',
    accentDot: thermalStress.heatDeratingPct >= 8 ? 'amber' : 'sky',
    primary: thermalStress.cellTempFormatted,
    primaryTone: thermalStress.heatDeratingPct >= 8 ? 'amber' : 'slate',
    primaryUnit: `-${thermalStress.heatDeratingPct.toFixed(1)}% heat loss`,
    rightMeta: `${thermalStress.ambientTempFormatted} outdoor`,
    subtitle: `${thermalStress.thermalSafetyMarginC}°C below safe limit · Wind cooling`,
  };

  const col3: HealthKpiCol = {
    eyebrow: 'Connection Reliability',
    accentDot:
      logger.status === 'OFFLINE'
        ? 'rose'
        : logger.rawDeliveryPct !== null && logger.rawDeliveryPct < 75
          ? 'amber'
          : 'emerald',
    primary:
      logger.rawDeliveryPct !== null
        ? `${logger.rawDeliveryPct}%`
        : logger.status === 'PRE_DAWN'
          ? 'Pre-Dawn'
          : '0%',
    primaryTone:
      logger.status === 'OFFLINE'
        ? 'rose'
        : logger.rawDeliveryPct !== null && logger.rawDeliveryPct < 75
          ? 'amber'
          : 'slate',
    primaryUnit: logger.expectedSlots > 0 ? `${logger.rawReceivedSlots}/${logger.expectedSlots} packets received` : undefined,
    rightMeta:
      unloggedOutageDays.length > 0
        ? `${unloggedOutageDays.length} day offline`
        : pendingEepromDays.length > 0
          ? `${pendingEepromDays.length}d awaiting sync`
          : 'Archive synced',
    subtitle:
      logger.healedCoveragePct !== null && logger.healedDropCount > 0
        ? `Healed curve: ${logger.healedCoveragePct}% (+${logger.healedDropCount} interp)`
        : logger.daylightSyncNote,
    gauge:
      logger.rawDeliveryPct !== null && logger.status !== 'OFFLINE' ? (
        <Gauge
          value={logger.rawDeliveryPct}
          valueMin={0}
          valueMax={100}
          startAngle={-100}
          endAngle={100}
          innerRadius="70%"
          outerRadius="100%"
          width={38}
          height={32}
          sx={{
            [`& .${gaugeClasses.valueArc}`]: {
              fill: logger.rawDeliveryPct >= 85 ? '#059669' : logger.rawDeliveryPct >= 70 ? '#d97706' : '#e11d48',
            },
            [`& .${gaugeClasses.referenceArc}`]: { fill: '#e2e8f0' },
            [`& .${gaugeClasses.valueText}`]: { display: 'none' },
          }}
        />
      ) : undefined,
  };

  const col4: HealthKpiCol = {
    eyebrow: 'Morning Wake-Up Time',
    accentDot:
      mpptTiming.status === 'lag_warning'
        ? 'rose'
        : mpptTiming.status === 'moderate' || (clearSkyHealthPct !== null && clearSkyHealthPct < 88)
          ? 'amber'
          : 'emerald',
    primary:
      mpptTiming.wakeLagMinutes !== null
        ? `${mpptTiming.wakeLagMinutes > 0 ? '+' : ''}${mpptTiming.wakeLagMinutes} min`
        : clearSkyHealthPct !== null
          ? `${clearSkyHealthPct}%`
          : '—',
    primaryTone:
      mpptTiming.status === 'lag_warning'
        ? 'rose'
        : mpptTiming.status === 'moderate'
          ? 'amber'
          : 'emerald',
    primaryUnit: mpptTiming.wakeLagMinutes !== null ? 'wake delay' : 'clear-sky',
    rightMeta:
      clearSkyHealthPct !== null
        ? `${clearSkyHealthPct}% clear sky days`
        : mpptTiming.morningGtiAtWake !== null
          ? `Wake ${mpptTiming.morningGtiAtWake} W/m²`
          : undefined,
    subtitle:
      mpptTiming.firstWattMin !== null
        ? `${mpptTiming.basisLabel}: ${mpptTiming.firstWattText}`
        : mpptTiming.headline,
  };

  const columns: [HealthKpiCol, HealthKpiCol, HealthKpiCol, HealthKpiCol] = [col1, col2, col3, col4];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/75 border-b border-slate-200/75 bg-slate-50/40">
      {columns.map((col, idx) => (
        <div
          key={`${col.eyebrow}-${idx}`}
          className="px-4 sm:px-5 py-3 flex flex-col justify-between gap-1 min-w-0"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASS[col.accentDot]}`} />
              <span className="truncate">{col.eyebrow}</span>
            </span>
            {col.rightMeta && (
              <span className="text-[10.5px] font-semibold text-slate-500 tabular-nums whitespace-nowrap shrink-0">
                {col.rightMeta}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span
                className={`text-[18px] sm:text-[19px] font-extrabold tracking-tight tabular-nums whitespace-nowrap ${
                  TONE_CLASS[col.primaryTone]
                }`}
              >
                {col.primary}
              </span>
              {col.primaryUnit && (
                <span className="text-[11px] font-semibold text-slate-500 truncate tabular-nums">
                  {col.primaryUnit}
                </span>
              )}
            </div>
            {col.gauge && <div className="shrink-0 -my-1">{col.gauge}</div>}
          </div>

          <div className="text-[11px] font-medium text-slate-500 tabular-nums truncate">
            {col.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
};
