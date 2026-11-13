import React, { useEffect } from 'react';
import { Radio, ShieldCheck, X } from 'lucide-react';
import type { CanonicalSolarSnapshot } from '@solar-track/core';

interface SatellitePhysicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  snap: CanonicalSolarSnapshot;
  safeCapacity: number;
  locationName: string;
  todayRadMj: number | null;
  todaySatCumEst: number;
  todaySatFullDayEst: number;
  currentSurfaceLossPct: number;
  shortDateLabel: string;
}

export const SatellitePhysicsModal: React.FC<SatellitePhysicsModalProps> = ({
  isOpen,
  onClose,
  snap,
  safeCapacity,
  locationName,
  todayRadMj,
  todaySatCumEst,
  todaySatFullDayEst,
  currentSurfaceLossPct,
  shortDateLabel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const cityShort = locationName ? locationName.split(',')[0].trim() : 'Solar Site';

  return (
    <div
      className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-w-xl w-full p-6 sm:p-7 space-y-5 text-slate-900 relative my-8 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">Satellite Physics Model</h3>
              <p className="text-xs text-slate-500 font-medium">
                Generated ~{todaySatCumEst.toFixed(1)} kWh so far · Full day est. ~{todaySatFullDayEst.toFixed(1)} kWh ({shortDateLabel})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center gap-2.5 text-xs text-amber-900 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
          <span>Inverter Wi-Fi Dongle is offline · Continuous satellite solar modeling active</span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          While the Wi-Fi dongle is offline, your rooftop Waaree {safeCapacity.toFixed(2)} kWp PERC array is still physically generating electricity and feeding your home and the {cityShort} power grid. SolarTrack computes this real-time estimate using high-resolution solar irradiance physics:
        </p>

        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stage A→B Digital Twin Engine</span>
            <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200/60">
              {snap.config.useCalibratedTwin
                ? `Calibrated Twin · K=${snap.config.kSiteApplied.toFixed(2)}`
                : 'Raw Physics · K=1.00'}
            </span>
          </div>
          <div className="p-3 bg-white rounded-lg border border-slate-200/80 text-center font-semibold text-slate-800 text-xs sm:text-sm">
            Stage A DC (GTI × IAM × Cell Temp × Smog/Soil × K<sub>site</sub>) → Stage B Quadratic Inverter Losses (≤ {snap.config.acInverterCapacityKw.toFixed(2)} kW AC)
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
              <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">GTI Insolation</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{(todayRadMj ?? 0).toFixed(2)} MJ/m²</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{cityShort} Satellite</div>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
              <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">DC Array / AC</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{snap.config.dcCapacityKwp.toFixed(2)} kWp</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {snap.config.acInverterCapacityKw.toFixed(2)} kW AC · {snap.config.mountingType === 'flush_rcc' ? 'Flush' : 'Open'} Mount
              </div>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200/60">
              <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Derated PR</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {snap.effectivePrBreakdown.prPct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {currentSurfaceLossPct >= 0.2 ? `Smog/Cell + ${currentSurfaceLossPct.toFixed(1)}% Soil` : 'Smog + Cell Losses'}
              </div>
            </div>
          </div>
          <div className="text-center text-xs text-slate-700 font-medium pt-1">
            Stage A→B ({snap.config.dcCapacityKwp.toFixed(2)} kWp DC × {snap.effectivePrBreakdown.pr.toFixed(3)} PR) ≈ <span className="text-emerald-700 font-bold text-sm">{todaySatFullDayEst.toFixed(1)} kWh full day</span> · <span className="text-amber-700 font-semibold">~{todaySatCumEst.toFixed(1)} kWh till now</span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900">Zero Silent Uncertainty: </span>
            Waaree inverters accumulate cumulative Monthly and Lifetime generation registers on-device and sync them automatically via Waaree Cloud API whenever Wi-Fi is online — water-filling any unlogged midnight Cloud resets without manual entry. Any ongoing offline outage gaps beyond the last hardware sync timestamp are explicitly estimated using the calibrated Digital Twin.
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
          >
            Understood, Close
          </button>
        </div>
      </div>
    </div>
  );
};
