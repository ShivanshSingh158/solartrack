import React from 'react';
import { Calendar, IndianRupee } from 'lucide-react';
import { NumericInput } from '../../shared/ui/NumericInput';
import type {
  SolarIntelligenceReport,
  SolarWeatherResponse,
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
}) => {
  const dc = canonicalSnapshot.discomCycle;
  const subsidy = Math.max(0, Number(settings.govtSubsidyInr) || 0);
  const grossCost = Number(settings.systemCost) || 185000;
  const netCapex = Math.max(0, grossCost - subsidy);

  return (
    <div className="p-5 sm:p-6 space-y-6 max-w-3xl">
      {/* 1. ELECTRICITY TARIFF */}
      <SettingFieldShell
        title="Grid Electricity Tariff (₹ / unit)"
        description="Applied globally across daily earned cash, DISCOM monthly savings, and lifetime financial returns."
        badgeText={`₹${settings.tariffPerKwh.toFixed(2)} / unit`}
        badgeTone="emerald"
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <NumericInput
              value={settings.tariffPerKwh}
              onChangeValue={(v) => void onUpdateSettings({ tariffPerKwh: v })}
              min={0.5}
              max={40}
              allowDecimal
              ariaLabel="Electricity tariff in rupees per kWh"
              className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <span className="text-[12px] font-semibold text-slate-500">₹ / kWh</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TARIFF_CHIPS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => void onUpdateSettings({ tariffPerKwh: t })}
                className={`px-3 py-1 rounded-xl text-[11.5px] font-semibold border transition-colors cursor-pointer ${
                  Math.abs(settings.tariffPerKwh - t) < 0.01
                    ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ₹{t.toFixed(2)}
              </button>
            ))}
          </div>
        </div>
      </SettingFieldShell>

      {/* 2. DISCOM BILLING CYCLE DAY */}
      <SettingFieldShell
        title="DISCOM Meter Reset Day (1–28)"
        description="The day of the month your electricity utility company resets your net-metered solar billing cycle."
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
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
            <span className="text-[12px] text-slate-500">st / th of every month</span>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
            <span className="font-semibold text-slate-700">
              Active Billing Window: {dc.cycleStartYmd} → {dc.cycleEndYmd}
            </span>
            <span className="font-bold text-emerald-700 tabular-nums">
              Day {dc.daysElapsedInCycle}/{dc.cycleTotalDays} · {dc.cycleYieldKwh.toFixed(1)} kWh ({dc.cycleBillFormatted})
            </span>
          </div>
        </div>
      </SettingFieldShell>

      {/* 3. SYSTEM INVESTMENT & SUBSIDY */}
      <SettingFieldShell
        title="Solar Plant Investment & Government Subsidy"
        description="Turnkey gross system cost minus PM Surya Ghar government subsidy."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Gross Plant Cost (₹)
              </span>
              <div className="flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-slate-400 shrink-0" />
                <NumericInput
                  value={grossCost}
                  onChangeValue={(v) => void onUpdateSettings({ systemCost: Math.round(v) })}
                  min={1000}
                  max={100000000}
                  allowDecimal={false}
                  ariaLabel="Gross system cost in rupees"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Government Subsidy (₹)
              </span>
              <div className="flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-slate-400 shrink-0" />
                <NumericInput
                  value={subsidy}
                  onChangeValue={(v) => void onUpdateSettings({ govtSubsidyInr: Math.round(v) })}
                  min={0}
                  max={50000000}
                  allowDecimal={false}
                  commitZeroOnEmpty
                  ariaLabel="Government subsidy in rupees"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: '₹0 Subsidy', val: 0 },
                { label: '₹78k PM Surya Ghar', val: 78000 },
                { label: '₹1.08L Central + State', val: 108000 },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => void onUpdateSettings({ govtSubsidyInr: chip.val })}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                    subsidy === chip.val
                      ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Net System Investment
              </span>
              <span className="text-[14px] font-extrabold text-emerald-900 tabular-nums">
                {formatInrExact(netCapex)}
              </span>
            </div>
          </div>
        </div>
      </SettingFieldShell>

      {/* 4. PANEL WASH SERVICE FEE */}
      <SettingFieldShell
        title="Panel Wash Service Fee (₹ / wash)"
        description="Standard fee per panel cleaning cycle, used to calculate cleaning return on investment."
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
          <span className="text-[12px] font-semibold text-slate-500">₹ per cleaning</span>
        </div>
      </SettingFieldShell>

      {/* 5. ANNUAL TARIFF ESCALATION */}
      <SettingFieldShell
        title="Annual Electricity Rate Increase (% / year)"
        description="Expected annual grid tariff inflation across your multi-year financial projection."
      >
        <div className="flex flex-wrap items-center gap-3">
          <NumericInput
            value={settings.tariffEscalationPct ?? 0}
            onChangeValue={(v) => void onUpdateSettings({ tariffEscalationPct: v })}
            min={0}
            max={20}
            allowDecimal
            commitZeroOnEmpty
            ariaLabel="Annual tariff escalation percent"
            className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          <span className="text-[12px] font-semibold text-slate-500">% / year</span>

          <div className="flex gap-1.5 ml-auto">
            {[0, 3, 5].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => void onUpdateSettings({ tariffEscalationPct: pct })}
                className={`px-3 py-1 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                  Math.abs((settings.tariffEscalationPct ?? 0) - pct) < 0.05
                    ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      </SettingFieldShell>
    </div>
  );
};
