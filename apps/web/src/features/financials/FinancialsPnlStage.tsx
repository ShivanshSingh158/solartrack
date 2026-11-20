import React, { useMemo } from 'react';
import {
  formatINR,
  type ReconciledCashPnlDay,
  type ReconciledCashPnlSummary,
} from '@solar-track/core';

interface FinancialsPnlStageProps {
  pnlSummary: ReconciledCashPnlSummary;
  boxWidth: number;
  hoveredDayIdx: number | null;
  onHoverDayIdx: (idx: number | null) => void;
}

/**
 * Reconciled Monthly Cash Flow view: Clean Apple capsule bars showing
 * Earned Solar Value on daylight potential tracks, with harmonious
 * attribution breakdown (Weather, Soiling, Pending Sync).
 */
export const FinancialsPnlStage: React.FC<FinancialsPnlStageProps> = ({
  pnlSummary,
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

  // Guarantee strict chronological ascending date ordering
  const rows: ReconciledCashPnlDay[] = useMemo(() => {
    return [...pnlSummary.dailyRows].sort((a, b) => a.ymd.localeCompare(b.ymd));
  }, [pnlSummary.dailyRows]);

  const count = Math.max(1, rows.length);
  const colW = plotW / count;
  const barW = Math.max(6, Math.min(26, colW * 0.58));
  const maxY = Math.max(20, ...rows.map((r) => r.idealPotentialInr), 100);
  const hoveredRow = hoveredDayIdx !== null ? rows[hoveredDayIdx] ?? null : null;

  return (
    <div className="px-4 sm:px-6 pt-3 pb-4">
      {/* Reconciled Value Progress Capsule */}
      <div className="pb-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-[#107C41]" />
              Earned {formatINR(pnlSummary.earnedInr)} ({pnlSummary.earnedPct}%)
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              Weather Dip -{formatINR(pnlSummary.weatherDipInr)} ({pnlSummary.weatherDipPct}%)
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Dust/Haze -{formatINR(pnlSummary.soilLossInr)} ({pnlSummary.soilLossPct}%)
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              Pending Sync -{formatINR(pnlSummary.pendingOutageInr)} ({pnlSummary.pendingOutagePct}%)
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-900 tabular-nums">
            Clear-Sky Potential: {formatINR(pnlSummary.idealPotentialInr)}
          </span>
        </div>

        <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-100 shadow-2xs">
          {pnlSummary.earnedPct > 0 && (
            <div style={{ width: `${pnlSummary.earnedPct}%` }} className="bg-[#107C41] transition-all" />
          )}
          {pnlSummary.weatherDipPct > 0 && (
            <div style={{ width: `${pnlSummary.weatherDipPct}%` }} className="bg-sky-500 transition-all" />
          )}
          {pnlSummary.soilLossPct > 0 && (
            <div style={{ width: `${pnlSummary.soilLossPct}%` }} className="bg-amber-500 transition-all" />
          )}
          {pnlSummary.pendingOutagePct > 0 && (
            <div style={{ width: `${pnlSummary.pendingOutagePct}%` }} className="bg-slate-400 transition-all" />
          )}
        </div>
      </div>

      <div className="relative w-full select-none">
        {rows.length === 0 ? (
          <div className="h-[225px] flex items-center justify-center text-xs font-semibold text-slate-400">
            Syncing daily cash attribution ledger...
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

            {rows.map((r, i) => {
              const cx = padL + (i + 0.5) * colW;
              const x = cx - barW / 2;
              const hIdeal = Math.max(4, (r.idealPotentialInr / maxY) * plotH);
              const hEarned = Math.max(0, (r.earnedInr / maxY) * plotH);
              const yIdeal = padT + plotH - hIdeal;
              const yEarned = padT + plotH - hEarned;

              const isHovered = hoveredDayIdx === i;
              const showTick = !isCompact || i % 2 === 0 || i === rows.length - 1;
              const radius = Math.min(5, barW / 2);

              return (
                <g key={r.ymd} className="cursor-pointer" onMouseEnter={() => onHoverDayIdx(i)}>
                  {/* Apple subtle hover highlight column */}
                  {isHovered && (
                    <rect
                      x={padL + i * colW + 1}
                      y={padT}
                      width={colW - 2}
                      height={plotH}
                      fill="#F1F5F9"
                      rx={6}
                    />
                  )}

                  {/* Clean Background Track: Full Daylight Potential */}
                  <rect
                    x={x}
                    y={yIdeal}
                    width={barW}
                    height={hIdeal}
                    rx={radius}
                    fill="#E2E8F0"
                    fillOpacity={0.65}
                  />

                  {/* Clean Foreground Capsule: Actual Earned Solar Value */}
                  {hEarned > 0.5 && (
                    <rect
                      x={x}
                      y={yEarned}
                      width={barW}
                      height={hEarned}
                      rx={radius}
                      fill="#107C41"
                      fillOpacity={0.92}
                    />
                  )}

                  {/* Natural ascending day tick */}
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

        {hoveredRow && hoveredDayIdx !== null && (
          <div
            className="pointer-events-none absolute top-2 z-20 rounded-xl bg-slate-900/95 text-white px-3.5 py-2.5 shadow-xl text-[11px] min-w-[225px]"
            style={{
              left: Math.min(
                Math.max(8, padL + (hoveredDayIdx + 0.5) * (plotW / Math.max(1, rows.length)) - 112),
                Math.max(8, svgW - 240),
              ),
            }}
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>{hoveredRow.shortLabel}</span>
              <span className="text-emerald-300 tabular-nums">
                {Math.round((hoveredRow.earnedInr / Math.max(1, hoveredRow.idealPotentialInr)) * 100)}% realized
              </span>
            </div>
            <div className="text-slate-200 mt-1.5 space-y-1 tabular-nums">
              <div className="flex items-center justify-between gap-2">
                <span className="text-emerald-300 font-medium">Earned Savings</span>
                <span className="font-bold text-white">
                  {formatINR(hoveredRow.earnedInr)} ({hoveredRow.realKwh?.toFixed(1) ?? '0.0'} kWh)
                </span>
              </div>
              {hoveredRow.weatherDipInr > 0 && (
                <div className="flex items-center justify-between gap-2 text-sky-300">
                  <span>Weather Cloud Dip</span>
                  <span>-{formatINR(hoveredRow.weatherDipInr)}</span>
                </div>
              )}
              {hoveredRow.soilLossInr > 0 && (
                <div className="flex items-center justify-between gap-2 text-amber-300">
                  <span>Dust & Soiling Dip</span>
                  <span>-{formatINR(hoveredRow.soilLossInr)}</span>
                </div>
              )}
              {hoveredRow.pendingOutageInr > 0 && (
                <div className="flex items-center justify-between gap-2 text-slate-300">
                  <span>Pending / Delay Dip</span>
                  <span>-{formatINR(hoveredRow.pendingOutageInr)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-slate-400 font-medium">
                <span>Clear-Sky Potential</span>
                <span>{formatINR(hoveredRow.idealPotentialInr)}</span>
              </div>
            </div>
            {hoveredRow.dipReasonLabel && (
              <div className="text-[10px] text-slate-400 mt-1">{hoveredRow.dipReasonLabel}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
