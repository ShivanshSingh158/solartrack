import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Download,
  Printer,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { Tabs, TabsList, TabsTab } from '@ui-sdk/react/tabs';
import {
  computeDiscomCycleBreakdown,
  formatINR,
  reconcilePeriodCashPnl,
  simulateMonthlyPaybackHorizon,
  type CanonicalSolarSnapshot,
  type SolarIntelligenceReport,
  type SolarWeatherResponse,
  type TimescaleMode,
} from '@solar-track/core';
import { NumericInput } from '../../shared/ui/NumericInput';
import { FinancialsKpiStrip } from './FinancialsKpiStrip';
import { FinancialsCockpitStage, type FinancialsStageView } from './FinancialsCockpitStage';
import { FinancialsFooterLedgers } from './FinancialsFooterLedgers';
import { PrintFinancialStatementModal } from './PrintFinancialStatementModal';

export interface FinancialsTabProps {
  canonicalSnapshot: CanonicalSolarSnapshot;
  intelligenceReport?: SolarIntelligenceReport | null;
  weatherData?: SolarWeatherResponse | null;
  govtSubsidyInr: number;
  panelWashCostInr: number;
  tariffEscalationPct: number;
  onChangeTariff: (val: number) => void;
  onChangeSystemCost: (val: number) => void;
  onChangeGovtSubsidy: (val: number) => void;
  onChangePanelWashCost: (val: number) => void;
  onNavigateToSettings: () => void;
  onNavigateToPerformance: (mode?: TimescaleMode) => void;
}

/**
 * Financials & Payback Engine tab: Multi-year ROI payback curve, DISCOM cycle billing,
 * 100% reconciled daily cash P&L bridge, and interactive Financial Settings sandbox.
 */
export const FinancialsTab: React.FC<FinancialsTabProps> = ({
  canonicalSnapshot,
  intelligenceReport,
  weatherData,
  govtSubsidyInr,
  panelWashCostInr,
  tariffEscalationPct,
  onChangeTariff,
  onChangeSystemCost,
  onChangeGovtSubsidy,
  onChangePanelWashCost,
  onNavigateToSettings,
  onNavigateToPerformance,
}) => {
  const persistedTariff = canonicalSnapshot.config.tariffPerKwh;
  const persistedSystemCost = canonicalSnapshot.config.systemCost;
  const [stageView, setStageView] = useState<FinancialsStageView>('payback');
  const [showWhatIf, setShowWhatIf] = useState<boolean>(false);
  const [isStatementOpen, setIsStatementOpen] = useState<boolean>(false);

  // Interactive Financial Settings Sandbox State (keeps overview numbers untampered unless saved)
  const [draftTariffOverride, setDraftTariffOverride] = useState<number | null>(null);
  const [draftSystemCostOverride, setDraftSystemCostOverride] = useState<number | null>(null);
  const [draftSubsidyOverride, setDraftSubsidyOverride] = useState<number | null>(null);
  const [draftWashCostOverride, setDraftWashCostOverride] = useState<number | null>(null);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const draftTariff = draftTariffOverride ?? persistedTariff;
  const draftSystemCost = draftSystemCostOverride ?? persistedSystemCost;
  const draftSubsidy = draftSubsidyOverride ?? govtSubsidyInr;
  const draftWashCost = draftWashCostOverride ?? panelWashCostInr;

  const isWhatIfModified =
    Math.abs(draftTariff - persistedTariff) > 0.01 ||
    Math.round(draftSystemCost) !== Math.round(persistedSystemCost) ||
    Math.round(draftSubsidy) !== Math.round(govtSubsidyInr) ||
    Math.round(draftWashCost) !== Math.round(panelWashCostInr);

  const payback = useMemo(
    () =>
      simulateMonthlyPaybackHorizon({
        canonicalSnapshot,
        intelligenceReport,
        annualBaseline: weatherData?.annualBaseline,
        weatherData,
        tariffOverride: draftTariff,
        systemCostOverride: draftSystemCost,
        subsidyInr: draftSubsidy,
        washCostInr: draftWashCost,
        tariffEscalationPct,
      }),
    [
      canonicalSnapshot,
      intelligenceReport,
      weatherData,
      draftTariff,
      draftSystemCost,
      draftSubsidy,
      draftWashCost,
      tariffEscalationPct,
    ],
  );

  const discom = useMemo(
    () => computeDiscomCycleBreakdown(canonicalSnapshot, intelligenceReport, draftTariff),
    [canonicalSnapshot, intelligenceReport, draftTariff],
  );

  const ledgerEntries = useMemo(
    () => intelligenceReport?.dailyLedger ?? [],
    [intelligenceReport?.dailyLedger],
  );

  const pnlSummary = useMemo(() => {
    const curMonthEntries = ledgerEntries.filter(
      (d) => d.ymd.startsWith(canonicalSnapshot.clock.ym) && d.ymd <= canonicalSnapshot.clock.ymd,
    );
    const chosen = curMonthEntries.length > 0 ? curMonthEntries : ledgerEntries;
    return reconcilePeriodCashPnl(chosen, draftTariff, canonicalSnapshot.clock.ymd);
  }, [ledgerEntries, canonicalSnapshot.clock.ym, canonicalSnapshot.clock.ymd, draftTariff]);

  const cyclePnlSummary = useMemo(() => {
    const inCycle = ledgerEntries.filter(
      (d) => d.ymd >= discom.cycleStartYmd && d.ymd <= canonicalSnapshot.clock.ymd,
    );
    return reconcilePeriodCashPnl(inCycle, draftTariff, canonicalSnapshot.clock.ymd);
  }, [ledgerEntries, discom.cycleStartYmd, canonicalSnapshot.clock.ymd, draftTariff]);

  const handleSaveWhatIf = () => {
    const nextCapex = Math.max(1000, Math.round(draftSystemCost) || persistedSystemCost);
    onChangeTariff(Math.max(1, Number(draftTariff) || persistedTariff));
    onChangeSystemCost(nextCapex);
    onChangeGovtSubsidy(Math.min(nextCapex, Math.max(0, Math.round(draftSubsidy) || 0)));
    onChangePanelWashCost(Math.max(0, Math.round(draftWashCost) || 0));
    setDraftTariffOverride(null);
    setDraftSystemCostOverride(null);
    setDraftSubsidyOverride(null);
    setDraftWashCostOverride(null);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2400);
  };

  const handleResetWhatIf = () => {
    setDraftTariffOverride(null);
    setDraftSystemCostOverride(null);
    setDraftSubsidyOverride(null);
    setDraftWashCostOverride(null);
  };

  const handleExportFinancialCsv = () => {
    const lines: string[] = [
      'Section,Metric,Value,Notes',
      `Summary,Location,"${canonicalSnapshot.config.locationName}",${canonicalSnapshot.config.capacityKwp} kWp`,
      `Summary,Total Lifetime Saved INR,${payback.confirmedSavedInr},${canonicalSnapshot.lifetime.confirmedKwh} kWh`,
      `Summary,Net System Investment INR,${payback.netCapexInr},Gross ${draftSystemCost} minus Subsidy ${draftSubsidy}`,
      `Summary,Breakeven Payback Date,"${payback.breakevenLabel}",${payback.breakevenYears ?? '>25'} years`,
      `Summary,Solar Cost per Unit INR/kWh,${payback.lcoeAllInInrPerKwh},Includes ${payback.washesPerYear} washes/yr @ INR ${draftWashCost}`,
      `Summary,DISCOM Cycle (${discom.cyclePeriodText}),${discom.accruedPlusPendingInr},Confirmed ${discom.confirmedInr} + Pending ${discom.pendingInr}`,
      '',
      'Daily Cash Attribution,Date,Earned INR,Weather Dip INR,Soil Loss INR,Pending Sync INR,Clear-Sky Potential INR',
      ...pnlSummary.dailyRows.map(
        (r) =>
          `Daily Cash Attribution,${r.ymd},${r.earnedInr},${r.weatherDipInr},${r.soilLossInr},${r.pendingOutageInr},${r.idealPotentialInr}`,
      ),
      '',
      'Payback Schedule,Year,Est Solar Harvest kWh,Annual Net Savings INR,Cumulative Net Cash INR,Paid Off %',
      ...payback.annualSeries.map(
        (a) =>
          `Payback Schedule,${a.yearLabel},${a.annualYieldKwh},${a.annualNetSavingsInr},${a.cumulativeNetInr},${a.paidOffPct}%`,
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SolarTrack_Financials_${canonicalSnapshot.clock.ymd}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 w-full pb-8 animate-in fade-in duration-300">
      <section className="rounded-3xl apple-glass-static overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-600 shrink-0" />
                Savings & Payback Engine
              </h2>
              <span className="px-3 py-0.5 rounded-full text-[10.5px] font-bold apple-glass-pill shadow-2xs text-emerald-800">
                {payback.baselineSource === 'open_meteo_365d_archive'
                  ? '365-Day Solar Weather Archive'
                  : 'Satellite Baseline'}
              </span>
              {isWhatIfModified && (
                <span className="px-3 py-0.5 rounded-full text-[10.5px] font-bold apple-glass-pill shadow-2xs text-amber-900 border-amber-300">
                  Settings Active
                </span>
              )}
            </div>
            <p className="text-[11.5px] font-medium text-slate-500 mt-1 truncate">
              Electricity Rate: ₹{draftTariff.toFixed(2)}/unit · Net System Cost: {formatINR(payback.netCapexInr)}
              {payback.archiveWindowLabel ? ` · Archive ${payback.archiveWindowLabel}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Tabs
              value={stageView}
              onValueChange={(val) => {
                if (val) setStageView(val as FinancialsStageView);
              }}
            >
              <TabsList
                aria-label="Financial analysis views"
                className="apple-glass-pill p-1 rounded-full inline-flex items-center shadow-2xs"
              >
                {(
                  [
                    { id: 'payback', label: 'Investment Payback' },
                    { id: 'cycle', label: 'Bill Credits' },
                    { id: 'pnl', label: 'Daily Cash Flow' },
                  ] as const
                ).map((tab) => {
                  const active = stageView === tab.id;
                  return (
                    <TabsTab
                      key={tab.id}
                      value={tab.id}
                      className={`px-3 py-1.5 rounded-full text-[11.5px] font-bold transition cursor-pointer whitespace-nowrap ${
                        active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab.label}
                    </TabsTab>
                  );
                })}
              </TabsList>
            </Tabs>

            <button
              type="button"
              onClick={() => setShowWhatIf((v) => !v)}
              aria-expanded={showWhatIf}
              className={`px-3 py-1.5 rounded-full text-[11.5px] font-bold border inline-flex items-center gap-1.5 transition cursor-pointer ${
                showWhatIf || isWhatIfModified
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Financial Settings
            </button>

            <button
              type="button"
              onClick={handleExportFinancialCsv}
              className="px-3 py-1.5 rounded-full text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => setIsStatementOpen(true)}
              className="px-3 py-1.5 rounded-full text-[11.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </button>
          </div>
        </div>

        {showWhatIf && (
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/75 bg-amber-50/35 flex flex-col xl:flex-row xl:items-end justify-between gap-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
              <label className="block space-y-1">
                <span className="h-5 flex items-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  Tariff (₹ / kWh)
                </span>
                <NumericInput
                  value={draftTariff}
                  min={0.5}
                  max={30}
                  allowDecimal
                  placeholder={String(persistedTariff)}
                  ariaLabel="What-If Tariff INR per kWh"
                  onChangeValue={(v) => setDraftTariffOverride(v)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </label>

              <div className="space-y-1">
                <div className="h-5 flex items-center justify-between gap-1">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                    Subsidy (₹)
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraftSubsidyOverride(draftSubsidy === 78000 ? 0 : 78000)}
                    className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-bold border transition cursor-pointer ${
                      draftSubsidy === 78000
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    ₹78k PM Surya
                  </button>
                </div>
                <NumericInput
                  value={draftSubsidy}
                  min={0}
                  max={draftSystemCost}
                  commitZeroOnEmpty
                  placeholder="0"
                  ariaLabel="What-If Govt Subsidy INR"
                  onChangeValue={(v) => setDraftSubsidyOverride(v)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <label className="block space-y-1">
                <span className="h-5 flex items-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  Wash Fee (₹ / wash)
                </span>
                <NumericInput
                  value={draftWashCost}
                  min={0}
                  max={5000}
                  commitZeroOnEmpty
                  placeholder="0"
                  ariaLabel="What-If Panel Wash Cost INR"
                  onChangeValue={(v) => setDraftWashCostOverride(v)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </label>

              <label className="block space-y-1">
                <span className="h-5 flex items-center text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  CapEx / System Cost (₹)
                </span>
                <NumericInput
                  value={draftSystemCost}
                  min={1000}
                  max={50000000}
                  placeholder={String(persistedSystemCost)}
                  ariaLabel="What-If Gross CapEx System Cost INR"
                  onChangeValue={(v) => setDraftSystemCostOverride(v)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isWhatIfModified && (
                <button
                  type="button"
                  onClick={handleResetWhatIf}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveWhatIf}
                disabled={!isWhatIfModified}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition ${
                  isWhatIfModified
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savedNotice ? 'Saved to Settings' : 'Save to Settings'}
              </button>
            </div>
          </div>
        )}

        <FinancialsKpiStrip
          stageView={stageView}
          payback={payback}
          discom={discom}
          pnlSummary={pnlSummary}
          canonicalSnapshot={canonicalSnapshot}
          draftSystemCost={draftSystemCost}
          subsidyInr={draftSubsidy}
          washCostInr={draftWashCost}
          isWhatIfActive={isWhatIfModified}
        />

        <FinancialsCockpitStage
          view={stageView}
          payback={payback}
          discom={discom}
          pnlSummary={pnlSummary}
          cyclePnlSummary={cyclePnlSummary}
        />
      </section>

      <FinancialsFooterLedgers
        stageView={stageView}
        payback={payback}
        discom={discom}
        pnlSummary={pnlSummary}
        canonicalSnapshot={canonicalSnapshot}
        activeTariff={draftTariff}
        activeSystemCost={draftSystemCost}
        subsidyInr={draftSubsidy}
        washCostInr={draftWashCost}
        tariffEscalationPct={tariffEscalationPct}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToPerformance={onNavigateToPerformance}
      />

      <PrintFinancialStatementModal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        payback={payback}
        discom={discom}
        pnlSummary={pnlSummary}
        canonicalSnapshot={canonicalSnapshot}
        activeTariff={draftTariff}
        activeSystemCost={draftSystemCost}
        subsidyInr={draftSubsidy}
        washCostInr={draftWashCost}
      />
    </div>
  );
};

export const SavingsTab = FinancialsTab;
