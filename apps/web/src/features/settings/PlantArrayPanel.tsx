import React from 'react';
import { Sparkles } from 'lucide-react';
import type { SolarIntelligenceReport } from '@solar-track/core';
import type { BasePanelProps } from './SettingsShared';
import { PlantIdentityCard } from './PlantIdentityCard';
import { ArrayGeometryCard } from './ArrayGeometryCard';
import { InverterTwinCard } from './InverterTwinCard';

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
  cloudCapacityKwp,
  portalCreatedDate,
  intelligenceReport,
}) => {
  const effPr = canonicalSnapshot.effectivePrBreakdown;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
      <PlantIdentityCard
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        canonicalSnapshot={canonicalSnapshot}
        cloudPlantName={cloudPlantName}
        cloudCapacityKwp={cloudCapacityKwp}
        portalCreatedDate={portalCreatedDate}
      />

      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
            Array Geometry &amp; Cell Physics Model
          </h4>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
            <Sparkles className="w-3 h-3" />
            Live Eff PR: {(effPr.pr * 100).toFixed(1)}%
          </span>
        </div>

        <ArrayGeometryCard
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          canonicalSnapshot={canonicalSnapshot}
        />

        <InverterTwinCard
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          canonicalSnapshot={canonicalSnapshot}
          intelligenceReport={intelligenceReport}
        />
      </div>
    </div>
  );
};
