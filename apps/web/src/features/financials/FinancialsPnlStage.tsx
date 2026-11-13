import React from 'react';
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
 * 100% Reconciled Monthly Cash P&L revenue bridge view:
 * Earned cash + Weather dip + Soiling & haze loss + Pending sync / Wi-Fi outage.
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

  const rows: ReconciledCashPnlDay[] = pnlSummary.dailyRows;
  const count = Math.max(1, rows.length);
  const colW = plotW / count;
  const barW = Math.max(6, Math.min(28, colW * 0.65));
  const maxY = Math.max(20, ...rows.map((r) => r.idealPotentialInr), 100);
  const hoveredRow = hoveredDayIdx !== null ? rows[hoveredDayIdx] ?? null : null;

  return (
    <div className="px-4 sm:px-6 pt-3 pb-4">
      {/* Strict 100% Reconciled Stacked Summary Bar */}
      <div className="pb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#107C41]" />
              Earned {formatINR(pnlSummary.earnedInr)} ({pnlSummary.earnedPct}%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-sky-500" />
              Weather Dip {formatINR(pnlSummary.weatherDipInr)} ({pnlSummary.weatherDipPct}%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
              Soiling/Haze {formatINR(pnlSummary.soilLossInr)} ({pnlSummary.soilLossPct}%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
              Pending/Gap {formatINR(pnlSummary.pendingOutageInr)} ({pnlSummary.pendingOutagePct}%)
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-900 tabular-nums">
            100% Clear-Sky Potential: {formatINR(pnlSummary.idealPotentialInr)}
          </span>
        </div>

        <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100">
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
            <div style={{ width: `${pnlSummary.pendingOutagePct}%` }} className="bg-rose-500 transition-all" />
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
              const hEarned = (r.earnedInr / maxY) * plotH;
              const hWeather = (r.weatherDipInr / maxY) * plotH;
              const hSoil = (r.soilLossInr / maxY) * plotH;
              const hPend = (r.pendingOutageInr / maxY) * plotH;

              let curY = padT + plotH;
              const yEarned = curY - hEarned;
              curY = yEarned;
              const yWeather = curY - hWeather;
              curY = yWeather;
              const ySoil = curY - hSoil;
              curY = ySoil;
              const yPend = curY - hPend;

              const isHovered = hoveredDayIdx === i;
              const showTick = !isCompact || i % 2 === 0 || i === rows.length - 1;

              return (
                <g key={r.ymd} className="cursor-pointer" onMouseEnter={() => onHoverDayIdx(i)}>
                  {isHovered && (
                    <rect x={padL + i * colW} y={padT} width={colW} height={plotH} fill="#F1F5F9" rx={4} />
                  )}
                  {hEarned > 0.5 && (
                    <rect x={x} y={yEarned} width={barW} height={hEarned} fill="#107C41" rx={1} />
                  )}
                  {hWeather > 0.5 && <rect x={x} y={yWeather} width={barW} height={hWeather} fill="#0EA5E9" />}
                  {hSoil > 0.5 && <rect x={x} y={ySoil} width={barW} height={hSoil} fill="#F59E0B" />}
                  {hPend > 0.5 && <rect x={x} y={yPend} width={barW} height={hPend} fill="#F43F5E" rx={1} />}

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
            className="pointer-events-none absolute top-2 z-20 rounded-xl bg-slate-900/95 text-white px-3 py-2 shadow-xl text-[11px] min-w-[220px]"
            style={{
              left: Math.min(
                Math.max(8, padL + (hoveredDayIdx + 0.5) * (plotW / Math.max(1, rows.length)) - 110),
                Math.max(8, svgW - 235),
              ),
            }}
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>{hoveredRow.shortLabel}</span>
              <span className="tabular-nums text-emerald-300">Ideal {formatINR(hoveredRow.idealPotentialInr)}</span>
            </div>
            <div className="mt-1 space-y-0.5 text-slate-300 tabular-nums">
              <div className="flex justify-between">
                <span>Earned ({hoveredRow.isConfirmed ? 'Confirmed' : 'Live'})</span>
                <span className="font-bold text-emerald-300">{formatINR(hoveredRow.earnedInr)}</span>
              </div>
              <div className="flex justify-between">
                <span>Weather Dip</span>
                <span className="text-sky-300">{formatINR(hoveredRow.weatherDipInr)}</span>
              </div>
              <div className="flex justify-between">
                <span>Soiling & Haze</span>
                <span className="text-amber-300">{formatINR(hoveredRow.soilLossInr)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending / Outage</span>
                <span className="text-rose-300">{formatINR(hoveredRow.pendingOutageInr)}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{hoveredRow.dipReasonLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
};
