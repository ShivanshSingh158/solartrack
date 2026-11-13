import React, { useMemo } from 'react';
import {
  formatINR,
  type PaybackHorizonAnalysis,
} from '@solar-track/core';

interface FinancialsPaybackStageProps {
  uid: string;
  payback: PaybackHorizonAnalysis;
  boxWidth: number;
  horizonYears: 10 | 25;
  onSelectHorizonYears: (yr: 10 | 25) => void;
  hoveredYearIdx: number | null;
  onHoverYearIdx: (idx: number | null) => void;
}

/**
 * Multi-year ROI payback curve view: Cumulative net cashflow against net CapEx target,
 * with interactive 10y / 25y horizon selection and breakeven marker.
 */
export const FinancialsPaybackStage: React.FC<FinancialsPaybackStageProps> = ({
  uid,
  payback,
  boxWidth,
  horizonYears,
  onSelectHorizonYears,
  hoveredYearIdx,
  onHoverYearIdx,
}) => {
  const isCompact = boxWidth < 520;
  const svgW = Math.max(300, boxWidth);
  const svgH = isCompact ? 250 : 292;
  const padL = isCompact ? 46 : 58;
  const padR = isCompact ? 16 : 24;
  const padT = 22;
  const padB = 34;
  const plotW = Math.max(80, svgW - padL - padR);
  const plotH = Math.max(80, svgH - padT - padB);

  const visibleAnnual = useMemo(
    () => payback.annualSeries.filter((p) => p.yearOffset <= horizonYears),
    [payback.annualSeries, horizonYears],
  );

  const capex = Math.max(1000, payback.netCapexInr);
  const maxCum = Math.max(capex * 1.25, ...visibleAnnual.map((p) => p.cumulativeNetInr), 10000);
  const xStep = visibleAnnual.length > 1 ? plotW / (visibleAnnual.length - 1) : plotW;
  const yrX = (idx: number) => padL + idx * xStep;
  const inrY = (val: number) => padT + plotH - (Math.min(maxCum, Math.max(0, val)) / maxCum) * plotH;
  const capexY = inrY(capex);

  const lineCoords = visibleAnnual.map((p, idx) => `${yrX(idx).toFixed(1)},${inrY(p.cumulativeNetInr).toFixed(1)}`);
  const linePath = lineCoords.length > 0 ? `M ${lineCoords.join(' L ')}` : '';
  const areaPath =
    lineCoords.length > 0
      ? `M ${yrX(0).toFixed(1)},${(padT + plotH).toFixed(1)} L ${lineCoords.join(' L ')} L ${yrX(
          visibleAnnual.length - 1,
        ).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : '';

  const breakevenFractionalYear =
    payback.breakevenYears !== null && payback.breakevenYears <= horizonYears ? payback.breakevenYears : null;
  const breakevenX =
    breakevenFractionalYear !== null ? padL + (breakevenFractionalYear / Math.max(1, horizonYears)) * plotW : null;

  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>) => {
    if (visibleAnnual.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < padL - 10 || relX > padL + plotW + 10) {
      onHoverYearIdx(null);
      return;
    }
    const rawIdx = Math.round((relX - padL) / Math.max(1, xStep));
    onHoverYearIdx(Math.min(visibleAnnual.length - 1, Math.max(0, rawIdx)));
  };

  const hoveredYr = hoveredYearIdx !== null ? visibleAnnual[hoveredYearIdx] ?? null : null;

  return (
    <div className="px-4 sm:px-6 pt-3 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px] font-medium text-slate-500">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#107C41]" />
            Cumulative Electricity Savings (₹)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500" />
            System Investment ({formatINR(capex)})
          </span>
          {breakevenFractionalYear !== null && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#107C41] ring-2 ring-emerald-200" />
              Breakeven: {payback.breakevenLabel}
            </span>
          )}
        </div>

        <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-[10.5px] font-bold">
          {([10, 25] as const).map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => onSelectHorizonYears(yr)}
              className={`px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                horizonYears === yr ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {yr}-Year View
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full select-none">
        <svg
          width={svgW}
          height={svgH}
          className="block overflow-visible cursor-crosshair"
          onMouseMove={handlePointerMove}
          onPointerMove={handlePointerMove}
          onMouseLeave={() => onHoverYearIdx(null)}
        >
          <defs>
            <linearGradient id={`${uid}-paybackArea`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#107C41" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#107C41" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const val = maxCum * frac;
            const y = padT + plotH - frac * plotH;
            const lakhLabel = val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${Math.round(val / 1000)}k`;
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
                  {lakhLabel}
                </text>
              </g>
            );
          })}

          <line
            x1={padL}
            x2={padL + plotW}
            y1={capexY}
            y2={capexY}
            stroke="#D97706"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <text
            x={padL + plotW - 4}
            y={Math.max(padT + 10, capexY - 6)}
            textAnchor="end"
            className="fill-amber-700 text-[10px] font-bold tabular-nums"
          >
            Investment {formatINR(capex)}
          </text>

          {visibleAnnual.map((p, idx) => {
            const step = horizonYears === 25 ? (isCompact ? 5 : 5) : isCompact ? 2 : 1;
            const show = p.yearOffset === 0 || p.yearOffset === horizonYears || p.yearOffset % step === 0;
            if (!show) return null;
            const x = yrX(idx);
            return (
              <g key={p.yearLabel}>
                <line x1={x} x2={x} y1={padT + plotH} y2={padT + plotH + 4} stroke="#CBD5E1" />
                <text
                  x={x}
                  y={padT + plotH + 17}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] font-semibold tabular-nums"
                >
                  {p.yearLabel}
                </text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill={`url(#${uid}-paybackArea)`} />}
          {linePath && <path d={linePath} fill="none" stroke="#107C41" strokeWidth={2.4} strokeLinejoin="round" />}

          {breakevenX !== null && (
            <g>
              <line
                x1={breakevenX}
                x2={breakevenX}
                y1={capexY}
                y2={padT + plotH}
                stroke="#107C41"
                strokeOpacity={0.3}
                strokeDasharray="3 3"
              />
              <circle cx={breakevenX} cy={capexY} r={5} fill="#107C41" stroke="#FFFFFF" strokeWidth={2} />
            </g>
          )}

          {hoveredYr && hoveredYearIdx !== null && (
            <g>
              <line
                x1={yrX(hoveredYearIdx)}
                x2={yrX(hoveredYearIdx)}
                y1={padT}
                y2={padT + plotH}
                stroke="#0F172A"
                strokeOpacity={0.28}
                strokeDasharray="3 3"
              />
              <circle
                cx={yrX(hoveredYearIdx)}
                cy={inrY(hoveredYr.cumulativeNetInr)}
                r={4.5}
                fill="#107C41"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {hoveredYr && hoveredYearIdx !== null && (
          <div
            className="pointer-events-none absolute top-9 z-20 rounded-xl bg-slate-900/95 text-white px-3 py-2 shadow-xl text-[11px] min-w-[215px]"
            style={{
              left: Math.min(Math.max(8, yrX(hoveredYearIdx) + 12), Math.max(8, svgW - 230)),
            }}
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>{hoveredYr.yearOffset === 0 ? 'Current Anchor (Today)' : `Year ${hoveredYr.yearOffset}`}</span>
              <span className="text-emerald-300 tabular-nums">{hoveredYr.paidOffPct}% paid off</span>
            </div>
            <div className="mt-1 space-y-0.5 text-slate-300 tabular-nums">
              <div className="flex justify-between gap-3">
                <span>Cumulative Cash</span>
                <span className="font-bold text-white">{formatINR(hoveredYr.cumulativeNetInr)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>{hoveredYr.yearOffset === 0 ? 'Confirmed Yield' : 'Est. Annual Yield'}</span>
                <span className="text-sky-300">{hoveredYr.annualYieldKwh.toLocaleString('en-IN')} kWh</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>
                  {hoveredYr.cumulativeNetInr >= hoveredYr.capexTargetInr ? 'Net Asset Profit' : 'Remaining CapEx'}
                </span>
                <span
                  className={`font-bold ${
                    hoveredYr.cumulativeNetInr >= hoveredYr.capexTargetInr ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {hoveredYr.cumulativeNetInr >= hoveredYr.capexTargetInr
                    ? `+${formatINR(hoveredYr.cumulativeNetInr - hoveredYr.capexTargetInr)}`
                    : formatINR(hoveredYr.remainingPrincipalInr)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
