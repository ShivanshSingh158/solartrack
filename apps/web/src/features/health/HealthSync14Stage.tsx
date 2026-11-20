import React from 'react';
import { HardDrive, Wifi, CheckCircle2, AlertCircle } from 'lucide-react';
import type { CanonicalSolarSnapshot, SyncHealthDayItem, SystemHealthReport } from '@solar-track/core';
import { CloudOutageLedgerCard } from './HealthFooterLedgers';

interface HealthSync14StageProps {
  report: SystemHealthReport;
  canonicalSnapshot: CanonicalSolarSnapshot;
  todayYmd: string;
  boxWidth: number;
  hoveredSyncIdx: number | null;
  onHoverSyncIdx: (idx: number | null) => void;
  onInspectDayInPerformance: (ymd: string) => void;
  lastUpdateDate: string;
  syncMeta: {
    syncedAtIstLabel: string;
    sseConnected: boolean;
    nextPollInSec: number;
    inBackoff: boolean;
    backoffRemainingSec: number;
  };
}

function getSyncBarColor(day: SyncHealthDayItem, todayYmd: string): string {
  if (day.ymd === todayYmd && day.isConfirmed) return '#10B981';
  if (day.dipCategory === 'WIFI_OUTAGE_UNLOGGED' || (!day.isConfirmed && day.ymd < todayYmd)) return '#F43F5E';
  if (!day.isConfirmed) return '#F59E0B';
  if (day.dipCategory === 'OUTAGE_GAP') return '#F43F5E';
  if (day.coveragePct >= 85) return '#10B981';
  if (day.coveragePct >= 65) return '#0284C7';
  return '#F59E0B';
}

/**
 * 14-day datalogger packet delivery and Wi-Fi outage audit stage.
 */
export const HealthSync14Stage: React.FC<HealthSync14StageProps> = ({
  report,
  canonicalSnapshot,
  todayYmd,
  boxWidth,
  hoveredSyncIdx,
  onHoverSyncIdx,
  onInspectDayInPerformance,
  lastUpdateDate,
  syncMeta,
}) => {
  const { syncDays14, pendingEepromDays, unloggedOutageDays, logger } = report;

  const isCompact = boxWidth < 520;
  const svgW = Math.max(300, boxWidth);
  const svgH = isCompact ? 230 : 260;
  const padL = isCompact ? 40 : 50;
  const padR = isCompact ? 24 : 32;
  const padT = 20;
  const padB = 32;
  const plotW = Math.max(80, svgW - padL - padR);
  const plotH = Math.max(80, svgH - padT - padB);

  const count = Math.max(1, syncDays14.length);
  const colW = plotW / count;
  const barW = Math.max(10, Math.min(26, colW * 0.58));
  const barRx = Math.min(barW / 2, 6);
  const hoveredSync = hoveredSyncIdx !== null ? syncDays14[hoveredSyncIdx] ?? null : null;

  const confirmedDaysCount = syncDays14.filter((d) => d.isConfirmed).length;

  return (
    <div className="px-4 sm:px-6 pt-3 pb-4">
      {/* Top 3-Card Apple Connection Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3.5 rounded-2xl bg-white/95 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
              Connection Reliability
            </div>
            <div className="text-[20px] font-extrabold text-slate-900 tabular-nums">
              {logger.rawDeliveryPct !== null ? `${logger.rawDeliveryPct}%` : '100%'}
            </div>
            <div className="text-[11px] font-medium text-emerald-700 truncate">
              {logger.expectedSlots > 0
                ? `${logger.rawReceivedSlots}/${logger.expectedSlots} packets received today`
                : 'Active live telemetry stream'}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/95 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
              14-Day Sync Uptime
            </div>
            <div className="text-[20px] font-extrabold text-slate-900 tabular-nums">
              {confirmedDaysCount} of {syncDays14.length} Days
            </div>
            <div className="text-[11px] font-medium text-slate-500 truncate">
              {Math.round((confirmedDaysCount / Math.max(1, syncDays14.length)) * 100)}% verified archive coverage
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/95 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
              Wi-Fi Outages
            </div>
            <div className="text-[20px] font-extrabold text-slate-900 tabular-nums">
              {unloggedOutageDays.length === 0 ? '0 Days' : `${unloggedOutageDays.length} Day Offline`}
            </div>
            <div className="text-[11px] font-medium text-slate-500 truncate">
              {unloggedOutageDays.length > 0
                ? `${unloggedOutageDays[0]?.shortLabel} unlogged`
                : 'Zero data drops recorded'}
            </div>
          </div>
        </div>
      </div>

      {/* Legend & Hint */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-[11px] font-medium text-slate-500">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Verified Online (≥85%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            Partial Sync
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Today Live In Progress
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            Wi-Fi Outage
          </span>
        </div>
        <span className="text-[10.5px] font-semibold text-slate-400">
          Click any day to open 5-minute performance curve
        </span>
      </div>

      {/* 14-Day Apple Capsule Bar Chart */}
      <div className="relative w-full select-none">
        {syncDays14.length === 0 ? (
          <div className="h-[230px] flex items-center justify-center text-xs font-semibold text-slate-400">
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
                    stroke={pct === 0 ? '#CBD5E1' : '#F1F5F9'}
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
              const valPct = Math.min(100, Math.max(6, d.coveragePct));
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
                  {/* Subtle column hover highlight */}
                  <rect
                    x={padL + i * colW}
                    y={padT}
                    width={colW}
                    height={plotH}
                    fill={isHovered ? '#F8FAFC' : 'transparent'}
                    rx={4}
                  />

                  {/* Benchmark potential track */}
                  <rect
                    x={x}
                    y={padT}
                    width={barW}
                    height={plotH}
                    rx={barRx}
                    fill={isHovered ? '#E2E8F0' : '#F1F5F9'}
                    className="transition-colors duration-150"
                  />

                  {/* Rounded capsule bar */}
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(barW, bh)}
                    rx={barRx}
                    fill={color}
                    opacity={isHovered ? 1 : 0.92}
                  />

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

        {/* Hover inspector tooltip */}
        {hoveredSync && hoveredSyncIdx !== null && (
          <div
            className="pointer-events-none absolute top-2 z-20 rounded-xl bg-slate-900/95 text-white px-3 py-2 shadow-xl text-[11px] min-w-[205px] backdrop-blur-md"
            style={{
              left: Math.min(
                Math.max(8, padL + (hoveredSyncIdx + 0.5) * colW - 102),
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
                ? `Confirmed: ${hoveredSync.realKwh.toFixed(1)} kWh (Target ~${hoveredSync.modeledKwh.toFixed(1)} kWh)`
                : hoveredSync.dipCategory === 'WIFI_OUTAGE_UNLOGGED'
                  ? `Wi-Fi Offline All Day · Target ~${hoveredSync.modeledKwh.toFixed(1)} kWh`
                  : `Live today · Target ~${hoveredSync.modeledKwh.toFixed(1)} kWh`}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Click to inspect 5-minute curve</div>
          </div>
        )}
      </div>

      {/* Outage notification pill if any day missed */}
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

      {/* Embedded Cloud Outage & Logger Sync Ledger */}
      <div className="mt-5">
        <CloudOutageLedgerCard
          report={report}
          canonicalSnapshot={canonicalSnapshot}
          lastUpdateDate={lastUpdateDate}
          syncMeta={syncMeta}
          onInspectDayInPerformance={onInspectDayInPerformance}
        />
      </div>
    </div>
  );
};
