import React, { useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';
import {
  buildSystemHealthReport,
  type CanonicalSolarSnapshot,
  type LiveFlowData,
  type LiveSyncLastSyncedDay,
  type PersistedAppSettings,
  type RawSeries,
  type SolarIntelligenceReport,
  type SolarWeatherResponse,
} from '@solar-track/core';
import { HealthKpiStrip } from './HealthKpiStrip';
import { HealthCockpitStage, type HealthStageView } from './HealthCockpitStage';
import { HealthFooterLedgers } from './HealthFooterLedgers';

export interface HealthTabProps {
  canonicalSnapshot: CanonicalSolarSnapshot;
  todayRawSeries?: RawSeries[];
  yesterdayRawSeries?: RawSeries[];
  lastSyncedDay?: LiveSyncLastSyncedDay | null;
  liveFlow?: LiveFlowData | null;
  weatherData?: SolarWeatherResponse | null;
  intelligenceReport?: SolarIntelligenceReport | null;
  syncMeta: {
    syncedAtIso: string;
    syncedAtIstLabel: string;
    trigger: string;
    sseConnected: boolean;
    nextPollInSec: number;
    inBackoff: boolean;
    backoffRemainingSec: number;
  };
  stationId?: string;
  alertSettings: Pick<
    PersistedAppSettings,
    | 'alertOfflineDelay'
    | 'alertMorningYield'
    | 'alertUnderperformance'
    | 'alertVoltageSpike'
    | 'offlineDelayMinutes'
    | 'underperformanceThresholdPct'
    | 'packetAlertsEnabled'
  >;
  onInspectDayInPerformance: (ymd: string) => void;
  onNavigateToSettings: () => void;
}

const STATUS_DOT: Record<string, string> = {
  optimal: 'bg-emerald-500',
  watch: 'bg-amber-500',
  offline: 'bg-rose-500',
  fault: 'bg-rose-600',
  standby: 'bg-slate-400',
};

const GUARD_BADGE: Record<'Normal' | 'Triggered' | 'Muted', string> = {
  Normal: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  Triggered: 'bg-amber-50 text-amber-700 border-amber-200',
  Muted: 'bg-slate-100 text-slate-500 border-slate-200',
};

/**
 * System Health & Telemetry Integrity tab: Inverter MPPT conversion curve,
 * 14-day datalogger packet health, runtime channels, and hardware protection guards.
 */
export const HealthTab: React.FC<HealthTabProps> = ({
  canonicalSnapshot,
  todayRawSeries,
  yesterdayRawSeries,
  lastSyncedDay,
  liveFlow,
  weatherData,
  intelligenceReport,
  syncMeta,
  stationId,
  alertSettings,
  onInspectDayInPerformance,
  onNavigateToSettings,
}) => {
  const [stageView, setStageView] = useState<HealthStageView>('conversion');

  const report = useMemo(
    () =>
      buildSystemHealthReport({
        canonicalSnapshot,
        todayRaw: todayRawSeries,
        yesterdayRaw: yesterdayRawSeries,
        lastSyncedRaw: lastSyncedDay?.raw || null,
        liveFlow,
        weatherData,
        intelligenceReport,
        settings: alertSettings,
      }),
    [
      canonicalSnapshot,
      todayRawSeries,
      yesterdayRawSeries,
      lastSyncedDay,
      liveFlow,
      weatherData,
      intelligenceReport,
      alertSettings,
    ],
  );

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto pb-8 animate-in fade-in duration-300">
      <section className="rounded-3xl card-floating-static overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-600 shrink-0" />
                System Health & Telemetry Integrity
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[report.statusLevel] || 'bg-slate-400'}`} />
                {report.statusBadge}
              </span>
            </div>
            <p className="text-[11.5px] font-medium text-slate-500 mt-1 truncate">
              {report.statusDetail}
              {stationId ? ` · Station ${stationId.slice(0, 8)}...` : ''}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="System health chart views"
            className="bg-slate-100/90 p-1 rounded-full inline-flex items-center self-start md:self-auto shrink-0"
          >
            {(
              [
                { id: 'conversion', label: 'Inverter Efficiency Graph' },
                { id: 'sync14', label: '14-Day Connection Log' },
                { id: 'channels', label: 'Hardware Sensors' },
                { id: 'alarms', label: 'Safety & Outage Alerts' },
              ] as const
            ).map((tab) => {
              const active = stageView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStageView(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-[11.5px] font-bold transition cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <HealthKpiStrip report={report} canonicalSnapshot={canonicalSnapshot} />

        <HealthCockpitStage
          view={stageView}
          report={report}
          canonicalSnapshot={canonicalSnapshot}
          onInspectDayInPerformance={onInspectDayInPerformance}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/75 border-t border-slate-200/75 bg-slate-50/40">
          {report.guards.map((g) => (
            <div key={g.key} className="px-4 sm:px-5 py-3 flex items-start justify-between gap-2.5 min-w-0">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-700 truncate flex items-center gap-1.5">
                  {g.liveState === 'Triggered' ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="truncate">{g.label}</span>
                </div>
                <div className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate tabular-nums">
                  {g.detail}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                  GUARD_BADGE[g.liveState]
                }`}
              >
                {g.armed ? g.liveState : 'Muted'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <HealthFooterLedgers
        report={report}
        canonicalSnapshot={canonicalSnapshot}
        lastUpdateDate={canonicalSnapshot.truth.exactTimestampIST}
        syncMeta={syncMeta}
        onInspectDayInPerformance={onInspectDayInPerformance}
        onNavigateToSettings={onNavigateToSettings}
      />
    </div>
  );
};
