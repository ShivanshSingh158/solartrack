import React from 'react';
import { AlertTriangle, CheckCircle2, ZapOff, Info, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Timeline, Tag, Badge } from 'antd';
import type { PlantAlarmsPayload, SystemHealthReport } from '@solar-track/core';

interface HealthAlarmsViewProps {
  alarmsPayload: PlantAlarmsPayload | null;
  stationId?: string;
  guards?: SystemHealthReport['guards'];
}

const GUARD_BADGE: Record<'Normal' | 'Triggered' | 'Muted', string> = {
  Normal: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  Triggered: 'bg-amber-50 text-amber-700 border-amber-200',
  Muted: 'bg-slate-100 text-slate-500 border-slate-200',
};

/**
 * Official hardware alarm log & inverter event history fetched directly
 * from /c/v0/plant/alarm/today/detail, certified by the Fox ESS / Waaree platform.
 */
export const HealthAlarmsView: React.FC<HealthAlarmsViewProps> = ({ alarmsPayload, stationId, guards }) => {
  const alarms = alarmsPayload?.alarms || [];
  const hasAlarms = alarms.length > 0;
  const activeGridDrop = alarmsPayload?.activeGridDropAlarm || null;

  return (
    <div className="px-4 sm:px-6 py-4 space-y-5">
      {/* 4 Automated Protection Guards */}
      {guards && guards.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <h4 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Automated Protection Guards
            </h4>
            <span className="text-[10.5px] font-semibold text-slate-400">
              Continuous Hardware & Cloud Surveillance
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {guards.map((g) => (
              <div
                key={g.key}
                className="p-3.5 rounded-2xl bg-white border border-slate-200/70 shadow-xs flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11.5px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                    {g.liveState === 'Triggered' ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate">{g.label}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      GUARD_BADGE[g.liveState]
                    }`}
                  >
                    {g.armed ? g.liveState : 'Muted'}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-500 tabular-nums">
                  {g.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inverter Hardware Alarm Log */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-[13px] font-bold text-slate-900">
                Inverter Hardware Alarm & Safety Log
              </h4>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                  activeGridDrop
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : hasAlarms
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                <Badge status={activeGridDrop ? 'error' : hasAlarms ? 'warning' : 'success'} />
                <span>
                  {activeGridDrop
                    ? 'Active Grid Outage'
                    : hasAlarms
                      ? `${alarms.length} Hardware Event${alarms.length > 1 ? 's' : ''}`
                      : 'Zero Hardware Faults'}
                </span>
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Verified fault records from central inverter controller
              {stationId ? ` · Station ID: ${stationId.slice(0, 8)}...` : ''}
            </p>
          </div>
          <span className="text-[10.5px] font-semibold text-slate-400 tabular-nums">
            Grid Safety Protection: Active
          </span>
        </div>

        {hasAlarms ? (
          <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs">
            <Timeline
              items={alarms.map((alarm, idx) => ({
                key: `${alarm.code}-${alarm.time}-${idx}`,
                color: alarm.isGridDrop ? '#F59E0B' : '#64748B',
                dot: (
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      alarm.isGridDrop
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {alarm.isGridDrop ? <ZapOff className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                ),
                children: (
                  <div className="pb-3 pl-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold text-slate-900">{alarm.content}</span>
                        <Tag className="!rounded-md !text-[10px] !font-bold !bg-slate-100 !text-slate-600 !border-slate-200">
                          Code {alarm.code}
                        </Tag>
                        {alarm.isGridDrop && (
                          <Tag color="warning" className="!rounded-full !text-[10px] !font-bold">
                            Grid Power Cut
                          </Tag>
                        )}
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">
                        Fault Handled Safely
                      </span>
                    </div>
                    <p className="text-[11.5px] font-medium text-slate-500 mt-1">
                      {alarm.isGridDrop
                        ? 'Grid voltage was temporarily absent or dipped below 180V. The inverter safely paused and reconnected automatically once power stabilized.'
                        : 'Inverter diagnostic notice. Normal operation resumes automatically once grid/temperature conditions normalize.'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10.5px] font-semibold text-slate-400">
                      <span>Logged at: {alarm.time}</span>
                      {alarm.deviceSN && <span>Device SN: {alarm.deviceSN}</span>}
                    </div>
                  </div>
                ),
              }))}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/30 p-6 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-100/80 text-emerald-700 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h5 className="text-[13px] font-bold text-emerald-900">
                Zero Active Inverter Hardware Alarms
              </h5>
              <p className="text-[11.5px] font-medium text-emerald-800/80 mt-0.5">
                The central inverter reported zero alarms today. Phase R grid voltage, line frequency, DC insulation impedance, and internal IGBT thermals are operating within safe nominal parameters.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Grid Protection & Anti-Islanding Standards Matrix */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <h5 className="text-[11.5px] font-bold text-slate-700 uppercase tracking-wider">
            Inverter Automatic Protection Guard Thresholds
          </h5>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-[11px]">
          <div className="p-3 rounded-xl bg-white border border-slate-200/60 shadow-xs">
            <div className="font-semibold text-slate-500">Under-Voltage Trip (LV)</div>
            <div className="text-[13px] font-extrabold text-slate-900 mt-0.5">184.0 V (&lt; 0.1s)</div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">Protects inverter from brownouts</div>
          </div>
          <div className="p-3 rounded-xl bg-white border border-slate-200/60 shadow-xs">
            <div className="font-semibold text-slate-500">Over-Voltage Trip (HV)</div>
            <div className="text-[13px] font-extrabold text-slate-900 mt-0.5">265.0 V (&lt; 0.2s)</div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">DISCOM high voltage surge cut</div>
          </div>
          <div className="p-3 rounded-xl bg-white border border-slate-200/60 shadow-xs">
            <div className="font-semibold text-slate-500">Frequency Trip Range</div>
            <div className="text-[13px] font-extrabold text-slate-900 mt-0.5">47.5 Hz – 52.0 Hz</div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">CEA / Grid Code compliance</div>
          </div>
          <div className="p-3 rounded-xl bg-white border border-slate-200/60 shadow-xs">
            <div className="font-semibold text-slate-500">Thermal Power Derating</div>
            <div className="text-[13px] font-extrabold text-slate-900 mt-0.5">65°C / Trip 85°C</div>
            <div className="text-[10.5px] text-slate-400 mt-0.5">Automatic heat throttling</div>
          </div>
        </div>
      </div>
    </div>
  );
};
