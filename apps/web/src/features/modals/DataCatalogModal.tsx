import React, { useMemo } from 'react';
import { X, Database, Sun, Radio, Gauge, CheckCircle2, Clock, Sparkles, AlertCircle } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import type { ChannelAuditState, TelemetryChannelAuditRow } from '@solar-track/core';

interface DataCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels?: TelemetryChannelAuditRow[];
  plantLabel?: string;
}

const CATEGORY_ORDER: Array<{
  key: TelemetryChannelAuditRow['category'];
  title: string;
  accentClass: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  {
    key: 'Waaree Flow & Curve',
    title: 'Waaree Inverter Flow & Curve Registers',
    accentClass: 'text-emerald-700',
    Icon: Sun,
  },
  {
    key: 'Weather & Optics Model',
    title: 'Satellite Irradiance & Optics Engine',
    accentClass: 'text-sky-700',
    Icon: Radio,
  },
  {
    key: 'Optional Field Sensor',
    title: 'Optional RS485 CT Clamps & Field Sensors',
    accentClass: 'text-amber-700',
    Icon: Gauge,
  },
];

function getStateBadgeStyle(state: ChannelAuditState): {
  badgeClass: string;
  shortTag: string;
  Icon: React.FC<{ className?: string }>;
} {
  switch (state) {
    case 'LIVE_ACTIVE':
      return {
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        shortTag: 'LIVE',
        Icon: CheckCircle2,
      };
    case 'STANDBY_NIGHT':
      return {
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        shortTag: 'STANDBY',
        Icon: Clock,
      };
    case 'PHYSICS_MODEL':
      return {
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
        shortTag: 'PHYSICS',
        Icon: Sparkles,
      };
    case 'ZERO_UNWIRED':
    case 'MIRRORED_NO_CT':
    case 'NOT_EXPOSED':
    default:
      return {
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        shortTag: 'UNPUBLISHED',
        Icon: AlertCircle,
      };
  }
}

export const DataCatalogModal: React.FC<DataCatalogModalProps> = ({
  isOpen,
  onClose,
  channels = [],
  plantLabel = 'Solar Station',
}) => {
  const counts = useMemo(() => {
    let live = 0;
    let derived = 0;
    let unpublished = 0;
    for (const c of channels) {
      if (c.state === 'LIVE_ACTIVE') live += 1;
      else if (c.state === 'STANDBY_NIGHT' || c.state === 'PHYSICS_MODEL') derived += 1;
      else unpublished += 1;
    }
    return { live, derived, unpublished };
  }, [channels]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogBackdrop className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-2xs animate-in fade-in duration-200" />
      <DialogContent className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 border border-slate-200 shadow-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <Database className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">Raw Inverter Register Audit</DialogTitle>
                <p className="text-xs text-slate-500">
                  {plantLabel} · {counts.live} live · {counts.derived} derived/standby · {counts.unpublished} unpublished by dongle
                </p>
              </div>
            </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close register audit"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto py-4 space-y-4 text-xs flex-1">
          {channels.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 text-center text-slate-500">
              Telemetry channels are still hydrating for this station. Trigger a sync or return once data arrives.
            </div>
          ) : (
            CATEGORY_ORDER.map((group) => {
              const items = channels.filter((c) => c.category === group.key);
              if (items.length === 0) return null;
              const GroupIcon = group.Icon;
              return (
                <div key={group.key} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-200/70 bg-white flex items-center gap-2">
                    <GroupIcon className={`w-3.5 h-3.5 ${group.accentClass}`} />
                    <h4 className={`font-bold text-[12px] ${group.accentClass}`}>{group.title}</h4>
                  </div>
                  <div className="divide-y divide-slate-200/60">
                    {items.map((row) => {
                      const badge = getStateBadgeStyle(row.state);
                      const BadgeIcon = badge.Icon;
                      return (
                        <div key={row.channelKey} className="px-4 py-3 space-y-1 bg-white/70">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-slate-900 truncate">{row.label}</span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.badgeClass}`}
                              >
                                <BadgeIcon className="w-2.5 h-2.5" />
                                {badge.shortTag}
                              </span>
                            </div>
                            <span className="font-bold text-slate-800 num text-[12px]">
                              {row.liveValueText}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-600">{row.stateLabel}</div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">{row.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Source: live Waaree cloud schema &amp; Open-Meteo physics audit</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
          >
            Close Audit
          </button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
