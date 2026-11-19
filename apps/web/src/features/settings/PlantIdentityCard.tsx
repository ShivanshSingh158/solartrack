import React, { useState } from 'react';
import { LocateFixed, MapPin, RotateCcw, Search, Thermometer } from 'lucide-react';
import { NumericInput } from '../../shared/ui/NumericInput';
import { ApiService } from '../../shared/api/solarApi';
import { INDIAN_SOLAR_PRESETS, getIstClockParts } from '@solar-track/core';
import { SettingFieldShell, type BasePanelProps } from './SettingsShared';

interface PlantIdentityCardProps extends BasePanelProps {
  cloudPlantName: string;
  cloudCapacityKwp: number;
  portalCreatedDate: string;
}

export const PlantIdentityCard: React.FC<PlantIdentityCardProps> = ({
  settings,
  onUpdateSettings,
  canonicalSnapshot,
  cloudPlantName,
  cloudCapacityKwp,
  portalCreatedDate,
}) => {
  const todayYmd = getIstClockParts().ymd;
  const loc = settings.plantLocation || {
    name: canonicalSnapshot.config.locationName,
    lat: canonicalSnapshot.config.lat,
    lon: canonicalSnapshot.config.lon,
  };

  const [editingName, setEditingName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [isLocBusy, setIsLocBusy] = useState(false);

  const persistedName = settings.plantDisplayName || '';
  const nameDraft = editingName ?? persistedName;

  const dcNameplateKwp = settings.dcCapacityKwp ?? settings.systemCapacity ?? 3.0;
  const acInverterKw = settings.acInverterCapacityKw ?? settings.systemCapacity ?? cloudCapacityKwp ?? 3.0;
  const capacityDiffersFromCloud =
    cloudCapacityKwp > 0 && Math.abs(acInverterKw - cloudCapacityKwp) > 0.05;

  const commitDisplayName = () => {
    const trimmed = nameDraft.trim();
    const nextVal = trimmed.length > 0 ? trimmed : null;
    setEditingName(null);
    if (nextVal !== (settings.plantDisplayName || null)) {
      void onUpdateSettings({ plantDisplayName: nextVal });
    }
  };

  const handleSelectLocation = async (nextLoc: { name: string; lat: number; lon: number }) => {
    setSearchStatus(`Updating Open-Meteo coordinates to ${nextLoc.name}...`);
    await onUpdateSettings({ plantLocation: nextLoc });
    setSearchStatus(`Updated rooftop coordinates to ${nextLoc.name}`);
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
      setSearchStatus(`No coordinates found for "${q}". Try another Indian city or PIN.`);
    }
  };

  const handleUseBrowserGps = () => {
    if (!navigator.geolocation) {
      setSearchStatus('Browser geolocation is unavailable.');
      return;
    }
    setIsLocBusy(true);
    setSearchStatus('Requesting GPS fix...');
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

  const portalDateShort =
    portalCreatedDate && /^\d{4}-\d{2}-\d{2}/.test(portalCreatedDate)
      ? portalCreatedDate.slice(0, 10)
      : 'Not reported';

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
          Plant Identity &amp; Rooftop Location
        </h4>
        <span className="text-[11px] font-medium text-slate-400">
          Site Clock: Asia/Kolkata (IST) · Currency: INR ₹
        </span>
      </div>

      <SettingFieldShell
        title="Custom Plant Display Name"
        description={`Shown in the header & audit PDFs. Cloud portal registers "${cloudPlantName || 'Unregistered'}".`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={nameDraft}
            maxLength={64}
            placeholder={cloudPlantName || 'e.g. Rooftop Solar Array'}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={commitDisplayName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.nativeEvent.isComposing || e.keyCode === 229) {
                  return;
                }
                e.currentTarget.blur();
              }
            }}
            className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {nameDraft !== persistedName && (
            <button
              type="button"
              onClick={commitDisplayName}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 transition-colors"
            >
              Apply
            </button>
          )}
          {settings.plantDisplayName && (
            <button
              type="button"
              onClick={() => {
                setEditingName(null);
                void onUpdateSettings({ plantDisplayName: null });
              }}
              className="px-2.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Cloud Name
            </button>
          )}
        </div>
      </SettingFieldShell>

      <SettingFieldShell
        title="Installed Array DC (kWp) &amp; Inverter AC (kW)"
        description={`Specific Yield (kWh/kWp) & Stage A DC optics use DC kWp; Stage B clipping uses AC kW. Portal registers ${cloudCapacityKwp.toFixed(2)} kW AC.`}
        badgeText={
          Math.abs(dcNameplateKwp - acInverterKw) > 0.05
            ? `DC/AC ${(dcNameplateKwp / Math.max(0.1, acInverterKw)).toFixed(2)}x`
            : capacityDiffersFromCloud
              ? `Portal ${cloudCapacityKwp.toFixed(2)} kW`
              : 'Matched'
        }
        badgeTone={
          Math.abs(dcNameplateKwp - acInverterKw) > 0.05
            ? 'emerald'
            : capacityDiffersFromCloud
              ? 'amber'
              : 'emerald'
        }
      >
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Panel DC Nameplate
              </label>
              <div className="flex items-center gap-1.5">
                <NumericInput
                  value={dcNameplateKwp}
                  onChangeValue={(v) => void onUpdateSettings({ dcCapacityKwp: v, systemCapacity: v })}
                  min={0.1}
                  max={1000}
                  allowDecimal
                  ariaLabel="Installed DC nameplate capacity in kWp"
                  className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[12px] font-semibold text-slate-500">kWp DC</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Inverter AC Ceiling
              </label>
              <div className="flex items-center gap-1.5">
                <NumericInput
                  value={acInverterKw}
                  onChangeValue={(v) => void onUpdateSettings({ acInverterCapacityKw: v })}
                  min={0.1}
                  max={1000}
                  allowDecimal
                  ariaLabel="Inverter AC capacity rating in kW"
                  className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[12px] font-semibold text-slate-500">kW AC</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/60 leading-relaxed">
            <span className="font-semibold text-slate-700">Engineering Distinction:</span> DC nameplate (<strong>{dcNameplateKwp.toFixed(2)} kWp</strong>) drives photon capture and solar optics. Inverter AC ceiling (<strong>{acInverterKw.toFixed(2)} kW</strong>) models physical inverter clipping when midday sun produces peak direct sunlight.
          </div>

          {capacityDiffersFromCloud && (
            <button
              type="button"
              onClick={() => void onUpdateSettings({ acInverterCapacityKw: cloudCapacityKwp })}
              className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold hover:bg-amber-100 transition-colors"
            >
              Match AC Rating to Portal ({cloudCapacityKwp.toFixed(2)} kW)
            </button>
          )}
        </div>
      </SettingFieldShell>

      <SettingFieldShell
        title="Commissioning Date Floor"
        description={`Earliest selectable date in Performance calendars & soiling history. Cloud portal date: ${portalDateShort}.`}
        badgeText={settings.commissioningDateOverride ? 'Override Active' : 'Portal Date'}
        badgeTone={settings.commissioningDateOverride ? 'amber' : 'slate'}
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={
              settings.commissioningDateOverride ||
              (portalDateShort !== 'Not reported' ? portalDateShort : '2026-10-28')
            }
            max={todayYmd}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= todayYmd) {
                void onUpdateSettings({ commissioningDateOverride: v });
              }
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-semibold text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {settings.commissioningDateOverride && (
            <button
              type="button"
              onClick={() => void onUpdateSettings({ commissioningDateOverride: null })}
              className="px-2.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Use Portal Date
            </button>
          )}
        </div>
      </SettingFieldShell>

      <SettingFieldShell
        title="Temperature Unit"
        description="Applies to ambient weather, dew point, and modeled cell temperature readouts."
      >
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {(['C', 'F'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => void onUpdateSettings({ tempUnit: unit })}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all ${
                settings.tempUnit === unit
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5" />
              °{unit} {unit === 'C' ? 'Celsius' : 'Fahrenheit'}
            </button>
          ))}
        </div>
      </SettingFieldShell>

      <SettingFieldShell
        title="Rooftop Satellite Coordinates"
        description="Drives Open-Meteo tilted GTI, sunrise/sunset clock, PM10/AQI soiling, and 365-day seasonal archive."
        badgeText={`${loc.lat.toFixed(4)}°N, ${loc.lon.toFixed(4)}°E`}
        badgeTone="emerald"
      >
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{loc.name}</span>
          </div>

          <form onSubmit={handleCitySearch} className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city or pincode (e.g. Lucknow, 208001)"
                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-[12px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLocBusy || !searchQuery.trim()}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Lookup
            </button>
            <button
              type="button"
              disabled={isLocBusy}
              onClick={handleUseBrowserGps}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-[12px] font-semibold hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
            >
              <LocateFixed className="w-3.5 h-3.5 text-emerald-600" />
              My GPS
            </button>
          </form>

          {searchStatus && <p className="text-[11px] font-medium text-emerald-700">{searchStatus}</p>}

          <div className="flex flex-wrap gap-1.5">
            {INDIAN_SOLAR_PRESETS.slice(0, 6).map((preset) => {
              const isActive =
                Math.abs(preset.lat - loc.lat) < 0.02 && Math.abs(preset.lon - loc.lon) < 0.02;
              return (
                <button
                  key={preset.shortName}
                  type="button"
                  onClick={() => void handleSelectLocation(preset)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    isActive
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {preset.shortName}
                </button>
              );
            })}
          </div>
        </div>
      </SettingFieldShell>
    </div>
  );
};
