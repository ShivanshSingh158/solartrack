import React from 'react';
import { Compass } from 'lucide-react';
import { Slider } from 'antd';
import { NumericInput } from '../../shared/ui/NumericInput';
import { PANEL_TECH_PRESETS, type PanelTechPresetId } from '@solar-track/core';
import { SettingFieldShell, type BasePanelProps } from './SettingsShared';

const AZIMUTH_CHIPS: Array<{ label: string; deg: number }> = [
  { label: 'South (0°)', deg: 0 },
  { label: 'SE (-45°)', deg: -45 },
  { label: 'SW (+45°)', deg: 45 },
  { label: 'East (-90°)', deg: -90 },
  { label: 'West (+90°)', deg: 90 },
];

export const ArrayGeometryCard: React.FC<BasePanelProps> = ({
  settings,
  onUpdateSettings,
  canonicalSnapshot,
}) => {
  const locLat = settings.plantLocation?.lat ?? canonicalSnapshot.config.lat;

  const handleSelectTechPreset = (presetId: Exclude<PanelTechPresetId, 'custom'>) => {
    const preset = PANEL_TECH_PRESETS[presetId];
    if (!preset) return;
    void onUpdateSettings({
      panelTechPreset: presetId,
      thermalCoeffPerC: preset.thermalCoeffPerC,
      panelDegradationPctYr: preset.degradationPctYr,
    });
  };

  return (
    <>
      <SettingFieldShell
        title="Module Tilt Angle (0° Flat → 60° Steep)"
        description="Sent directly to Open-Meteo tilt parameter for GTI curve calculation and seasonal archive baseline."
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <NumericInput
              value={settings.arrayTiltDeg ?? 26.5}
              onChangeValue={(v) => void onUpdateSettings({ arrayTiltDeg: v })}
              min={0}
              max={60}
              allowDecimal
              ariaLabel="Array tilt angle in degrees"
              className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <span className="text-[12px] font-semibold text-slate-500">°</span>
            <button
              type="button"
              onClick={() => void onUpdateSettings({ arrayTiltDeg: parseFloat(locLat.toFixed(1)) })}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Match Latitude ({locLat.toFixed(1)}°)
            </button>
          </div>
          <div className="max-w-md pt-0.5">
            <Slider
              min={0}
              max={60}
              step={0.5}
              value={settings.arrayTiltDeg ?? 26.5}
              onChange={(v) => void onUpdateSettings({ arrayTiltDeg: v })}
              tooltip={{ formatter: (val) => `${val}° Tilt` }}
            />
          </div>
        </div>
      </SettingFieldShell>

      <SettingFieldShell
        title="Facing Azimuth (-180° to +180°)"
        description="0° = True South (optimal Northern Hemisphere), -90° = East, +90° = West. Shifts morning vs afternoon sun ramp."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {/* Live Mini-Compass Graphic */}
            <div className="relative w-16 h-16 shrink-0 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-center p-1 shadow-2xs">
              <svg viewBox="0 0 64 64" className="w-full h-full">
                {/* Compass Dial Ring */}
                <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="2 2" />
                <circle cx="32" cy="32" r="22" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                {/* Cardinal Markers */}
                <text x="32" y="10" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#64748b">N</text>
                <text x="32" y="58" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#059669">S</text>
                <text x="56" y="34.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#64748b">E</text>
                <text x="8" y="34.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#64748b">W</text>
                {/* Rotating Needle (0° Azimuth = Points South at bottom) */}
                <g transform={`rotate(${180 + (settings.arrayAzimuthDeg ?? 0)} 32 32)`}>
                  {/* North (back) tail */}
                  <polygon points="32,32 30,39 34,39" fill="#94a3b8" />
                  {/* Active array needle pointing toward orientation */}
                  <polygon points="32,13 29,32 35,32" fill="#10b981" />
                  <circle cx="32" cy="32" r="2.5" fill="#0f172a" />
                </g>
              </svg>
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
                <NumericInput
                  value={settings.arrayAzimuthDeg ?? 0}
                  onChangeValue={(v) => void onUpdateSettings({ arrayAzimuthDeg: Math.round(v) })}
                  min={-180}
                  max={180}
                  allowDecimal={false}
                  commitZeroOnEmpty
                  ariaLabel="Array azimuth in degrees"
                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[12px] font-semibold text-slate-500">°</span>
                <span className="text-[11px] font-bold text-slate-700 truncate">
                  {(settings.arrayAzimuthDeg ?? 0) === 0
                    ? 'True South (Optimal)'
                    : (settings.arrayAzimuthDeg ?? 0) === -45
                    ? 'South-East (Morning Ramp)'
                    : (settings.arrayAzimuthDeg ?? 0) === 45
                    ? 'South-West (Afternoon Ramp)'
                    : (settings.arrayAzimuthDeg ?? 0) === -90
                    ? 'East (Early Morning Peak)'
                    : (settings.arrayAzimuthDeg ?? 0) === 90
                    ? 'West (Late Afternoon Peak)'
                    : `${(settings.arrayAzimuthDeg ?? 0) > 0 ? `+${settings.arrayAzimuthDeg}` : settings.arrayAzimuthDeg}° Orientation`}
                </span>
              </div>
              <div className="pt-0.5 max-w-md">
                <Slider
                  min={-180}
                  max={180}
                  step={5}
                  value={settings.arrayAzimuthDeg ?? 0}
                  onChange={(v) => void onUpdateSettings({ arrayAzimuthDeg: v })}
                  tooltip={{ formatter: (val) => `${val}° Azimuth` }}
                  marks={{
                    '-90': '-90° E',
                    '0': '0° S',
                    '90': '+90° W',
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AZIMUTH_CHIPS.map((c) => {
                  const active = Math.round(settings.arrayAzimuthDeg ?? 0) === c.deg;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => void onUpdateSettings({ arrayAzimuthDeg: c.deg })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                        active
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </SettingFieldShell>

      <SettingFieldShell
        title="PV Cell Chemistry &amp; Mounting Airflow"
        description="Select cell thermal coeff + roof racking ventilation (elevated pergola runs ~4°C cooler than flush RCC concrete)."
        badgeText={settings.panelTechPreset === 'custom' ? 'Custom Tuned' : undefined}
        badgeTone="amber"
      >
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(['mono_perc', 'topcon', 'hjt', 'poly'] as const).map((presetKey) => {
              const p = PANEL_TECH_PRESETS[presetKey];
              const isSelected = settings.panelTechPreset === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => handleSelectTechPreset(presetKey)}
                  className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[12px] font-bold text-slate-900">{p.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">{p.note}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                {
                  id: 'open_rack',
                  label: 'Open Pergola / Elevated',
                  sub: 'Free under-panel airflow (~27°C rise @ 800 W/m²)',
                },
                {
                  id: 'flush_rcc',
                  label: 'Flush on RCC Slab',
                  sub: 'Restricted rear airflow (~31°C rise @ 800 W/m²)',
                },
              ] as const
            ).map((mOpt) => {
              const active = (settings.mountingType ?? 'open_rack') === mOpt.id;
              return (
                <button
                  key={mOpt.id}
                  type="button"
                  onClick={() => void onUpdateSettings({ mountingType: mOpt.id })}
                  className={`text-left px-3 py-2 rounded-xl border transition-all ${
                    active
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[12px] font-bold text-slate-900">{mOpt.label}</div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">{mOpt.sub}</div>
                </button>
              );
            })}
          </div>
        </div>
      </SettingFieldShell>
    </>
  );
};
