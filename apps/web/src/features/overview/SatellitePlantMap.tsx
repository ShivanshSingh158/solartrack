import React, { useEffect, useRef } from 'react';
import { Crosshair } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SatellitePlantMapProps {
  coords: { lat: number; lon: number };
  onOpenLocationEdit?: () => void;
}

export const SatellitePlantMap: React.FC<SatellitePlantMapProps> = ({
  coords,
  onOpenLocationEdit,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lon],
        zoom: 18,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
        doubleClickZoom: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const tileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, maxNativeZoom: 18 }
      ).addTo(map);

      activeTileLayerRef.current = tileLayer;

      const markerGroup = L.layerGroup().addTo(map);
      markerGroupRef.current = markerGroup;

      const solarPinIcon = L.divIcon({
        className: 'solar-rooftop-pin-container',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="solar-rooftop-target-ring"></div>
            <div class="w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-lg animate-ping"></div>
            <div class="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-lg absolute"></div>
          </div>
        `,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      });

      L.marker([coords.lat, coords.lon], { icon: solarPinIcon }).addTo(markerGroup);
      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([coords.lat, coords.lon], 18);
    }
  }, [coords.lat, coords.lon]);

  return (
    <div className="rounded-[20px] overflow-hidden relative h-full min-h-[296px] shadow-sm border border-slate-200/90 bg-slate-950 flex flex-col isolate">
      <div className="absolute top-3 left-3 z-20 flex items-center pointer-events-none">
        <div className="px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md shadow-xs flex items-center space-x-1.5 pointer-events-auto border border-white/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-[11px] text-white tracking-wide">Solar Satellite</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (mapInstanceRef.current && coords) {
            mapInstanceRef.current.flyTo([coords.lat, coords.lon], 18, { animate: true, duration: 1 });
          }
          onOpenLocationEdit?.();
        }}
        className="absolute top-3 right-3 z-20 px-3 py-1 rounded-full bg-slate-950/85 hover:bg-slate-900 backdrop-blur-md shadow-xs flex items-center space-x-1.5 border border-white/20 hover:border-sky-400 text-white hover:text-sky-300 text-[11px] font-bold tracking-wide transition cursor-pointer select-none group"
        title="Locate array coordinates on rooftop satellite"
      >
        <Crosshair className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" strokeWidth={2} />
        <span>Locate Plant</span>
      </button>

      <div ref={mapContainerRef} className="w-full h-full flex-1 min-h-[296px] z-10" />
    </div>
  );
};
