import React, { useEffect, useId, useRef, useState } from 'react';
import type { CanonicalSolarSnapshot, SystemHealthReport } from '@solar-track/core';
import { HealthChannelsView } from './HealthChannelsView';
import { HealthSync14Stage } from './HealthSync14Stage';
import { HealthConversionCurveStage } from './HealthConversionCurveStage';
import { HealthAlarmsView } from './HealthAlarmsView';

export type HealthStageView = 'conversion' | 'sync14' | 'channels' | 'alarms';

export interface HealthCockpitStageProps {
  view: HealthStageView;
  report: SystemHealthReport;
  canonicalSnapshot: CanonicalSolarSnapshot;
  onInspectDayInPerformance: (ymd: string) => void;
  onNavigateToSettings: () => void;
  lastUpdateDate: string;
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
}

/**
 * Health cockpit stage hosting Inverter Conversion Curve, 14-day Sync Tracker,
 * Plant Hardware Channel Probes, and Safety Guard Alerts.
 */
export const HealthCockpitStage: React.FC<HealthCockpitStageProps> = ({
  view,
  report,
  canonicalSnapshot,
  onInspectDayInPerformance,
  onNavigateToSettings,
  lastUpdateDate,
  syncMeta,
  stationId,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState<number>(820);
  const [hoverConvIdx, setHoverConvIdx] = useState<number | null>(null);
  const [hoverSyncIdx, setHoverSyncIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && w > 120) setBoxWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  return (
    <div ref={containerRef}>
      {view === 'conversion' && (
        <HealthConversionCurveStage
          uid={uid}
          report={report}
          canonicalSnapshot={canonicalSnapshot}
          boxWidth={boxWidth}
          hoveredConvIdx={hoverConvIdx}
          onHoverConvIdx={setHoverConvIdx}
          onNavigateToSettings={onNavigateToSettings}
        />
      )}
      {view === 'sync14' && (
        <HealthSync14Stage
          report={report}
          canonicalSnapshot={canonicalSnapshot}
          todayYmd={canonicalSnapshot.clock.ymd}
          boxWidth={boxWidth}
          hoveredSyncIdx={hoverSyncIdx}
          onHoverSyncIdx={setHoverSyncIdx}
          onInspectDayInPerformance={onInspectDayInPerformance}
          lastUpdateDate={lastUpdateDate}
          syncMeta={syncMeta}
        />
      )}
      {view === 'channels' && (
        <HealthChannelsView report={report} canonicalSnapshot={canonicalSnapshot} />
      )}
      {view === 'alarms' && (
        <HealthAlarmsView
          alarmsPayload={canonicalSnapshot.alarms || null}
          stationId={stationId}
          guards={report.guards}
        />
      )}
    </div>
  );
};
