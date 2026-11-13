import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { NumericInput } from '../../shared/ui/NumericInput';
import type { SolarIntelligenceReport } from '@solar-track/core';
import { SettingFieldShell, type BasePanelProps } from './SettingsShared';

interface InverterTwinCardProps extends BasePanelProps {
  intelligenceReport?: SolarIntelligenceReport | null;
}

export const InverterTwinCard: React.FC<InverterTwinCardProps> = ({
  settings,
  onUpdateSettings,
  canonicalSnapshot,
  intelligenceReport,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const siteCal = intelligenceReport?.siteCalibration;
  const effPr = canonicalSnapshot.effectivePrBreakdown;

  return (
    <>
      <SettingFieldShell
        title="Digital Twin Calibration Mode"
        description="Fits empirical Waaree 3-term inverter curve, clean-day K_site (PM10 < 100), and recurring sunrise/sunset shading."
        badgeText={
          (settings.useCalibratedTwin ?? true)
            ? `K_site ${(siteCal?.kSiteApplied ?? canonicalSnapshot.config.kSiteApplied).toFixed(3)}x`
            : 'Raw 1.000x'
        }
        badgeTone={(settings.useCalibratedTwin ?? true) ? 'emerald' : 'slate'}
      >
        <div className="space-y-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {[
              { val: true, label: 'Calibrated Digital Twin' },
              { val: false, label: 'Raw Uncalibrated Physics' },
            ].map((opt) => {
              const active = (settings.useCalibratedTwin ?? true) === opt.val;
              return (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => void onUpdateSettings({ useCalibratedTwin: opt.val })}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                    active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {siteCal && (
            <p className="text-[11px] text-slate-500 leading-relaxed tabular-nums">
              {siteCal.note}
              {siteCal.inverterRmseWatts != null && (
                <>
                  {' '}
                  · <strong className="text-slate-700">Inverter fit RMSE {siteCal.inverterRmseWatts} W</strong>{' '}
                  across {siteCal.inverterSamplesCount} paired DC/AC samples.
                </>
              )}
              {siteCal.shadedHoursSummary.length > 0 && (
                <>
                  {' '}
                  · Shading:{' '}
                  {siteCal.shadedHoursSummary
                    .map((s) => `${String(s.hour).padStart(2, '0')}:00 (${Math.round(s.factor * 100)}%)`)
                    .join(', ')}
                  .
                </>
              )}
            </p>
          )}
        </div>
      </SettingFieldShell>

      <SettingFieldShell
        title="Automatic Inverter Register Sync (Waaree Cloud API)"
        description="Monthly and cumulative lifetime energy are fetched automatically from Waaree Cloud earnings and device registers whenever Wi-Fi is online, automatically reconciling missed midnight Cloud resets."
        badgeText={
          canonicalSnapshot.lifetime.hardwareSource === 'waaree-api' ||
          canonicalSnapshot.month.hardwareSource === 'waaree-api'
            ? 'Inverter API Synced'
            : canonicalSnapshot.lifetime.isEtotalAnchored
              ? `+${(canonicalSnapshot.lifetime.eTotalAnchorDeltaKwh ?? 0).toFixed(1)} kWh Synced`
              : 'Auto Twin Buffer'
        }
        badgeTone={
          canonicalSnapshot.lifetime.isEtotalAnchored || canonicalSnapshot.month.isEmonthAnchored
            ? 'emerald'
            : 'slate'
        }
      >
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2.5">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Monthly Register ({canonicalSnapshot.clock.monthShort})
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[18px] font-extrabold text-slate-900 tabular-nums">
                  {canonicalSnapshot.month.physicalTotalKwh.toFixed(2)}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">kWh</span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                Cloud {canonicalSnapshot.month.mtdKwh.toFixed(1)} kWh
                {canonicalSnapshot.month.unloggedKwh > 0.05
                  ? ` + ${canonicalSnapshot.month.unloggedKwh.toFixed(2)} kWh reconciled`
                  : ''}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2.5">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Lifetime Register (Total Yield)
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[18px] font-extrabold text-slate-900 tabular-nums">
                  {canonicalSnapshot.lifetime.physicalTotalKwh.toFixed(1)}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">kWh</span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                Cloud {canonicalSnapshot.lifetime.confirmedKwh.toFixed(1)} kWh
                {canonicalSnapshot.lifetime.unloggedKwh > 0.05
                  ? ` + ${canonicalSnapshot.lifetime.unloggedKwh.toFixed(1)} kWh reconciled`
                  : ''}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
            <span>
              {canonicalSnapshot.lifetime.eTotalSyncedLabel
                ? `Last inverter upload: ${canonicalSnapshot.lifetime.eTotalSyncedLabel}`
                : canonicalSnapshot.lifetime.eTotalSetAtYmd
                  ? `Hardware register synced through ${canonicalSnapshot.lifetime.eTotalSetAtYmd}`
                  : 'Waiting for Waaree Cloud hardware register telemetry'}
            </span>
            {(settings.physicalEtotalKwh != null || settings.physicalEmonthKwh != null) && (
              <button
                type="button"
                onClick={() =>
                  void onUpdateSettings({
                    physicalEmonthKwh: null,
                    physicalEmonthCloudRefKwh: null,
                    physicalEmonthYm: null,
                    physicalEmonthSetAtYmd: null,
                    physicalEmonthSetAtMin: null,
                    physicalEtotalKwh: null,
                    physicalEtotalCloudRefKwh: null,
                    physicalEtotalSetAtYmd: null,
                    physicalEtotalSetAtMin: null,
                  })
                }
                className="text-[11px] font-bold text-slate-600 hover:text-rose-700 underline underline-offset-2"
              >
                Clear Legacy Manual Override
              </button>
            )}
          </div>

          {(settings.manualGridOffDates?.length ?? 0) > 0 && (
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700">Grid-Off 0 kWh Dates:</span>
                {settings.manualGridOffDates!.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      void onUpdateSettings({
                        manualGridOffDates: (settings.manualGridOffDates || []).filter((x) => x !== d),
                      })
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-semibold tabular-nums"
                    title={`Remove ${d} Grid-Off override`}
                  >
                    {d} ×
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void onUpdateSettings({ manualGridOffDates: [] })}
                className="text-[11px] font-bold text-rose-700 hover:text-rose-800 underline underline-offset-2"
              >
                Clear Grid-Off Overrides
              </button>
            </div>
          )}
        </div>
      </SettingFieldShell>

      <div className="pt-3">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-[12px] font-bold text-slate-700 transition-colors"
        >
          <span>Advanced Optical Constants, K_site Override &amp; CO₂ Factor</span>
          {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isAdvancedOpen && (
          <div className="mt-3 px-3.5 py-3 rounded-xl bg-slate-50/60 border border-slate-200/70 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Thermal Loss Coefficient (per °C)
                </label>
                <NumericInput
                  value={settings.thermalCoeffPerC ?? 0.0038}
                  onChangeValue={(v) =>
                    void onUpdateSettings({ thermalCoeffPerC: v, panelTechPreset: 'custom' })
                  }
                  min={0.001}
                  max={0.008}
                  allowDecimal
                  ariaLabel="Thermal loss coefficient per degree C"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-900 tabular-nums"
                />
                <span className="text-[10px] text-slate-400">
                  -{((settings.thermalCoeffPerC ?? 0.0038) * 100).toFixed(2)}%/°C above 25°C cell temp
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Stage A DC Clean Factor (K_dc)
                </label>
                <NumericInput
                  value={parseFloat(((settings.dcCleanFactor ?? 0.95) * 100).toFixed(1))}
                  onChangeValue={(v) =>
                    void onUpdateSettings({ dcCleanFactor: parseFloat((v / 100).toFixed(3)) })
                  }
                  min={75}
                  max={100}
                  allowDecimal
                  ariaLabel="Stage A DC clean array factor percent"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-900 tabular-nums"
                />
                <span className="text-[10px] text-slate-400">
                  DC cabling, mismatch, LID &amp; bypass (default 95.0%)
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Rooftop Surface Albedo (0.05–0.80)
                </label>
                <NumericInput
                  value={settings.roofAlbedo ?? 0.2}
                  onChangeValue={(v) => void onUpdateSettings({ roofAlbedo: parseFloat(v.toFixed(2)) })}
                  min={0.05}
                  max={0.8}
                  allowDecimal
                  ariaLabel="Rooftop surface albedo"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-900 tabular-nums"
                />
                <span className="text-[10px] text-slate-400">
                  0.20 standard RCC · 0.45–0.65 white cool-roof paint
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Manual K_site Override (0.95–1.15)
                </label>
                <div className="flex items-center gap-1.5">
                  <NumericInput
                    value={settings.kSiteOverride ?? siteCal?.kSiteApplied ?? 1.0}
                    onChangeValue={(v) =>
                      void onUpdateSettings({
                        kSiteOverride: parseFloat(v.toFixed(3)),
                        useCalibratedTwin: true,
                      })
                    }
                    min={0.95}
                    max={1.15}
                    allowDecimal
                    ariaLabel="Manual K_site calibration factor"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-900 tabular-nums"
                  />
                  {settings.kSiteOverride != null && (
                    <button
                      type="button"
                      onClick={() => void onUpdateSettings({ kSiteOverride: null })}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 shrink-0"
                    >
                      Auto
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">
                  {settings.kSiteOverride != null
                    ? 'Fixed manual override active'
                    : 'Auto-learned on clean days'}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  CEA Grid Carbon Factor (kg CO₂/kWh)
                </label>
                <div className="flex items-center gap-1.5">
                  <NumericInput
                    value={settings.co2KgPerKwh ?? 0.85}
                    onChangeValue={(v) => void onUpdateSettings({ co2KgPerKwh: v })}
                    min={0.2}
                    max={1.5}
                    allowDecimal
                    ariaLabel="Grid CO2 emission factor"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-900 tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => void onUpdateSettings({ co2KgPerKwh: 0.85 })}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 shrink-0"
                  >
                    CEA 0.85
                  </button>
                </div>
                <span className="text-[10px] text-slate-400">
                  Used across Overview &amp; Performance CO₂ impact
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <span>
                Computed Effective PR now:{' '}
                <strong className="text-emerald-700">{effPr.prPct.toFixed(1)}%</strong> (Stage A DC{' '}
                {effPr.dcPrPct.toFixed(1)}% · Inv {effPr.inverterEffPct.toFixed(1)}% · Cell{' '}
                {effPr.cellTempFormatted})
              </span>
              <button
                type="button"
                onClick={() =>
                  void onUpdateSettings({
                    panelTechPreset: 'mono_perc',
                    thermalCoeffPerC: 0.0038,
                    mountingType: 'open_rack',
                    roofAlbedo: 0.2,
                    dcCleanFactor: 0.95,
                    useCalibratedTwin: true,
                    kSiteOverride: null,
                    inverterTareKw: null,
                    inverterLinearLoss: null,
                    inverterQuadLoss: null,
                    co2KgPerKwh: 0.85,
                  })
                }
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline"
              >
                Restore Physics Defaults
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
