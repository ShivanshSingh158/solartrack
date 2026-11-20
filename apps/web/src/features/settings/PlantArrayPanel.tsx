import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  LocateFixed,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';
import { NumericInput } from '../../shared/ui/NumericInput';
import { ApiService } from '../../shared/api/solarApi';
import { PANEL_TECH_PRESETS, type PanelTechPresetId, type SolarIntelligenceReport } from '@solar-track/core';
import { SettingFieldShell, type BasePanelProps } from './SettingsShared';

interface PlantArrayPanelProps extends BasePanelProps {
  cloudPlantName: string;
  cloudCapacityKwp: number;
  portalCreatedDate: string;
  intelligenceReport?: SolarIntelligenceReport | null;
}

export const PlantArrayPanel: React.FC<PlantArrayPanelProps> = ({
  settings,
  onUpdateSettings,
  canonicalSnapshot,
  cloudPlantName,
}) => {
  const loc = settings.plantLocation || {
    name: canonicalSnapshot.config.locationName,
    lat: canonicalSnapshot.config.lat,
    lon: canonicalSnapshot.config.lon,
  };

  const [editingName, setEditingName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [isLocBusy, setIsLocBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const persistedName = settings.plantDisplayName || '';
  const nameDraft = editingName ?? persistedName;

  const dcNameplateKwp = settings.dcCapacityKwp ?? settings.systemCapacity ?? 3.27;
  const acInverterKw = settings.acInverterCapacityKw ?? settings.systemCapacity ?? 3.0;

  const commitDisplayName = () => {
    const trimmed = nameDraft.trim();
    const nextVal = trimmed.length > 0 ? trimmed : null;
    setEditingName(null);
    if (nextVal !== (settings.plantDisplayName || null)) {
      void onUpdateSettings({ plantDisplayName: nextVal });
    }
  };

  const handleSelectLocation = async (nextLoc: { name: string; lat: number; lon: number }) => {
    setSearchStatus(`Updating coordinates to ${nextLoc.name}...`);
    await onUpdateSettings({ plantLocation: nextLoc });
    setSearchStatus(`Updated rooftop location to ${nextLoc.name}`);
    setTimeout(() => setSearchStatus(null), 3000);
  };

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setIsLocBusy(true);
    setSearchStatus(null);
    const result = await ApiService.lookupLocation(q);
    setIsLocBusy(false);
    if (result && typeof result.lat === 'number' && typeof result.lon === 'number') {
      await handleSelectLocation({
        name: result.name || q,
        lat: parseFloat(result.lat.toFixed(6)),
        lon: parseFloat(result.lon.toFixed(6)),
      });
      setSearchQuery('');
    } else {
      setSearchStatus(`No coordinates found for "${q}". Try another Indian city.`);
    }
  };

  const handleUseBrowserGps = () => {
    if (!navigator.geolocation) {
      setSearchStatus('Browser geolocation is unavailable.');
      return;
    }
    setIsLocBusy(true);
    setSearchStatus('Requesting GPS location...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lon = parseFloat(pos.coords.longitude.toFixed(6));
        const geo = await ApiService.reverseGeocode(lat, lon);
        setIsLocBusy(false);
        await handleSelectLocation({
          name: geo?.name || `Custom (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`,
          lat,
          lon,
        });
      },
      () => {
        setIsLocBusy(false);
        setSearchStatus('Location permission denied or GPS timed out.');
      },
      { timeout: 8000 },
    );
  };

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
    <div className="p-5 sm:p-6 space-y-6 max-w-3xl">
      {/* 1. PLANT NAME */}
      <SettingFieldShell
        title="Custom Plant Display Name"
        description="Shown in the header, daily solar reports, and printed financial statements."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={nameDraft}
            maxLength={64}
            placeholder={cloudPlantName || 'e.g. My Rooftop Solar'}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={commitDisplayName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                e.currentTarget.blur();
              }
            }}
            className="flex-1 min-w-[240px] max-w-md bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </SettingFieldShell>

      {/* 2. ROOFTOP LOCATION & SATELLITE COORDINATES */}
      <SettingFieldShell
        title="Rooftop Location"
        description="Sets the coordinates used to calculate clear-sky solar potential and satellite weather data."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-800">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{loc.name || 'Kanpur, Uttar Pradesh'}</span>
            <span className="text-[11px] text-slate-400 font-mono">
              ({loc.lat.toFixed(4)}°N, {loc.lon.toFixed(4)}°E)
            </span>
          </div>

          <form onSubmit={handleCitySearch} className="flex flex-wrap items-center gap-2 max-w-lg">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                placeholder="Search city or pincode (e.g. Lucknow, 208001)"
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLocBusy || !searchQuery.trim()}
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              Lookup
            </button>
            <button
              type="button"
              disabled={isLocBusy}
              onClick={handleUseBrowserGps}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <LocateFixed className="w-3.5 h-3.5 text-emerald-600" />
              My GPS
            </button>
          </form>

          {searchStatus && (
            <p className="text-[11.5px] font-medium text-emerald-700">{searchStatus}</p>
          )}
        </div>
      </SettingFieldShell>

      {/* 3. SYSTEM CAPACITY */}
      <SettingFieldShell
        title="Installed System Capacity"
        description="Physical solar panel capacity and maximum AC inverter feed capacity."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Solar Panels (DC kWp)
            </span>
            <div className="flex items-center gap-2">
              <NumericInput
                value={dcNameplateKwp}
                onChangeValue={(v) => void onUpdateSettings({ dcCapacityKwp: v, systemCapacity: v })}
                min={0.5}
                max={500}
                allowDecimal
                ariaLabel="Solar panels DC capacity in kWp"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="text-[12px] font-semibold text-slate-500">kWp</span>
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Inverter Rating (AC kW)
            </span>
            <div className="flex items-center gap-2">
              <NumericInput
                value={acInverterKw}
                onChangeValue={(v) => void onUpdateSettings({ acInverterCapacityKw: v })}
                min={0.5}
                max={500}
                allowDecimal
                ariaLabel="Inverter AC ceiling in kW"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="text-[12px] font-semibold text-slate-500">kW AC</span>
            </div>
          </label>
        </div>
      </SettingFieldShell>

      {/* 4. COLLAPSED ADVANCED PHYSICAL SPECIFICATIONS */}
      <div className="pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="w-full flex items-center justify-between py-2 text-[12px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            Advanced Physical Specifications (Optional)
          </span>
          {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {advancedOpen && (
          <div className="mt-4 space-y-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-600">Module Tilt Angle (°)</span>
                <div className="flex items-center gap-2">
                  <NumericInput
                    value={settings.arrayTiltDeg ?? 26.5}
                    onChangeValue={(v) => void onUpdateSettings({ arrayTiltDeg: v })}
                    min={0}
                    max={60}
                    allowDecimal
                    ariaLabel="Module tilt in degrees"
                    className="w-28 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[12.5px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <span className="text-[12px] text-slate-500">° tilt</span>
                </div>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-bold text-slate-600">Facing Direction (Azimuth °)</span>
                <div className="flex items-center gap-2">
                  <NumericInput
                    value={settings.arrayAzimuthDeg ?? 0}
                    onChangeValue={(v) => void onUpdateSettings({ arrayAzimuthDeg: Math.round(v) })}
                    min={-180}
                    max={180}
                    allowDecimal={false}
                    ariaLabel="Facing azimuth in degrees"
                    className="w-28 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[12.5px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <span className="text-[12px] text-slate-500">
                    {(settings.arrayAzimuthDeg ?? 0) === 0 ? '0° South (Optimal)' : `${settings.arrayAzimuthDeg}°`}
                  </span>
                </div>
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600">Panel Cell Technology</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['mono_perc', 'topcon', 'hjt', 'poly'] as const).map((presetKey) => {
                  const p = PANEL_TECH_PRESETS[presetKey];
                  const isSelected = (settings.panelTechPreset || 'mono_perc') === presetKey;
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => handleSelectTechPreset(presetKey)}
                      className={`px-3 py-2 rounded-xl text-left border text-[11.5px] transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="truncate">{p.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600">Roof Mounting Racking</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'flush_rcc', label: 'Concrete Roof Mount (Flush)' },
                  { id: 'open_rack', label: 'Elevated Pergola Mount' },
                ].map((mOpt) => {
                  const active = (settings.mountingType ?? 'flush_rcc') === mOpt.id;
                  return (
                    <button
                      key={mOpt.id}
                      type="button"
                      onClick={() => void onUpdateSettings({ mountingType: mOpt.id as any })}
                      className={`px-3 py-2 rounded-xl text-left border text-[11.5px] transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {mOpt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
