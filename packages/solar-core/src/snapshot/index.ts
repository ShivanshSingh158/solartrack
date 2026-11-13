export * from '../types/snapshot.ts';
export { buildCanonicalSolarSnapshot } from './buildCanonicalSnapshot.ts';
export {
  reconcileWaterFillBuffers,
  type WaterFillReconciliationParams,
  type WaterFillReconciliationResult,
} from './waterFillReconciler.ts';
export {
  getSeriesNumericValue,
  computeTrapezoidalCurveWindow,
  buildYesterdayRollup,
  buildMonthMetricsRollup,
  buildDiscomAndRoiRollup,
  buildRecent7AndSunScore,
} from './periodRollups.ts';
export {
  resolveHeroStatusLabel,
  resolveDirectDiffuseOptics,
  resolveThermalAndElectrical,
  resolveReportCard,
} from './heroStateMachine.ts';
