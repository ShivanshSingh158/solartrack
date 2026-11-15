import React, { useState, useRef } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Check,
  Loader2,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import { ApiService } from '../../shared/api/solarApi';
import { INDIAN_SOLAR_PRESETS } from '@solar-track/core';

interface LocationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationUpdated: (location: { name: string; lat: number; lon: number }) => void;
  currentLocation?: { name: string; lat: number; lon: number };
}

export const LocationEditModal: React.FC<LocationEditModalProps> = ({
  isOpen,
  onClose,
  onLocationUpdated,
  currentLocation,
}) => {
  // Single input for either full coordinates or city name
  const [query, setQuery] = useState(() =>
    currentLocation ? `${currentLocation.lat}, ${currentLocation.lon}` : '',
  );
  const [resolvedLocation, setResolvedLocation] = useState<{
    name: string;
    lat: number;
    lon: number;
    city?: string;
    state?: string;
  } | null>(() => currentLocation || null);

  const [isResolving, setIsResolving] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // Smart Lookup Handler: Handles full coordinates or city search
  const performLookup = async (inputStr: string) => {
    const trimmed = inputStr.trim();
    if (!trimmed) return;

    setIsResolving(true);
    setErrorMsg(null);
    try {
      // Check if user input is coordinates like "28.6139, 77.2090" or "28.6139 77.2090"
      const coordMatch = trimmed.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          setErrorMsg('Invalid coordinates: Latitude must be -90 to 90, Longitude -180 to 180.');
          setIsResolving(false);
          return;
        }

        // Automatic accurate reverse geocoding
        const loc = await ApiService.reverseGeocode(lat, lon);
        if (loc) {
          setResolvedLocation({
            name: loc.name || `Rooftop (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
            lat,
            lon,
            city: loc.city,
            state: loc.state,
          });
        } else {
          setResolvedLocation({
            name: `Rooftop (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
            lat,
            lon,
          });
        }
      } else {
        // Query as city / location search
        const loc = await ApiService.lookupLocation(trimmed);
        if (loc && !isNaN(loc.lat) && !isNaN(loc.lon)) {
          setResolvedLocation(loc);
        } else {
          setErrorMsg('Location not found. Try pasting exact coordinates (latitude, longitude).');
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error resolving location.');
    } finally {
      setIsResolving(false);
    }
  };

  // Debounced auto-resolution when typing or pasting
  const handleInputChange = (val: string) => {
    setQuery(val);
    setErrorMsg(null);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    // If it looks like coordinates, resolve quickly (350ms)
    const looksLikeCoords = /^[-+]?\d{1,2}(?:\.\d+)?[,\s]+[-+]?\d{1,3}/.test(val.trim());
    const delay = looksLikeCoords ? 350 : 700;

    debounceTimerRef.current = setTimeout(() => {
      performLookup(val);
    }, delay);
  };

  // Handle preset selection
  const handleSelectPreset = (preset: { name: string; lat: number; lon: number }) => {
    setQuery(`${preset.lat}, ${preset.lon}`);
    setResolvedLocation(preset);
    setErrorMsg(null);
  };

  // One-Click GPS detection with automatic reverse geocoding
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetectingGps(true);
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const detectedLat = parseFloat(pos.coords.latitude.toFixed(6));
        const detectedLon = parseFloat(pos.coords.longitude.toFixed(6));
        const coordStr = `${detectedLat}, ${detectedLon}`;
        setQuery(coordStr);

        try {
          const loc = await ApiService.reverseGeocode(detectedLat, detectedLon);
          if (loc) {
            setResolvedLocation({
              name: loc.name,
              lat: detectedLat,
              lon: detectedLon,
              city: loc.city,
              state: loc.state,
            });
          } else {
            setResolvedLocation({
              name: `Rooftop (${detectedLat}°N, ${detectedLon}°E)`,
              lat: detectedLat,
              lon: detectedLon,
            });
          }
        } finally {
          setIsDetectingGps(false);
        }
      },
      (err) => {
        setIsDetectingGps(false);
        setErrorMsg(`GPS detection failed: ${err.message}. Please paste coordinates manually.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Save location to backend
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedLocation) {
      setErrorMsg('Please enter valid coordinates or search a location.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const locObj = {
        name: resolvedLocation.name,
        lat: resolvedLocation.lat,
        lon: resolvedLocation.lon,
      };
      await ApiService.updateSettings({ plantLocation: locObj });
      onLocationUpdated(locObj);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update location settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogBackdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md animate-fade-in" />
      <DialogContent className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-2xl rounded-3xl max-w-lg w-full shadow-2xl border border-black/[0.08] overflow-hidden transition-all">
          {/* Apple iOS Style Header */}
          <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold text-gray-900 tracking-tight">
                Rooftop Location
              </DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Syncs Open-Meteo satellite irradiance & weather
              </p>
            </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-xs text-rose-700 leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Unified Smart Input: Paste full coordinates directly */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">
              Enter Coordinates or City
            </label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Paste coordinates (e.g. 28.6139, 77.2090) or city..."
                className="w-full text-xs font-medium pl-10 pr-28 py-3 rounded-2xl border border-gray-200/90 bg-gray-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition num"
                autoFocus
              />
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isDetectingGps}
                title="Auto-detect using browser GPS"
                className="absolute right-2 px-2.5 py-1.5 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 text-[11px] font-semibold text-gray-700 transition flex items-center space-x-1 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                {isDetectingGps ? (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                ) : (
                  <Navigation className="w-3 h-3 text-emerald-600" />
                )}
                <span>GPS</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Tip: Copy & paste latitude and longitude directly from Google Maps.
            </p>
          </div>

          {/* Resolved Location Result Box (Clean iOS Card) */}
          <div className="p-4 rounded-2xl bg-gray-50/90 border border-black/[0.05] transition-all">
            {isResolving ? (
              <div className="flex items-center space-x-2 text-xs text-gray-500 py-1">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Resolving location accurately...</span>
              </div>
            ) : resolvedLocation ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-bold text-gray-900">
                      {resolvedLocation.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Verified</span>
                  </span>
                </div>
                <div className="text-xs text-gray-500 num pl-6 flex items-center space-x-2">
                  <span>Lat: {resolvedLocation.lat.toFixed(6)}° N</span>
                  <span>·</span>
                  <span>Lon: {resolvedLocation.lon.toFixed(6)}° E</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 py-1">
                Paste coordinates or pick a preset below to preview location.
              </div>
            )}
          </div>

          {/* Minimalist iOS Presets (Clean text chips, no bulky pills) */}
          <div className="pt-1">
            <span className="text-[11px] font-semibold text-gray-400 block mb-2">
              Popular Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {INDIAN_SOLAR_PRESETS.map((p) => {
                const isSelected =
                  resolvedLocation &&
                  Math.abs(resolvedLocation.lat - p.lat) < 0.01 &&
                  Math.abs(resolvedLocation.lon - p.lon) < 0.01;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleSelectPreset({ name: p.name, lat: p.lat, lon: p.lon })}
                    className={`px-3 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700 font-medium'
                    }`}
                  >
                    {p.name.split(',')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons (Apple iOS Style) */}
          <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !resolvedLocation}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-black transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Set Location</span>
                </>
              )}
            </button>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
