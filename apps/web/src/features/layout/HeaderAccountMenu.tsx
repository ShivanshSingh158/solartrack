import React from 'react';
import { Check, ChevronDown, Layers, LogOut, MapPin, Plus, Zap } from 'lucide-react';
import type { Plant } from '@solar-track/core';

interface HeaderAccountMenuProps {
  profileRef: React.RefObject<HTMLDivElement | null>;
  isProfileOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  title: string;
  locationName: string;
  tariffPerKwh: number;
  lastUpdateText: string;
  isGenerating: boolean;
  isNight: boolean;
  allPlants: Plant[];
  isMultiPlant: boolean;
  isCombined: boolean;
  activePlant?: Plant;
  activeContext: string;
  onSelectContext: (ctx: string) => void;
  onOpenLocationEdit?: () => void;
  onOpenAddAccount?: () => void;
  onLogout?: () => void;
}

export const HeaderAccountMenu: React.FC<HeaderAccountMenuProps> = ({
  profileRef,
  isProfileOpen,
  onToggleOpen,
  onClose,
  title,
  locationName,
  tariffPerKwh,
  lastUpdateText,
  isGenerating,
  isNight,
  allPlants,
  isMultiPlant,
  isCombined,
  activePlant,
  activeContext,
  onSelectContext,
  onOpenLocationEdit,
  onOpenAddAccount,
  onLogout,
}) => {
  const profileInitials =
    title
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'SP';

  return (
    <div className="relative" ref={profileRef}>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={isProfileOpen}
        className="flex items-center gap-1.5 p-0.5 pr-1.5 rounded-full border border-slate-200/85 hover:border-slate-300 bg-white transition cursor-pointer shadow-2xs group"
        title={`Account & Plant Settings (${title})`}
      >
        <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[11px] tracking-tight">
          <span>{profileInitials}</span>
        </div>
        <ChevronDown
          className="w-3 h-3 text-slate-400 group-hover:text-slate-700 transition"
          strokeWidth={2}
        />
      </button>

      {isProfileOpen && (
        <div
          className="absolute right-0 mt-3 w-80 rounded-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 bg-white/98 border border-slate-200/90 shadow-2xl"
          style={{
            backdropFilter: 'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          }}
        >
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {profileInitials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-bold text-slate-900 text-sm truncate">{title}</p>
              <div className="flex items-center text-[11px] text-slate-500 truncate mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400 mr-1 shrink-0" />
                <span className="truncate">{locationName}</span>
              </div>
            </div>
          </div>

          <div className="my-2.5 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Active Array
              </span>
              <span className="font-bold text-slate-800">
                {isCombined ? 'Combined Fleet' : activePlant?.plantName || 'Solar Station'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                DISCOM Tariff
              </span>
              <span className="font-bold text-emerald-600 num">₹{tariffPerKwh.toFixed(2)}/kWh</span>
            </div>
          </div>

          {allPlants.length > 0 && (
            <div className="mb-2">
              <div className="px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Switch Solar Plant
              </div>
              {isMultiPlant && (
                <button
                  onClick={() => {
                    onSelectContext('combined');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition cursor-pointer mb-1 ${
                    activeContext === 'combined'
                      ? 'bg-amber-50 text-amber-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-semibold">Combined Fleet Overview</span>
                  </div>
                  {activeContext === 'combined' && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                </button>
              )}
              {allPlants.map((plant) => {
                const isCurrent =
                  !isCombined && (activeContext === plant.stationID || allPlants.length === 1);
                return (
                  <button
                    key={plant.stationID}
                    onClick={() => {
                      onSelectContext(plant.stationID);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-50/70 text-amber-950 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate font-semibold text-slate-900">{plant.plantName}</span>
                    </div>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="my-1.5 border-t border-slate-100" />

          <div className="space-y-0.5">
            {onOpenLocationEdit && (
              <button
                onClick={() => {
                  onClose();
                  onOpenLocationEdit();
                }}
                className="w-full flex items-center space-x-2.5 p-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Change Plant Location</span>
              </button>
            )}

            {onOpenAddAccount && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAddAccount();
                }}
                className="w-full flex items-center space-x-2.5 p-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-400" />
                <span>Connect New Waaree Plant</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full flex items-center space-x-2.5 p-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50/90 transition cursor-pointer group"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500 group-hover:text-rose-600 transition" />
                <span>Log Out &amp; Lock System</span>
              </button>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 px-1">
            <div className="flex items-center space-x-1">
              <Zap className={`w-3 h-3 ${isGenerating ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span>
                {isGenerating
                  ? 'Waaree Inverter Online'
                  : isNight
                    ? 'Inverter Night Standby'
                    : 'Waaree Wi-Fi Offline'}
              </span>
            </div>
            <span className="truncate">{lastUpdateText || 'Telemetry Synced'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
