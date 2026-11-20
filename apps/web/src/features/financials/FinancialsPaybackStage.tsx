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
 * Multi-year ROI payback curve view: Realistic monthly seasonal S-curve against net CapEx target,
 * defaulting to an actionable 10-year horizon with interactive 25-year toggle, breakeven marker,
 * and dedicated 4-milestone payoff track.
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

  const maxMonths = horizonYears * 12;
  const visibleMonthly = useMemo(
    () => (payback.monthlySeries || []).filter((m) => m.monthIndex <= maxMonths),
    [payback.monthlySeries, maxMonths],
  );

  const capex = Math.max(1000, payback.netCapexInr);
  const maxCum = Math.max(
    capex * 1.25,
    ...visibleAnnual.map((p) => p.cumulativeNetInr),
    ...visibleMonthly.map((m) => m.cumulativeNetInr),
    10000,
  );

  const xStep = visibleAnnual.length > 1 ? plotW / (visibleAnnual.length - 1) : plotW;
  const yrX = (idx: number) => padL + idx * xStep;
  const inrY = (val: number) => padT + plotH - (Math.min(maxCum, Math.max(0, val)) / maxCum) * plotH;
  const capexY = inrY(capex);

  // Generate smooth cubic Bezier path for monthly series to avoid straight-line stiffness
  const curvePoints = useMemo(() => {
    if (visibleMonthly.length > 1) {
      return visibleMonthly.map((m) => ({
        x: padL + (m.monthIndex / maxMonths) * plotW,
        y: inrY(m.cumulativeNetInr),
      }));
    }
    return visibleAnnual.map((p, idx) => ({
      x: yrX(idx),
      y: inrY(p.cumulativeNetInr),
    }));
  }, [visibleMonthly, visibleAnnual, maxMonths, plotW, padL, maxCum, plotH, padT]);

  const { linePath, areaPath } = useMemo(() => {
    const pts = curvePoints;
    if (pts.length === 0) return { linePath: '', areaPath: '' };
    if (pts.length === 1) {
      return { linePath: `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`, areaPath: '' };
    }

    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    const last = pts[pts.length - 1];
    const first = pts[0];
    const a = `${d} L ${last.x.toFixed(1)},${(padT + plotH).toFixed(1)} L ${first.x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
    return { linePath: d, areaPath: a };
  }, [curvePoints, padT, plotH]);

  const breakevenFractionalYear =
    payback.breakevenYears !== null && payback.breakevenYears <= horizonYears
      ? payback.breakevenYears
      : null;
  const breakevenX =
    breakevenFractionalYear !== null
      ? padL + (breakevenFractionalYear / Math.max(1, horizonYears)) * plotW
      : null;

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
    <div className="pt-3 pb-0">
      <div className="px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px] font-medium text-slate-500">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-3 h-0.5 bg-[#107C41] rounded-full" />
            Cumulative Electricity Savings (₹)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500" />
            System Investment ({formatINR(capex)})
          </span>
          {breakevenFractionalYear !== null && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#107C41] ring-2 ring-emerald-200" />
              Breakeven: {payback.breakevenLabel} (~{payback.breakevenYears} yrs)
            </span>
          )}
        </div>

        <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-[10.5px] font-bold">
          {([10, 25] as const).map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => onSelectHorizonYears(yr)}
              className={`px-3 py-1 rounded-full transition cursor-pointer ${
                horizonYears === yr
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {yr}-Year View {yr === 10 ? '(Default)' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full select-none px-4 sm:px-6">
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
              <stop offset="0%" stopColor="#107C41" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#107C41" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#107C41" stopOpacity="0.01" />
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
            System Investment {formatINR(capex)}
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
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#107C41"
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {breakevenX !== null && (
            <g>
              <line
                x1={breakevenX}
                x2={breakevenX}
                y1={capexY}
                y2={padT + plotH}
                stroke="#107C41"
                strokeOpacity={0.35}
                strokeDasharray="3 3"
              />
              <circle cx={breakevenX} cy={capexY} r={8} fill="#107C41" fillOpacity={0.18} />
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
            className="pointer-events-none absolute top-9 z-20 rounded-xl bg-slate-900/95 text-white px-3.5 py-2.5 shadow-xl text-[11px] min-w-[220px]"
            style={{
              left: Math.min(Math.max(8, yrX(hoveredYearIdx) + 12), Math.max(8, svgW - 240)),
            }}
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>{hoveredYr.yearOffset === 0 ? 'Today (Anchor Baseline)' : `Year ${hoveredYr.yearOffset}`}</span>
              <span className="text-emerald-300 tabular-nums font-extrabold">{hoveredYr.paidOffPct}% paid off</span>
            </div>
            <div className="mt-1.5 space-y-1 text-slate-300 tabular-nums">
              <div className="flex justify-between gap-3">
                <span>Cumulative Savings</span>
                <span className="font-bold text-white">{formatINR(hoveredYr.cumulativeNetInr)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>{hoveredYr.yearOffset === 0 ? 'Confirmed Harvest' : 'Est. Annual Solar Harvest'}</span>
                <span className="text-sky-300">{hoveredYr.annualYieldKwh.toLocaleString('en-IN')} kWh</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>
                  {hoveredYr.cumulativeNetInr >= hoveredYr.capexTargetInr ? 'Net Asset Profit' : 'Remaining Investment'}
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

      {/* Payback Milestones Bar: Dedicated EXCLUSIVELY to Investment Payback */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/75 border-t border-slate-200/75 bg-slate-50/40 mt-4">
        {payback.milestones.map((m) => (
          <div key={m.pctTarget} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                {m.pctTarget === 100 ? 'Fully Paid Off' : `${m.pctTarget}% Paid Off`}
              </div>
              <div className="text-[12.5px] font-extrabold text-slate-900 tabular-nums mt-0.5">
                {formatINR(m.targetInr)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className={`text-[11.5px] font-bold tabular-nums ${
                  m.achieved ? 'text-emerald-700' : 'text-slate-700'
                }`}
              >
                {m.achieved ? 'Achieved' : m.projectedLabel}
              </div>
              <div className="text-[10px] font-medium text-slate-400 tabular-nums">
                {m.achieved ? 'Unlocked' : m.monthsFromNow > 0 ? `+${m.monthsFromNow} mo` : '>25 yrs'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
