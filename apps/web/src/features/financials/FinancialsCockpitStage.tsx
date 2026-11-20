import React, { useEffect, useId, useRef, useState } from 'react';
import type {
  DiscomCycleBreakdown,
  PaybackHorizonAnalysis,
  ReconciledCashPnlSummary,
} from '@solar-track/core';
import { FinancialsPaybackStage } from './FinancialsPaybackStage';
import { FinancialsCycleStage } from './FinancialsCycleStage';
import { FinancialsPnlStage } from './FinancialsPnlStage';

export type FinancialsStageView = 'payback' | 'cycle' | 'pnl';

export interface FinancialsCockpitStageProps {
  view: FinancialsStageView;
  payback: PaybackHorizonAnalysis;
  discom: DiscomCycleBreakdown;
  pnlSummary: ReconciledCashPnlSummary;
  cyclePnlSummary: ReconciledCashPnlSummary;
}

/**
 * Financials Cockpit stage hosting 25y Payback Curve, DISCOM Cycle Billing,
 * and 100% Reconciled Monthly P&L Revenue Bridge.
 */
export const FinancialsCockpitStage: React.FC<FinancialsCockpitStageProps> = ({
  view,
  payback,
  discom,
  pnlSummary,
  cyclePnlSummary,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState<number>(820);
  const [horizonYears, setHorizonYears] = useState<10 | 25>(10);
  const [hoverYrIdx, setHoverYrIdx] = useState<number | null>(null);
  const [hoverDayIdx, setHoverDayIdx] = useState<number | null>(null);

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
      {view === 'pnl' && (
        <FinancialsPnlStage
          pnlSummary={pnlSummary}
          boxWidth={boxWidth}
          hoveredDayIdx={hoverDayIdx}
          onHoverDayIdx={setHoverDayIdx}
        />
      )}
      {view === 'cycle' && (
        <FinancialsCycleStage
          discom={discom}
          cyclePnlSummary={cyclePnlSummary}
          boxWidth={boxWidth}
          hoveredDayIdx={hoverDayIdx}
          onHoverDayIdx={setHoverDayIdx}
        />
      )}
      {view === 'payback' && (
        <FinancialsPaybackStage
          uid={uid}
          payback={payback}
          boxWidth={boxWidth}
          horizonYears={horizonYears}
          onSelectHorizonYears={setHorizonYears}
          hoveredYearIdx={hoverYrIdx}
          onHoverYearIdx={setHoverYrIdx}
        />
      )}
    </div>
  );
};
