import React, { useCallback, useMemo } from 'react';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import {
  formatMinutes12hUpper,
  type CanonicalSolarSnapshot,
  type HealthConversionPoint,
  type SystemHealthReport,
} from '@solar-track/core';

interface HealthConversionCurveStageProps {
  uid: string;
  report: SystemHealthReport;
  canonicalSnapshot: CanonicalSolarSnapshot;
  boxWidth: number;
  hoveredConvIdx: number | null;
  onHoverConvIdx: (idx: number | null) => void;
}

/**
 * DC vs AC conversion curve with heat loss shaded area and filtered inverter efficiency.
 */
export const HealthConversionCurveStage: React.FC<HealthConversionCurveStageProps> = ({
  uid,
  report,
  canonicalSnapshot,
  boxWidth,
  hoveredConvIdx,
  onHoverConvIdx,
}) => {
  const { conversion } = report;
  const { sun, config } = canonicalSnapshot;

  const isCompact = boxWidth < 520;
  const svgW = Math.max(300, boxWidth);
  const svgH = isCompact ? 255 : 295;
  const padL = isCompact ? 38 : 48;
  const padR = isCompact ? 36 : 46;
  const padT = 22;
  const padB = 34;
  const plotW = Math.max(80, svgW - padL - padR);
  const plotH = Math.max(80, svgH - padT - padB);

  const srMin = sun.sunriseMin ?? 375;
  const ssMin = sun.sunsetMin ?? 1045;
  const minMin = Math.max(300, srMin - 20);
  const maxMin = Math.min(1200, ssMin + 20);
  const minSpan = Math.max(120, maxMin - minMin);
  const maxKw = Math.max(
    config.capacityKwp,
    conversion.peakDcKw * 1.14,
    conversion.peakAcKw * 1.18,
    0.8,
  );

  const convX = useCallback(
    (m: number) => padL + ((Math.min(maxMin, Math.max(minMin, m)) - minMin) / minSpan) * plotW,
    [padL, minMin, maxMin, minSpan, plotW],
  );
  const kwY = useCallback(
    (kw: number) => padT + plotH - (Math.min(maxKw, Math.max(0, kw)) / maxKw) * plotH,
    [padT, plotH, maxKw],
  );
  const etaY = useCallback(
    (eta: number) => {
      const clamped = Math.min(100, Math.max(80, eta));
      return padT + plotH - ((clamped - 80) / 20) * plotH;
    },
    [padT, plotH],
  );

  const convPaths = useMemo(() => {
    const pts = conversion.points;
    if (pts.length === 0) {
      return {
        dcPath: '',
        acPath: '',
        acAreaPath: '',
        heatBandPath: '',
        etaPath: '',
        skewPts: [] as HealthConversionPoint[],
      };
    }
    const dcCoords = pts.map((p) => `${convX(p.minutes).toFixed(1)},${kwY(p.dcKw).toFixed(1)}`);
    const acCoords = pts.map((p) => `${convX(p.minutes).toFixed(1)},${kwY(p.acKw).toFixed(1)}`);
    const dcRevCoords = pts
      .toReversed()
      .map((p) => `${convX(p.minutes).toFixed(1)},${kwY(Math.max(p.dcKw, p.acKw)).toFixed(1)}`);
    const firstX = convX(pts[0].minutes).toFixed(1);
    const lastX = convX(pts[pts.length - 1].minutes).toFixed(1);
    const baseY = (padT + plotH).toFixed(1);

    const dcPath = `M ${dcCoords.join(' L ')}`;
    const acPath = `M ${acCoords.join(' L ')}`;
    const acAreaPath = `M ${firstX},${baseY} L ${acCoords.join(' L ')} L ${lastX},${baseY} Z`;
    const heatBandPath = `M ${acCoords.join(' L ')} L ${dcRevCoords.join(' L ')} Z`;

    const cleanEtaPts = pts.filter((p) => p.flag === 'CLEAN' && p.etaPct !== null);
    let etaPath = '';
    cleanEtaPts.forEach((p, idx) => {
      const prev = cleanEtaPts[idx - 1];
      const gap = prev ? p.minutes - prev.minutes : 0;
      const cmd = idx === 0 || gap > 30 ? 'M' : 'L';
      etaPath += `${cmd} ${convX(p.minutes).toFixed(1)},${etaY(p.etaPct!).toFixed(1)} `;
    });

    const skewPts = pts.filter((p) => p.flag === 'RS485_SYNC_SKEW');
    return { dcPath, acPath, acAreaPath, heatBandPath, etaPath: etaPath.trim(), skewPts };
  }, [conversion.points, padT, plotH, convX, kwY, etaY]);

  const timeTicks = useMemo(() => {
    const startH = Math.ceil(minMin / 60);
    const endH = Math.floor(maxMin / 60);
    const step = isCompact ? 3 : 2;
    const out: number[] = [];
    for (let h = startH; h <= endH; h++) {
      if ((h - startH) % step === 0) out.push(h * 60);
    }
    return out;
  }, [minMin, maxMin, isCompact]);

  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>) => {
    if (conversion.points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < padL || relX > padL + plotW) {
      onHoverConvIdx(null);
      return;
    }
    const targetMin = minMin + ((relX - padL) / plotW) * minSpan;
    let bestIdx = 0;
    let bestDiff = Infinity;
    conversion.points.forEach((pt, idx) => {
      const diff = Math.abs(pt.minutes - targetMin);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });
    onHoverConvIdx(bestIdx);
  };

  const hoveredPt = hoveredConvIdx !== null ? conversion.points[hoveredConvIdx] ?? null : null;
  const etaVal = conversion.weightedEtaPct ?? conversion.liveEtaPct ?? 96.5;
  const capacityKw = config.acInverterCapacityKw || 3.0;
  const peakKw = conversion.peakAcKw;
  const attainmentPct = Math.min(100, Math.round((peakKw / Math.max(0.1, capacityKw)) * 100));

  return (
    <div className="px-4 sm:px-6 pt-3 pb-4">
      {/* Telemetry Gauge Diagnostics Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 rounded-2xl bg-gradient-to-r from-slate-50/80 via-emerald-50/20 to-sky-50/20 border border-slate-200/70 shadow-2xs">
        {/* Gauge 1: MPPT Efficiency */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/90 border border-slate-200/60 shadow-2xs">
          <div className="w-[74px] h-[64px] shrink-0 flex items-center justify-center">
            <Gauge
              value={etaVal}
              valueMin={80}
              valueMax={100}
              startAngle={-110}
              endAngle={110}
              innerRadius="72%"
              outerRadius="100%"
              cornerRadius="50%"
              width={74}
              height={64}
              text={`${etaVal.toFixed(1)}%`}
              sx={{
                [`& .${gaugeClasses.valueArc}`]: {
                  fill: etaVal >= 95 ? '#059669' : etaVal >= 90 ? '#d97706' : '#e11d48',
                },
                [`& .${gaugeClasses.referenceArc}`]: { fill: '#e2e8f0' },
                [`& .${gaugeClasses.valueText}`]: {
                  fontSize: '11.5px',
                  fontWeight: 800,
                  fill: '#0f172a',
                  fontFamily: 'inherit',
                },
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              MPPT Efficiency (η)
            </div>
            <div className="text-[13px] font-extrabold text-slate-900 tabular-nums">
              {etaVal.toFixed(1)}%
            </div>
            <div className="text-[10.5px] font-medium text-emerald-700 truncate">
              {etaVal >= 95 ? 'Euro-η Optimal' : 'Derated Operation'}
            </div>
          </div>
        </div>

        {/* Gauge 2: Capacity Attainment */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/90 border border-slate-200/60 shadow-2xs">
          <div className="w-[74px] h-[64px] shrink-0 flex items-center justify-center">
            <Gauge
              value={attainmentPct}
              valueMin={0}
              valueMax={100}
              startAngle={-110}
              endAngle={110}
              innerRadius="72%"
              outerRadius="100%"
              cornerRadius="50%"
              width={74}
              height={64}
              text={`${attainmentPct}%`}
              sx={{
                [`& .${gaugeClasses.valueArc}`]: { fill: '#0284c7' },
                [`& .${gaugeClasses.referenceArc}`]: { fill: '#e2e8f0' },
                [`& .${gaugeClasses.valueText}`]: {
                  fontSize: '11.5px',
                  fontWeight: 800,
                  fill: '#0f172a',
                  fontFamily: 'inherit',
                },
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Inverter Attainment
            </div>
            <div className="text-[13px] font-extrabold text-slate-900 tabular-nums">
              {peakKw.toFixed(2)} kW
            </div>
            <div className="text-[10.5px] font-medium text-slate-500 truncate">
              {attainmentPct}% of {capacityKw.toFixed(1)} kW rated
            </div>
          </div>
        </div>

        {/* Metric 3: Heat Dissipation */}
        <div className="flex flex-col justify-between p-2.5 rounded-xl bg-white/90 border border-slate-200/60 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Avg Heat Dissipation
          </div>
          <div className="text-[17px] font-extrabold text-rose-600 tabular-nums my-0.5">
            {conversion.avgHeatLossWatts !== null ? `${conversion.avgHeatLossWatts} W` : '0 W'}
          </div>
          <div className="text-[10.5px] font-medium text-slate-500 truncate">
            Inverter thermal loss delta
          </div>
        </div>

        {/* Metric 4: Sample Purity */}
        <div className="flex flex-col justify-between p-2.5 rounded-xl bg-white/90 border border-slate-200/60 shadow-2xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Telemetry Purity
          </div>
          <div className="text-[17px] font-extrabold text-slate-900 tabular-nums my-0.5">
            {conversion.cleanSamplesCount} clean
          </div>
          <div className="text-[10.5px] font-medium text-slate-500 truncate">
            {conversion.skewedSamplesCount > 0 ? `${conversion.skewedSamplesCount} RS485 skew filtered` : '100% sample synchrony'}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px] font-medium text-slate-500">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-600 border-t border-dashed border-amber-600" />
            DC Array Input (kW)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#107C41]" />
            AC Inverter Output (kW)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-400/35 border border-rose-400/60" />
            Heat Drop (W)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-sky-600" />
            Filtered Inverter η (%)
          </span>
          {conversion.skewedSamplesCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="w-2 h-2 rounded-full border-2 border-amber-600 bg-white" />
              RS485 Skew Filtered ({conversion.skewedSamplesCount})
            </span>
          )}
        </div>
        <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums">
          η bounded [45%, 98.5%] · DC &lt; 80W standby excluded
        </span>
      </div>

      <div className="relative w-full select-none">
        {conversion.points.length === 0 ? (
          <div className="h-[245px] flex flex-col items-center justify-center text-center px-4">
            <p className="text-xs font-bold text-slate-700">
              Awaiting daytime DC + AC 5-minute conversion samples
            </p>
            <p className="text-[11px] font-medium text-slate-400 mt-1">
              Inverter telemetry populates after MPPT wake ({formatMinutes12hUpper(srMin)} IST)
            </p>
          </div>
        ) : (
          <svg
            width={svgW}
            height={svgH}
            className="block overflow-visible cursor-crosshair"
            onMouseMove={handlePointerMove}
            onPointerMove={handlePointerMove}
            onMouseLeave={() => onHoverConvIdx(null)}
          >
            <defs>
              <linearGradient id={`${uid}-acFill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#107C41" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#107C41" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const y = padT + plotH - frac * plotH;
              const kwLabel = (maxKw * frac).toFixed(1);
              const etaLabel = Math.round(80 + frac * 20);
              return (
                <g key={frac}>
                  <line
                    x1={padL}
                    x2={padL + plotW}
                    y1={y}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray={frac === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padL - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px] font-semibold tabular-nums"
                  >
                    {kwLabel}kW
                  </text>
                  <text
                    x={padL + plotW + 8}
                    y={y + 3.5}
                    textAnchor="start"
                    className="fill-sky-600/80 text-[10px] font-semibold tabular-nums"
                  >
                    {etaLabel}%
                  </text>
                </g>
              );
            })}

            {timeTicks.map((tm) => {
              const x = convX(tm);
              return (
                <g key={tm}>
                  <line x1={x} x2={x} y1={padT + plotH} y2={padT + plotH + 4} stroke="#CBD5E1" />
                  <text
                    x={x}
                    y={padT + plotH + 17}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px] font-semibold tabular-nums"
                  >
                    {formatMinutes12hUpper(tm).replace(':00 ', '').toLowerCase()}
                  </text>
                </g>
              );
            })}

            {convPaths.heatBandPath && <path d={convPaths.heatBandPath} fill="rgba(244, 63, 94, 0.14)" />}
            {convPaths.acAreaPath && <path d={convPaths.acAreaPath} fill={`url(#${uid}-acFill)`} />}
            {convPaths.dcPath && (
              <path
                d={convPaths.dcPath}
                fill="none"
                stroke="#D97706"
                strokeWidth={1.6}
                strokeDasharray="4 3"
              />
            )}
            {convPaths.acPath && (
              <path d={convPaths.acPath} fill="none" stroke="#107C41" strokeWidth={2.2} strokeLinejoin="round" />
            )}
            {convPaths.etaPath && (
              <path d={convPaths.etaPath} fill="none" stroke="#0284C7" strokeWidth={1.6} strokeLinejoin="round" />
            )}

            {convPaths.skewPts.map((pt) => (
              <circle
                key={`skew-${pt.minutes}`}
                cx={convX(pt.minutes)}
                cy={kwY(pt.dcKw)}
                r={3.2}
                fill="#FFFFFF"
                stroke="#D97706"
                strokeWidth={1.6}
              />
            ))}

            {hoveredPt && (
              <g>
                <line
                  x1={convX(hoveredPt.minutes)}
                  x2={convX(hoveredPt.minutes)}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="#0F172A"
                  strokeOpacity={0.28}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={convX(hoveredPt.minutes)}
                  cy={kwY(hoveredPt.dcKw)}
                  r={3.5}
                  fill="#D97706"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
                <circle
                  cx={convX(hoveredPt.minutes)}
                  cy={kwY(hoveredPt.acKw)}
                  r={4}
                  fill="#107C41"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
                {hoveredPt.etaPct !== null && (
                  <circle
                    cx={convX(hoveredPt.minutes)}
                    cy={etaY(hoveredPt.etaPct)}
                    r={3.5}
                    fill="#0284C7"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                  />
                )}
              </g>
            )}
          </svg>
        )}

        {hoveredPt && (
          <div
            className="pointer-events-none absolute top-9 z-20 rounded-xl bg-slate-900/95 text-white px-3 py-2 shadow-xl text-[11px] min-w-[215px]"
            style={{
              left: Math.min(Math.max(8, convX(hoveredPt.minutes) + 12), Math.max(8, svgW - 230)),
            }}
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>{hoveredPt.timeLabel} IST</span>
              <span className="text-sky-300 tabular-nums">
                {hoveredPt.flag === 'CLEAN' && hoveredPt.etaPct !== null
                  ? `η ${hoveredPt.etaPct.toFixed(1)}%`
                  : hoveredPt.flag === 'RS485_SYNC_SKEW'
                    ? 'RS485 Skew Filtered'
                    : 'Low Light (<0.08kW)'}
              </span>
            </div>
            <div className="mt-1 space-y-0.5 text-slate-300 tabular-nums">
              <div className="flex justify-between gap-3">
                <span>DC Array (pvPower)</span>
                <span className="font-bold text-amber-300">{hoveredPt.dcKw.toFixed(2)} kW</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>AC Inverter (gen)</span>
                <span className="font-bold text-emerald-300">{hoveredPt.acKw.toFixed(2)} kW</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Conversion Heat Loss</span>
                <span className="font-bold text-rose-300">{hoveredPt.heatLossWatts} W</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
