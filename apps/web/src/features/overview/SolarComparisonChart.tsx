import React from 'react';
import { ComparisonFooterLegend } from './ComparisonFooterLegend';
import { ComparisonHeaderStrip } from './ComparisonHeaderStrip';
import { ComparisonSvgPlot } from './ComparisonSvgPlot';
import {
  useDayComparisonData,
  type SolarComparisonChartProps,
} from './useDayComparisonData';

export type { SolarComparisonChartProps };

export const SolarComparisonChart: React.FC<SolarComparisonChartProps> = (props) => {
  const vm = useDayComparisonData(props);

  return (
    <div
      id="solar-comparison-chart"
      className="w-full bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col overflow-visible relative"
    >
      <ComparisonHeaderStrip
        selectedYmd={vm.selectedYmd}
        todayYmd={vm.todayYmd}
        yesterdayYmd={vm.yesterdayYmd}
        minDateYmd={vm.minDateYmd}
        maxDateYmd={vm.maxDateYmd}
        loadingYmd={vm.loadingYmd}
        cityName={vm.cityName}
        capSummaryLabel={vm.capSummaryLabel}
        dayCondition={vm.dayCondition}
        radiationMjM2={vm.radiationMjM2}
        physicsModel={vm.physicsModel}
        isTodaySelected={vm.isTodaySelected}
        canStepPrev={vm.canStepPrev}
        canStepNext={vm.canStepNext}
        onStepDate={vm.handleStepDate}
        isCalendarOpen={vm.isCalendarOpen}
        onToggleCalendar={() => vm.setIsCalendarOpen((v) => !v)}
        onCloseCalendar={() => vm.setIsCalendarOpen(false)}
        inspectableLastSyncedYmd={vm.inspectableLastSyncedYmd}
        monthAvailabilityMap={vm.monthAvailabilityMap}
        onRequestMonthAvailability={vm.requestMonthAvailability}
        onSelectDate={vm.handleSelectDate}
        onNavigateToPerformance={props.onNavigateToPerformance}
        hasConfirmedDayReal={vm.hasConfirmedDayReal}
        isBeforeSunrise={vm.isBeforeSunrise}
        isAfterSunset={vm.isAfterSunset}
        isDaytimeToday={vm.isDaytimeToday}
        displayLiveKw={props.displayLiveKw}
        parsedReal={vm.parsedReal}
        isTodayConfirmed={props.isTodayConfirmed}
        todayYield={props.todayYield}
        todayBufferKwh={props.todayBufferKwh ?? 0}
        todayCurveSummary={props.todayCurveSummary}
        syncMeta={props.syncMeta}
        resolvedTodayCloudKwh={vm.resolvedTodayCloudKwh}
        gapRecovery={vm.gapRecovery}
        selectedDayEepromKwh={vm.selectedDayEepromKwh}
        selectedReconciledTotalKwh={vm.selectedReconciledTotalKwh}
        selectedBufferKwh={vm.selectedBufferKwh}
        overlapStats={vm.overlapStats}
        selectedManualGridOff={vm.selectedManualGridOff}
        activeNowMinutes={vm.activeNowMinutes ?? 720}
        nowCalcAtPoint={vm.nowCalcAtPoint}
        isScrubbing={props.isScrubbing ?? false}
        todayNowcast={props.todayNowcast ?? null}
        minsUntilSunriseText={vm.minsUntilSunriseText}
        liveCapturePct={vm.liveCapturePct}
        daylightElapsedPct={vm.daylightElapsedPct}
        dailyMatchPct={vm.dailyMatchPct}
        remainingSunText={vm.remainingSunText}
      />

      <div className="px-3 sm:px-5 pt-3 pb-4 relative">
        <ComparisonSvgPlot
          uid={vm.uid}
          plotContainerRef={vm.plotContainerRef}
          selectedYmd={vm.selectedYmd}
          svgW={vm.svgW}
          svgH={vm.svgH}
          isCompact={vm.isCompact}
          plotLeft={vm.plotLeft}
          plotRight={vm.plotRight}
          plotW={vm.plotW}
          topY={vm.topY}
          baselineY={vm.baselineY}
          plotH={vm.plotH}
          isTodaySelected={vm.isTodaySelected}
          isNight={props.isNight}
          isTodayConfirmed={props.isTodayConfirmed}
          isDaytimeToday={vm.isDaytimeToday}
          isScrubbing={props.isScrubbing ?? false}
          todayNowcast={props.todayNowcast ?? null}
          sunX={vm.sunX}
          sunY={vm.sunY}
          sunLiveLabel={vm.sunLiveLabel}
          activeNowMinutes={vm.activeNowMinutes ?? 720}
          realSegmentPaths={vm.realSegmentPaths}
          singleDotPoints={vm.singleDotPoints}
          bridgedSegmentPaths={vm.bridgedSegmentPaths}
          calcAreaPath={vm.calcGeometry.calcAreaPath}
          calcLinePath={vm.calcGeometry.calcLinePath}
          calcElapsedLinePath={vm.calcGeometry.calcElapsedLinePath}
          purePhysicsRemainingPath={vm.calcGeometry.purePhysicsRemainingPath}
          calcRemainingLinePath={vm.calcGeometry.calcRemainingLinePath}
          yTicksKw={vm.yTicksKw}
          xTicks={vm.xTicks}
          parsedReal={vm.parsedReal}
          gapRecovery={vm.gapRecovery}
          selectedManualGridOff={vm.selectedManualGridOff}
          hoverDetails={vm.hoverDetails}
          timeToX={vm.timeToX}
          kwToY={vm.kwToY}
          onUpdateHoverFromPointer={vm.updateHoverFromPointer}
          onClearHover={vm.clearHover}
        />

        <ComparisonFooterLegend
          isDaytimeToday={vm.isDaytimeToday}
          isScrubbing={props.isScrubbing ?? false}
          todayNowcast={props.todayNowcast ?? null}
          parsedReal={vm.parsedReal}
          gapRecovery={vm.gapRecovery}
          selectedManualGridOff={vm.selectedManualGridOff}
          physicsModel={vm.physicsModel}
        />
      </div>
    </div>
  );
};
