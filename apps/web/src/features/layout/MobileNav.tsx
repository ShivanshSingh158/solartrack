import React from 'react';
import {
  LayoutGrid,
  TrendingUp,
  ShieldCheck,
  Coins,
  Settings,
} from 'lucide-react';
import type { TabType } from '@solar-track/core';

interface MobileNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onSelectTab }) => {
  const tabs: Array<{ id: TabType; label: string; icon: React.ElementType }> = [
    { id: 'home', label: 'Overview', icon: LayoutGrid },
    { id: 'performance', label: 'Curves', icon: TrendingUp },
    { id: 'health', label: 'Health', icon: ShieldCheck },
    { id: 'savings', label: 'Savings', icon: Coins },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] z-40 px-2 py-1 flex items-center justify-around shadow-xs">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center py-1.5 px-3 rounded-lg transition-colors cursor-pointer ${
              isActive ? 'text-amber-600 font-bold' : 'text-slate-400 font-medium hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
