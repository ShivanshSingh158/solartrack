import React, { useMemo } from 'react';
import { Calendar, IndianRupee, TrendingUp } from 'lucide-react';
import { NumericInput } from '../../shared/ui/NumericInput';
import {
  simulateMonthlyPaybackHorizon,
  type SolarIntelligenceReport,
  type SolarWeatherResponse,
} from '@solar-track/core';
import { SettingFieldShell, type BasePanelProps } from './SettingsShared';
import { formatInrExact } from './settingsFormatters';

interface UtilityRoiPanelProps extends BasePanelProps {
  intelligenceReport: SolarIntelligenceReport | null;
  weatherData: SolarWeatherResponse | null;
}

const TARIFF_CHIPS = [6.5, 7.35, 8.0, 9.0];

export const UtilityRoiPanel: React.FC<UtilityRoiPanelProps> = ({
  settings,
  onUpdateSettings,
  canonicalSnapshot,
  intelligenceReport,
  weatherData,
}) => {
  const dc = canonicalSnapshot.discomCycle;
  const subsidy = Math.max(0, Number(settings.govtSubsidyInr) || 0);
  const netCapex = Math.max(0, (Number(settings.systemCost) || 0) - subsidy);

  const paybackPreview = useMemo(
    () =>
      simulateMonthlyPaybackHorizon({
        canonicalSnapshot,
        intelligenceReport,
        annualBaseline: weatherData?.annualBaseline ?? null,
        weatherData,
        tariffOverride: settings.tariffPerKwh,
        systemCostOverride: settings.systemCost,
        subsidyInr: subsidy,
        washCostInr: settings.panelWashCostInr ?? 0,
        tariffEscalationPct: settings.tariffEscalationPct ?? 0,
        degradationOverridePct: settings.panelDegradationPctYr ?? 0.55,
      }),
    [canonicalSnapshot, intelligenceReport, weatherData, settings, subsidy]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
      {/* LEFT COLUMN: Tariff, DISCOM Billing Cycle & Wash Economics */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
            Utility Tariff &amp; DISCOM Billing Cycle
          </h4>
        </div>

        <SettingFieldShell
          title="Grid Electricity Tariff (₹ / kWh)"
          description="Applied globally to today's earnings, DISCOM cycle savings, lifetime ROI, and wash ROI alerts."
          badgeText={`₹${settings.tariffPerKwh.toFixed(2)} / unit`}
          badgeTone="emerald"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <NumericInput
                value={settings.tariffPerKwh}
                onChangeValue={(v) => void onUpdateSettings({ tariffPerKwh: v })}
                min={0.5}
                max={40}
                allowDecimal
                ariaLabel="Electricity tariff in rupees per kWh"
                className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="text-[12px] font-semibold text-slate-500">₹ / kWh</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TARIFF_CHIPS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => void onUpdateSettings({ tariffPerKwh: t })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    Math.abs(settings.tariffPerKwh - t) < 0.01
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ₹{t.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        </SettingFieldShell>

        <SettingFieldShell
          title="DISCOM Meter Reading Day (1–28)"
          description="Anchors your monthly net-metered billing cycle across Overview, Performance, and Financials."
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <NumericInput
                value={settings.billingCycleDay}
                onChangeValue={(v) =>
                  void onUpdateSettings({ billingCycleDay: Math.min(28, Math.max(1, Math.round(v))) })
                }
                min={1}
                max={28}
                allowDecimal={false}
                ariaLabel="DISCOM meter reset day of month"
                className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="text-[12px] text-slate-500">of every month</span>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-slate-700">
                Active Window: {dc.cycleStartYmd} → {dc.cycleEndYmd}
              </span>
              <span className="font-bold text-emerald-700 tabular-nums">
                Day {dc.daysElapsedInCycle}/{dc.cycleTotalDays} · {dc.cycleYieldKwh.toFixed(1)} kWh ({dc.cycleBillFormatted})
              </span>
            </div>
          </div>
        </SettingFieldShell>

        <SettingFieldShell
          title="Annual Tariff Escalation (% / yr)"
          description="Models future utility rate increases across your 25-year solar cashflow simulation."
        >
          <div className="flex flex-wrap items-center gap-2">
            <NumericInput
              value={settings.tariffEscalationPct ?? 0}
              onChangeValue={(v) => void onUpdateSettings({ tariffEscalationPct: v })}
              min={0}
              max={20}
              allowDecimal
              commitZeroOnEmpty
              ariaLabel="Annual tariff escalation percent"
              className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <span className="text-[12px] font-semibold text-slate-500">% / year</span>
            <div className="flex gap-1.5 ml-auto">
              {[0, 3, 5].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => void onUpdateSettings({ tariffEscalationPct: pct })}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                    Math.abs((settings.tariffEscalationPct ?? 0) - pct) < 0.05
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </SettingFieldShell>

        <SettingFieldShell
          title="Panel Wash Service Fee (₹ / wash)"
          description="Used in Financials P&L net profit after maintenance and automated wash payback thresholds."
        >
          <div className="flex items-center gap-2">
            <NumericInput
              value={settings.panelWashCostInr ?? 0}
              onChangeValue={(v) => void onUpdateSettings({ panelWashCostInr: Math.round(v) })}
              min={0}
              max={50000}
              allowDecimal={false}
              commitZeroOnEmpty
              ariaLabel="Panel wash service cost in rupees"
              className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <span className="text-[12px] font-semibold text-slate-500">₹ per cleaning cycle</span>
          </div>
        </SettingFieldShell>
      </div>

      {/* RIGHT COLUMN: CapEx, Govt Subsidy & 25-Yr Lifecycle Model */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
            Capital Cost, Subsidy &amp; 25-Year Lifecycle
          </h4>
        </div>

        <SettingFieldShell
          title="Gross System Cost / CapEx (₹)"
          description="Total pre-subsidy turnkey invoice amount (modules, inverter, structure, net meter, installation)."
        >
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-slate-400" />
            <NumericInput
              value={settings.systemCost}
              onChangeValue={(v) => void onUpdateSettings({ systemCost: Math.round(v) })}
              min={1000}
              max={100000000}
              allowDecimal={false}
              ariaLabel="Gross system CapEx in rupees"
              className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <span className="text-[12px] font-semibold text-slate-500">
              ({formatInrExact(settings.systemCost)})
            </span>
          </div>
        </SettingFieldShell>

        <SettingFieldShell
          title="Government Subsidy Received (₹)"
          description="Subtracted from gross CapEx across Financials breakeven curve, ROI %, and 25y LCOE calculations."
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <NumericInput
                value={subsidy}
                onChangeValue={(v) => void onUpdateSettings({ govtSubsidyInr: Math.round(v) })}
                min={0}
                max={50000000}
                allowDecimal={false}
                commitZeroOnEmpty
                ariaLabel="Government subsidy in rupees"
                className="w-40 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="text-[12px] font-semibold text-slate-500">
                Net CapEx: <strong className="text-emerald-700">{formatInrExact(netCapex)}</strong>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '₹0 None', val: 0 },
                { label: '₹78k PM Surya Central', val: 78000 },
                { label: '₹1.08L Central + UP', val: 108000 },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => void onUpdateSettings({ govtSubsidyInr: chip.val })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    subsidy === chip.val
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </SettingFieldShell>

        <SettingFieldShell
          title="Annual Module Degradation (% / yr)"
          description="Linear silicon output decline applied over 25 years. Automatically updated when changing PV chemistry preset."
        >
          <div className="flex items-center gap-2">
            <NumericInput
              value={settings.panelDegradationPctYr ?? 0.55}
              onChangeValue={(v) => void onUpdateSettings({ panelDegradationPctYr: v })}
              min={0}
              max={3.0}
              allowDecimal
              commitZeroOnEmpty
              ariaLabel="Annual module degradation percent"
              className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <span className="text-[12px] font-semibold text-slate-500">% per year</span>
          </div>
        </SettingFieldShell>

        {/* Live Breakeven & Payback Preview Box */}
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/50 border border-emerald-200/70 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              <TrendingUp className="w-3.5 h-3.5" />
              Live Payback Projection
            </div>
            <span className="text-[10px] font-semibold text-slate-500">
              {paybackPreview.baselineSource === 'open_meteo_365d_archive'
                ? '365d Satellite Archive'
                : 'Weather Model'}
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Net Target</div>
              <div className="text-[15px] font-extrabold text-slate-900 tabular-nums">
                {formatInrExact(netCapex)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Breakeven</div>
              <div className="text-[15px] font-extrabold text-emerald-700 tabular-nums">
                {paybackPreview.breakevenLabel}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase">25y Net Profit</div>
              <div className="text-[15px] font-extrabold text-slate-900 tabular-nums">
                {formatInrExact(paybackPreview.netProfit25YrInr)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
