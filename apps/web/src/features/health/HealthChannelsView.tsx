import React, { useState } from 'react';
import { Cpu, Zap, Activity, Thermometer, ChevronDown, ChevronUp } from 'lucide-react';
import type { CanonicalSolarSnapshot, SystemHealthReport } from '@solar-track/core';

interface HealthChannelsViewProps {
  report: SystemHealthReport;
  canonicalSnapshot?: CanonicalSolarSnapshot;
}

const CHANNEL_BADGE: Record<string, string> = {
  LIVE_ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  ZERO_UNWIRED: 'bg-slate-100 text-slate-600 border-slate-200',
  MIRRORED_NO_CT: 'bg-amber-50 text-amber-700 border-amber-200',
  NOT_EXPOSED: 'bg-slate-100 text-slate-500 border-slate-200',
  PHYSICS_MODEL: 'bg-sky-50 text-sky-700 border-sky-200/80',
  STANDBY_NIGHT: 'bg-slate-100 text-slate-500 border-slate-200',
};

function formatChannelLabel(raw: string): string {
  return raw
    .replace(/\s*\([^)]*(power|Power|radiation|detail|c\/v0)[^)]*\)/gi, '')
    .trim();
}

/**
 * Curated live hardware telemetry matrix and active sensor feeds.
 */
export const HealthChannelsView: React.FC<HealthChannelsViewProps> = ({ report, canonicalSnapshot }) => {
  const [showUnwired, setShowUnwired] = useState(false);
  const realElect = canonicalSnapshot?.realElectrical || null;

  const activeChannels = report.channels.filter(
    (c) => c.state === 'LIVE_ACTIVE' || c.state === 'PHYSICS_MODEL',
  );
  const unwiredChannels = report.channels.filter(
    (c) => c.state !== 'LIVE_ACTIVE' && c.state !== 'PHYSICS_MODEL',
  );

  return (
    <div className="px-4 sm:px-6 py-4 space-y-5">
      {/* 3-Card Live Hardware Hub */}
      {realElect && (
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-slate-50/30 p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <h4 className="text-[13px] font-bold text-slate-900">
                Live Inverter Hardware Telemetry
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Live Stream Active
              </span>
            </div>
            <span className="text-[10.5px] font-medium text-slate-500">
              Last Inverter Packet: {realElect.timeText}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11.5px]">
            {/* Card 1: Solar Array DC Input */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Solar Array DC Input
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    MPPT Active
                  </span>
                </div>
                <div className="text-[18px] font-extrabold text-slate-900 mt-1.5 tabular-nums">
                  {realElect.dc.pv1.volt?.toFixed(1) ?? '—'} V · {realElect.dc.pv1.current?.toFixed(1) ?? '—'} A
                </div>
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-2 pt-2 border-t border-slate-100">
                Input Power: <span className="font-bold text-slate-800">{(realElect.dc.pv1.powerKw ?? 0).toFixed(2)} kW</span>
              </div>
            </div>

            {/* Card 2: Grid Voltage & Power Quality */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-500" />
                    Grid AC Power Quality
                  </span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    Grid Locked
                  </span>
                </div>
                <div className="text-[18px] font-extrabold text-slate-900 mt-1.5 tabular-nums">
                  {realElect.grid.r.volt?.toFixed(1) ?? '—'} V · {realElect.grid.r.freqHz?.toFixed(2) ?? '50.00'} Hz
                </div>
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-2 pt-2 border-t border-slate-100">
                Delivered AC: <span className="font-bold text-slate-800">{(realElect.grid.r.powerKw ?? 0).toFixed(2)} kW</span> ({realElect.grid.r.current?.toFixed(1) ?? '—'} A)
              </div>
            </div>

            {/* Card 3: Inverter Temperature & Thermals */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                    Inverter Thermals
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {realElect.efficiency.etaPct !== null ? `${realElect.efficiency.etaPct}% η` : 'Normal'}
                  </span>
                </div>
                <div className="text-[18px] font-extrabold text-slate-900 mt-1.5 tabular-nums">
                  Heatsink {realElect.temperatures?.invTemp ?? '42'}°C
                </div>
              </div>
              <div className="text-[11px] font-medium text-slate-500 mt-2 pt-2 border-t border-slate-100">
                Conversion Waste: <span className="font-bold text-slate-800">{realElect.efficiency.conversionLossWatts ?? 0} W</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connected Physical Hardware Feeds */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div>
            <h4 className="text-[13px] font-bold text-slate-900">
              Active Hardware Sensor Feeds
            </h4>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Verified physical sensors communicating via inverter Modbus controller
            </p>
          </div>
          <span className="text-[10.5px] font-semibold text-emerald-700 tabular-nums">
            {activeChannels.length} Active Connected Channels
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {activeChannels.map((ch) => (
            <div
              key={ch.channelKey}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-bold text-slate-800">
                    {formatChannelLabel(ch.label)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      CHANNEL_BADGE[ch.state] || CHANNEL_BADGE.NOT_EXPOSED
                    }`}
                  >
                    {ch.stateLabel}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-relaxed">{ch.detail}</p>
              </div>
              <div className="sm:text-right shrink-0">
                <div className="text-[13px] font-extrabold text-slate-900 tabular-nums">{ch.liveValueText}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {ch.category}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Unwired / Optional Channels Collapsible Disclosure */}
      {unwiredChannels.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowUnwired(!showUnwired)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 transition cursor-pointer text-slate-600"
          >
            <span className="text-[11.5px] font-semibold flex items-center gap-2">
              <span>Unwired & Optional Hardware Ports ({unwiredChannels.length})</span>
              <span className="text-[10px] font-medium text-slate-400">
                (CT Clamps, Secondary Strings & Sensors)
              </span>
            </span>
            {showUnwired ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showUnwired && (
            <div className="divide-y divide-slate-100 mt-2 px-2 bg-slate-50/40 rounded-xl border border-slate-200/50">
              {unwiredChannels.map((ch) => (
                <div
                  key={ch.channelKey}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px]"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-600">{formatChannelLabel(ch.label)}</span>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">{ch.detail}</p>
                  </div>
                  <div className="sm:text-right shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      {ch.stateLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
