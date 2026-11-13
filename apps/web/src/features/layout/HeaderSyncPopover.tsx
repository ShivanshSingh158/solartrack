import React, { useEffect, useState } from 'react';
import { Bell, BellRing, MapPin, RotateCw } from 'lucide-react';
import type { NewWaareePacketEvent } from '@solar-track/core';

export interface SyncMetaBarInfo {
  syncedAtIso?: string;
  syncedAtIstLabel: string;
  sseConnected: boolean;
  nextPollInSec: number;
  inBackoff: boolean;
  backoffRemainingSec: number;
}

interface HeaderSyncPopoverProps {
  syncRef: React.RefObject<HTMLDivElement | null>;
  isSyncOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  plantName: string;
  capacityText: string;
  locationName: string;
  lastUpdateText: string;
  syncStatusText?: string;
  syncMeta: SyncMetaBarInfo | null;
  isRefreshing: boolean;
  isGenerating: boolean;
  isNight: boolean;
  alertsEnabled: boolean;
  latestNewData: NewWaareePacketEvent | null;
  onRefresh: () => void;
  onToggleAlerts?: () => void;
  onOpenLocationEdit?: () => void;
}

export const HeaderSyncPopover: React.FC<HeaderSyncPopoverProps> = ({
  syncRef,
  isSyncOpen,
  onToggleOpen,
  onClose,
  plantName,
  capacityText,
  locationName,
  lastUpdateText,
  syncStatusText,
  syncMeta,
  isRefreshing,
  isGenerating,
  isNight,
  alertsEnabled,
  latestNewData,
  onRefresh,
  onToggleAlerts,
  onOpenLocationEdit,
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!syncMeta?.syncedAtIso || (!isSyncOpen && !syncMeta?.inBackoff)) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [syncMeta?.syncedAtIso, isSyncOpen, syncMeta?.inBackoff]);

  const syncedMs = syncMeta?.syncedAtIso ? Date.parse(syncMeta.syncedAtIso) : NaN;
  const elapsedSec = Number.isFinite(syncedMs) ? Math.max(0, Math.floor((nowMs - syncedMs) / 1000)) : 0;
  const interval = Math.max(15, syncMeta?.nextPollInSec || 65);
  const nextIn = Math.max(0, interval - (elapsedSec % interval));
  const remBackoff = syncMeta?.inBackoff ? Math.max(0, (syncMeta.backoffRemainingSec || 0) - elapsedSec) : 0;
  const backoffMins = Math.floor(remBackoff / 60);
  const backoffSecs = remBackoff % 60;

  const calmSyncTime = syncMeta?.syncedAtIstLabel
    ? syncMeta.syncedAtIstLabel.replace(/:\d{2}(\s+(?:AM|PM))(?:\s+IST)?$/i, '$1').trim()
    : '';
  const compactLastSeen = (lastUpdateText || 'Awaiting cloud check').trim();

  const syncPrimaryLabel = (() => {
    if (isRefreshing) return 'Syncing';
    if (syncMeta?.inBackoff) {
      return `Cooldown · ${backoffMins}m ${String(backoffSecs).padStart(2, '0')}s`;
    }
    if (isGenerating) return calmSyncTime ? `Inverter Live · ${calmSyncTime}` : 'Inverter Live';
    if (isNight) return calmSyncTime ? `Night Standby · ${calmSyncTime}` : 'Night Standby';
    return calmSyncTime ? `Cloud Sync · ${calmSyncTime}` : 'Cloud Sync';
  })();

  const syncMobileLabel = (() => {
    if (isRefreshing) return 'Syncing';
    if (syncMeta?.inBackoff) return 'Cooldown';
    if (isGenerating) return 'Live';
    if (isNight) return 'Standby';
    return 'Cloud Sync';
  })();

  return (
    <div className="relative" ref={syncRef}>
      <div
        className={`inline-flex items-center h-8 rounded-full border transition-all ${
          isGenerating
            ? 'border-emerald-300/80 bg-emerald-500/10 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_rgba(16,185,129,0.12)] backdrop-blur-md'
            : isNight
              ? 'border-slate-200/80 bg-slate-100/70 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md'
              : 'border-slate-200/80 bg-white/70 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setNowMs(Date.now());
            onToggleOpen();
          }}
          aria-expanded={isSyncOpen}
          aria-haspopup="dialog"
          className="flex items-center gap-2 h-full pl-3 pr-2.5 rounded-l-full text-[11.5px] font-medium tracking-tight hover:bg-black/[0.03] transition-colors cursor-pointer whitespace-nowrap"
          title={syncStatusText || 'Telemetry & Sync Details'}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isRefreshing
                ? 'bg-sky-500 animate-ping'
                : syncMeta?.inBackoff
                  ? 'bg-amber-500 ring-2 ring-amber-400/30'
                  : isGenerating
                    ? 'bg-emerald-500 shadow-[0_0_8px_#10B981] animate-pulse ring-2 ring-emerald-400/30'
                    : isNight
                      ? 'bg-slate-400 ring-1 ring-slate-300'
                      : 'bg-amber-500 ring-2 ring-amber-400/30'
            }`}
          />
          <span className="hidden sm:inline tabular-nums font-semibold">{syncPrimaryLabel}</span>
          <span className="sm:hidden tabular-nums font-semibold">{syncMobileLabel}</span>
        </button>

        <span aria-hidden="true" className="w-px h-3.5 bg-slate-300/60 shrink-0" />

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Sync Weather and Waaree Telemetry"
          className="flex items-center justify-center h-full pl-2 pr-2.5 rounded-r-full text-slate-500 hover:text-slate-900 hover:bg-black/[0.03] transition-colors cursor-pointer disabled:opacity-50"
          title="Sync Weather + Waaree now"
        >
          <RotateCw
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-600' : ''}`}
            strokeWidth={2}
          />
        </button>
      </div>

      {isSyncOpen && (
        <div
          role="dialog"
          aria-label="Telemetry Sync Details"
          className="absolute right-0 mt-3 w-80 rounded-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 bg-white/98 border border-slate-200/90 shadow-2xl text-left"
          style={{
            backdropFilter: 'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          }}
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-900">Telemetry & Sync Status</p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[180px]">
                {plantName} · {capacityText}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                syncMeta?.sseConnected ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncMeta?.sseConnected ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              {syncMeta?.sseConnected ? 'SSE Connected' : 'Polling'}
            </span>
          </div>

          <div className="py-2.5 space-y-2 text-[11.5px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Waaree Inverter</span>
              <span
                className={`font-semibold text-right truncate ${
                  isGenerating ? 'text-emerald-700' : isNight ? 'text-slate-600' : 'text-amber-700'
                }`}
              >
                {isGenerating
                  ? 'Online · Live Telemetry'
                  : isNight
                    ? 'Night Standby'
                    : `Wi-Fi Offline (${compactLastSeen})`}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Weather & Model</span>
              <span className="font-medium text-slate-700 text-right tabular-nums truncate">
                {calmSyncTime ? `Synced ${calmSyncTime}` : 'Syncing'}{' '}
                {syncMeta?.syncedAtIso ? `(${elapsedSec}s ago)` : ''}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Auto-Sync Cadence</span>
              <span className="font-medium text-slate-700 tabular-nums">
                {syncMeta?.inBackoff
                  ? `Cooldown ${backoffMins}m ${String(backoffSecs).padStart(2, '0')}s`
                  : `Next check in ${nextIn}s`}
              </span>
            </div>
          </div>

          {onToggleAlerts && (
            <div className="pt-2.5 mt-0.5 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {alertsEnabled ? (
                  <BellRing className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold text-slate-800 leading-tight">
                    Live Packet Alerts
                  </p>
                  <p className="text-[10.5px] text-slate-500 truncate mt-0.5">
                    {latestNewData ? `Last: ${latestNewData.reason}` : 'Notify when inverter sends data'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={alertsEnabled}
                aria-label="Toggle Waaree live packet notifications"
                onClick={onToggleAlerts}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  alertsEnabled ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${
                    alertsEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          <div className="pt-2.5 mt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
            {onOpenLocationEdit ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLocationEdit();
                }}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-900 truncate flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{locationName}</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 truncate">{locationName}</span>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {isRefreshing ? 'Syncing...' : 'Sync now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
