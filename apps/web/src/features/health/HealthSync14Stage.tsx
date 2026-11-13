import React from 'react';
import { HardDrive } from 'lucide-react';
import type { SyncHealthDayItem, SystemHealthReport } from '@solar-track/core';

interface HealthSync14StageProps {
  report: SystemHealthReport;
  todayYmd: string;
  boxWidth: number;
  hoveredSyncIdx: number | null;
  onHoverSyncIdx: (idx: number | null) => void;
  onInspectDayInPerformance: (ymd: string) => void;
}

function getSyncBarColor(day: SyncHealthDayItem, todayYmd: string): string {
  if (day.ymd === todayYmd && day.isConfirmed) return '#107C41';
  if (day.dipCategory === 'WIFI_OUTAGE_UNLOGGED' || (!day.isConfirmed && day.ymd < todayYmd)) return '#E11D48';
  if (!day.isConfirmed) return '#F59E0B';
  if (day.dipCategory === 'OUTAGE_GAP') return '#E11D48';
  if (day.coveragePct >= 85) return '#107C41';
  if (day.coveragePct >= 65) return '#0284C7';
  return '#F59E0B';
}

/**
 * 14-day datalogger packet delivery and unlogged Wi-Fi outage bar chart.
 */
export const HealthSync14Stage: React.FC<HealthSync14StageProps> = ({
  report,
  todayYmd,
  boxWidth,
  hoveredSyncIdx,
  onHoverSyncIdx,
  onInspectDayInPerformance,
}) => {
  const { syncDays14, pendingEepromDays, unloggedOutageDays } = report;

  const isCompact = boxWidth < 520;
  const svgW = Math.max(300, boxWidth);
  const svgH = isCompact ? 255 : 295;
  const padL = isCompact ? 38 : 48;
  const padR = isCompact ? 16 : 24;
  const padT = 22;
  const padB = 34;
  const plotW = Math.max(80, svgW - padL - padR);
  const plotH = Math.max(80, svgH - padT - padB);

  const count = Math.max(1, syncDays14.length);
  const colW = plotW / count;
  const barW = Math.max(8, Math.min(28, colW * 0.62));
  const hoveredSync = hoveredSyncIdx !== null ? syncDays14[hoveredSyncIdx] ?? null : null;

  return (
    <div className="px-4 sm:px-6 pt-3 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px] font-medium text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#107C41]" /> Confirmed Online (≥85%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-sky-600" /> Cloud / Partial Sync
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> Pending Sync (&lt;00:00 IST)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" /> Unlogged Outage / Drop
          </span>
        </div>
        <span className="text-[10.5px] font-semibold text-slate-400">
          Click any day bar to open 5-min curve in Performance
        </span>
      </div>

      <div className="relative w-full select-none">
        {syncDays14.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-xs font-semibold text-slate-400">
            Syncing 14-day logger coverage ledger...
          </div>
        ) : (
          <svg
            width={svgW}
            height={svgH}
            className="block overflow-visible"
            onMouseLeave={() => onHoverSyncIdx(null)}
          >
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = padT + plotH - (pct / 100) * plotH;
              return (
                <g key={pct}>
                  <line
                    x1={padL}
                    x2={padL + plotW}
                    y1={y}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray={pct === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padL - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px] font-semibold tabular-nums"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {syncDays14.map((d, i) => {
              const cx = padL + (i + 0.5) * colW;
              const x = cx - barW / 2;
              const valPct = Math.min(100, Math.max(4, d.coveragePct));
              const bh = (valPct / 100) * plotH;
              const y = padT + plotH - bh;
              const color = getSyncBarColor(d, todayYmd);
              const isHovered = hoveredSyncIdx === i;
              const showTick = !isCompact || i % 2 === 0 || i === syncDays14.length - 1;

              return (
                <g
                  key={d.ymd}
                  data-sync-day={d.ymd}
                  className="cursor-pointer"
                  onMouseEnter={() => onHoverSyncIdx(i)}
                  onClick={() => onInspectDayInPerformance(d.ymd)}
                >
                  {isHovered && (
                    <rect
                      x={padL + i * colW}
                      y={padT}
                      width={colW}
                      height={plotH}
                      fill="#F1F5F9"
                      rx={4}
                    />
                  )}
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(4, bh)}
                    rx={4}
                    fill={color}
                    fillOpacity={d.isConfirmed ? 0.92 : 0.72}
                    stroke={isHovered ? '#0F172A' : undefined}
                    strokeWidth={isHovered ? 1.2 : 0}
                  />
                  {!d.isConfirmed && d.ymd < todayYmd && (
                    <circle cx={cx} cy={Math.max(padT + 4, y - 6)} r={2.5} fill="#F59E0B" />
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
                      {d.shortLabel.replace(/^[A-Za-z]+ /, '')}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {hoveredSync && hoveredSyncIdx !== null && (
          <div
            className="pointer-events-none absolute top-2 z-20 rounded-xl bg-slate-900/95 text-white px-3 py-2 shadow-xl text-[11px] min-w-[205px]"
            style={{
              left: Math.min(
                Math.max(8, padL + (hoveredSyncIdx + 0.5) * (plotW / Math.max(1, syncDays14.length)) - 102),
                Math.max(8, svgW - 220),
              ),
            }}
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <span>{hoveredSync.shortLabel}</span>
              <span className="tabular-nums text-emerald-300">{hoveredSync.coveragePct}% delivery</span>
            </div>
            <div className="text-slate-300 mt-1 tabular-nums">
              {hoveredSync.isConfirmed && hoveredSync.realKwh !== null
                ? `Confirmed: ${hoveredSync.realKwh.toFixed(1)} kWh (Model ~${hoveredSync.modeledKwh.toFixed(1)} kWh)`
                : hoveredSync.dipCategory === 'WIFI_OUTAGE_UNLOGGED'
                  ? `Wi-Fi Offline All Day (Missed by Cloud) · Twin Est. ~${hoveredSync.modeledKwh.toFixed(1)} kWh`
                  : `Awaiting Wi-Fi sync before 00:00 IST · Est. ~${hoveredSync.modeledKwh.toFixed(1)} kWh`}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{hoveredSync.eventLabel} · Click to inspect</div>
          </div>
        )}
      </div>

      {(unloggedOutageDays.length > 0 || pendingEepromDays.length > 0) && (
        <div className="mt-2 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span
            className={`inline-flex items-center gap-1.5 font-semibold ${
              unloggedOutageDays.length > 0 ? 'text-rose-700' : 'text-amber-700'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            {unloggedOutageDays.length > 0
              ? `Unlogged Wi-Fi Outage Days (${unloggedOutageDays.length}d):`
              : `Awaiting Pre-Midnight Sync (${pendingEepromDays.length}d):`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {[...unloggedOutageDays, ...pendingEepromDays].map((d) => (
              <button
                key={d.ymd}
                type="button"
                onClick={() => onInspectDayInPerformance(d.ymd)}
                className="text-[11px] font-bold text-slate-700 hover:text-emerald-700 underline decoration-slate-300 cursor-pointer tabular-nums"
              >
                {d.shortLabel} (~{d.modeledAfterSoilingKwh.toFixed(1)} kWh)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
