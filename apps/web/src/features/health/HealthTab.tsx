import React, { useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { Tabs, TabsList, TabsTab } from '@ui-sdk/react/tabs';
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
import { HealthCockpitStage, type HealthStageView } from './HealthCockpitStage';

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
    <div className="space-y-5 w-full pb-8 animate-in fade-in duration-300">
      <section className="rounded-3xl apple-glass-static overflow-hidden shadow-xs">
        {/* Header & Subnav Switcher */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-600 shrink-0" />
                System Health & Telemetry
              </h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold apple-glass-pill shadow-2xs">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[report.statusLevel] || 'bg-slate-400'}`} />
                {report.statusBadge}
              </span>
            </div>
            <p className="text-[11.5px] font-medium text-slate-500 mt-1 truncate">
              {report.statusDetail}
              {stationId ? ` · Station ${stationId.slice(0, 8)}...` : ''}
            </p>
          </div>

          <Tabs
            value={stageView}
            onValueChange={(val) => {
              if (val) setStageView(val as HealthStageView);
            }}
          >
            <TabsList
              aria-label="System health chart views"
              className="apple-glass-pill p-1 rounded-full inline-flex items-center self-start md:self-auto shrink-0 shadow-2xs"
            >
              {(
                [
                  { id: 'conversion', label: 'Inverter Efficiency' },
                  { id: 'sync14', label: '14-Day Connection Log' },
                  { id: 'channels', label: 'Hardware Sensors' },
                  { id: 'alarms', label: 'Safety & Protection' },
                ] as const
              ).map((tab) => {
                const active = stageView === tab.id;
                return (
                  <TabsTab
                    key={tab.id}
                    value={tab.id}
                    className={`px-3 py-1.5 rounded-full text-[11.5px] font-bold transition cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </TabsTab>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Cockpit Stage (Each view contains its own purpose-driven content) */}
        <HealthCockpitStage
          view={stageView}
          report={report}
          canonicalSnapshot={canonicalSnapshot}
          onInspectDayInPerformance={onInspectDayInPerformance}
          onNavigateToSettings={onNavigateToSettings}
          lastUpdateDate={canonicalSnapshot.truth.exactTimestampIST}
          syncMeta={syncMeta}
          stationId={stationId}
        />
      </section>
    </div>
  );
};
