import React from 'react';
import {
  formatINR,
  type DiscomCycleBreakdown,
  type ReconciledCashPnlDay,
  type ReconciledCashPnlSummary,
} from '@solar-track/core';

interface FinancialsCycleStageProps {
  discom: DiscomCycleBreakdown;
  cyclePnlSummary: ReconciledCashPnlSummary;
  boxWidth: number;
  hoveredDayIdx: number | null;
  onHoverDayIdx: (idx: number | null) => void;
}

/**
 * DISCOM Cycle billing view: Confirmed vs Pending Sync breakdown,
 * cycle projection bar, and daily billing credits.
 */
export const FinancialsCycleStage: React.FC<FinancialsCycleStageProps> = ({
  discom,
  cyclePnlSummary,
  boxWidth,
  hoveredDayIdx,
  onHoverDayIdx,
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

  const cycleRows: ReconciledCashPnlDay[] = cyclePnlSummary.dailyRows;
  const count = Math.max(1, cycleRows.length);
  const colW = plotW / count;
  const barW = Math.max(6, Math.min(30, colW * 0.62));
  const maxY = Math.max(
    20,
    ...cycleRows.map((r) => Math.max(r.earnedInr + r.pendingOutageInr, r.idealPotentialInr * 0.9)),
    80,
  );
  const hoveredCycle = hoveredDayIdx !== null ? cycleRows[hoveredDayIdx] ?? null : null;

  const projTarget = Math.max(1, discom.projectedCycleInr, discom.accruedPlusPendingInr);
  const confBarPct = Math.min(100, (discom.confirmedInr / projTarget) * 100);
  const pendBarPct = Math.min(100 - confBarPct, (discom.pendingInr / projTarget) * 100);

  return (
    <div className="px-4 sm:px-6 pt-3 pb-4">
      <div className="pb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#107C41]" />
              Confirmed Credit:{' '}
              <strong className="text-slate-900 tabular-nums">{discom.confirmedFormatted}</strong> (
              {discom.confirmedUnitsKwh.toFixed(1)} kWh)
            </span>
            {discom.pendingInr > 0 && (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                Pending Sync / Live Est.:{' '}
                <strong className="tabular-nums">+{formatINR(discom.pendingInr)}</strong> (
                {discom.pendingUnitsKwh.toFixed(1)} kWh)
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold text-slate-900 tabular-nums">
            {discom.cyclePeriodText} · Cycle Proj: {formatINR(discom.projectedCycleInr)}
          </span>
        </div>

        <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100">
          {confBarPct > 0 && <div style={{ width: `${confBarPct}%` }} className="bg-[#107C41]" />}
          {pendBarPct > 0 && <div style={{ width: `${pendBarPct}%` }} className="bg-amber-400" />}
        </div>
      </div>

      <div className="relative w-full select-none">
        {cycleRows.length === 0 ? (
          <div className="h-[225px] flex items-center justify-center text-xs font-semibold text-slate-400">
            Awaiting billing cycle telemetry for {discom.cyclePeriodText}...
          </div>
        ) : (
          <svg width={svgW} height={svgH} className="block overflow-visible" onMouseLeave={() => onHoverDayIdx(null)}>
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const y = padT + plotH - frac * plotH;
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
                    ₹{Math.round(maxY * frac)}
                  </text>
                </g>
              );
            })}

            {cycleRows.map((r, i) => {
              const cx = padL + (i + 0.5) * colW;
              const x = cx - barW / 2;
              const confInr = Math.max(0, r.earnedInr);
              const pendInr = Math.max(0, r.pendingOutageInr);
              const confH = confInr > 0 ? Math.min(plotH, Math.max(3, (confInr / maxY) * plotH)) : 0;
              const confY = padT + plotH - confH;
              const pendH = pendInr > 0 ? Math.min(plotH - confH, Math.max(2, (pendInr / maxY) * plotH)) : 0;
              const pendY = confY - pendH;
              const isHovered = hoveredDayIdx === i;
              const showTick = !isCompact || i % 2 === 0 || i === cycleRows.length - 1;

              return (
                <g key={r.ymd} className="cursor-pointer" onMouseEnter={() => onHoverDayIdx(i)}>
                  {isHovered && (
                    <rect x={padL + i * colW} y={padT} width={colW} height={plotH} fill="#F1F5F9" rx={4} />
                  )}
                  {confH > 0 && (
                    <rect
                      x={x}
                      y={confY}
                      width={barW}
                      height={confH}
                      rx={pendH > 0 ? 1 : 4}
                      fill="#107C41"
                      fillOpacity={0.92}
                    />
                  )}
                  {pendH > 0 && (
                    <rect
                      x={x}
                      y={pendY}
                      width={barW}
                      height={pendH}
                      rx={confH > 0 ? 1 : 4}
                      fill="#F59E0B"
                      fillOpacity={0.85}
                    />
                  )}
                  {confH === 0 && pendH === 0 && (
                    <rect
                      x={x}
                      y={padT + plotH - 3}
                      width={barW}
                      height={3}
                      rx={1.5}
                      fill="#E2E8F0"
                    />
                  )}
                  {showTick && (
                    <text
                      x={cx}
                      y={padT + plotH + 16}
                      textAnchor="middle"
                      className={`text-[9.5px] font-semibold tabular-nums ${
                        isHovered ? 'fill-slate-900 font-bold' : 'fill-slate-400'
                      }`}
                    >
                      {r.shortLabel.replace(/^[A-Za-z]+ /, '')}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {hoveredCycle && hoveredDayIdx !== null && (
          <div
            className="pointer-events-none absolute top-2 z-20 rounded-xl bg-slate-900/95 text-white px-3 py-2 shadow-xl text-[11px] min-w-[215px]"
            style={{
              left: Math.min(
                Math.max(8, padL + (hoveredDayIdx + 0.5) * (plotW / Math.max(1, cycleRows.length)) - 107),
                Math.max(8, svgW - 230),
              ),
            }}
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>{hoveredCycle.shortLabel}</span>
              <span
                className={
                  hoveredCycle.pendingOutageInr > 0.5
                    ? 'text-amber-300'
                    : hoveredCycle.isConfirmed
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                }
              >
                {hoveredCycle.isConfirmed && hoveredCycle.pendingOutageInr > 0.5
                  ? 'Cloud + Buffer'
                  : hoveredCycle.isConfirmed
                    ? 'Confirmed'
                    : 'Pending Sync'}
              </span>
            </div>
            <div className="text-slate-200 mt-1 space-y-0.5 tabular-nums">
              {hoveredCycle.earnedInr > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-300">Cloud Logged</span>
                  <span className="font-semibold">
                    {formatINR(hoveredCycle.earnedInr)} ({hoveredCycle.realKwh?.toFixed(2) ?? '0.00'} kWh)
                  </span>
                </div>
              )}
              {hoveredCycle.pendingOutageInr > 0.5 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-300">Outage / Live Buffer</span>
                  <span className="font-semibold">+{formatINR(hoveredCycle.pendingOutageInr)}</span>
                </div>
              )}
              {hoveredCycle.earnedInr > 0 && hoveredCycle.pendingOutageInr > 0.5 && (
                <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-white/10 font-bold text-white">
                  <span>Reconciled Total</span>
                  <span>{formatINR(hoveredCycle.earnedInr + hoveredCycle.pendingOutageInr)}</span>
                </div>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{hoveredCycle.dipReasonLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
};
