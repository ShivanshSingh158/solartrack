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
}

/**
 * Health cockpit stage hosting Inverter Conversion Curve, 14-day Sync Tracker,
 * and Plant Hardware Channel Probes.
 */
export const HealthCockpitStage: React.FC<HealthCockpitStageProps> = ({
  view,
  report,
  canonicalSnapshot,
  onInspectDayInPerformance,
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
      {view === 'channels' && (
        <HealthChannelsView report={report} canonicalSnapshot={canonicalSnapshot} />
      )}
      {view === 'alarms' && (
        <HealthAlarmsView alarmsPayload={canonicalSnapshot.alarms || null} />
      )}
      {view === 'sync14' && (
        <HealthSync14Stage
          report={report}
          todayYmd={canonicalSnapshot.clock.ymd}
          boxWidth={boxWidth}
          hoveredSyncIdx={hoverSyncIdx}
          onHoverSyncIdx={setHoverSyncIdx}
          onInspectDayInPerformance={onInspectDayInPerformance}
        />
      )}
      {view === 'conversion' && (
        <HealthConversionCurveStage
          uid={uid}
          report={report}
          canonicalSnapshot={canonicalSnapshot}
          boxWidth={boxWidth}
          hoveredConvIdx={hoverConvIdx}
          onHoverConvIdx={setHoverConvIdx}
        />
      )}
    </div>
  );
};
