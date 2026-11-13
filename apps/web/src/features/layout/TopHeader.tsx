import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import type { Account, NewWaareePacketEvent, TabType } from '@solar-track/core';
import { HeaderSyncPopover, type SyncMetaBarInfo } from './HeaderSyncPopover';
import { HeaderAccountMenu } from './HeaderAccountMenu';

interface TopHeaderProps {
  title: string;
  subtitle: string;
  capacityText: string;
  lastUpdateText: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  locationName?: string;
  onOpenLocationEdit?: () => void;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  accounts: Account[];
  activeContext: string;
  onSelectContext: (ctx: string) => void;
  onOpenAddAccount?: () => void;
  onOpenCatalog?: () => void;
  tariffPerKwh?: number;
  liveKw?: number;
  estimatedKw?: number;
  isEstimatedLive?: boolean;
  isNight?: boolean;
  alertsEnabled?: boolean;
  onToggleAlerts?: () => void;
  latestNewData?: NewWaareePacketEvent | null;
  syncStatusText?: string;
  syncMeta?: SyncMetaBarInfo | null;
  onLogout?: () => void;
}

const NAV_TABS: Array<{ id: TabType; label: string }> = [
  { id: 'home', label: 'Overview' },
  { id: 'performance', label: 'Generation History' },
  { id: 'health', label: 'System Health' },
  { id: 'savings', label: 'Savings & Credits' },
  { id: 'settings', label: 'Settings' },
];

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  locationName = '',
  onOpenLocationEdit,
  activeTab,
  onSelectTab,
  accounts,
  activeContext,
  onSelectContext,
  onOpenAddAccount,
  capacityText,
  onRefresh,
  isRefreshing,
  lastUpdateText,
  tariffPerKwh = 8.0,
  liveKw = 0,
  isEstimatedLive = false,
  isNight = false,
  alertsEnabled = false,
  onToggleAlerts,
  latestNewData = null,
  syncStatusText,
  syncMeta = null,
  onLogout,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });
  const [hasTransition, setHasTransition] = useState(false);

  const updateIndicator = useCallback(() => {
    const container = tabsContainerRef.current;
    const currentTabEl = tabRefs.current.get(activeTab);
    if (!container || !currentTabEl) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = currentTabEl.getBoundingClientRect();
    setIndicatorStyle({
      left: tabRect.left - containerRect.left,
      top: tabRect.top - containerRect.top,
      width: tabRect.width,
      height: tabRect.height,
      ready: true,
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    updateIndicator();
    const animTimer = setTimeout(() => setHasTransition(true), 60);
    window.addEventListener('resize', updateIndicator);
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(updateIndicator);
    }
    return () => {
      clearTimeout(animTimer);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [updateIndicator]);

  const handleTabClick = (tabId: TabType) => {
    const container = tabsContainerRef.current;
    const targetTabEl = tabRefs.current.get(tabId);
    if (container && targetTabEl) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = targetTabEl.getBoundingClientRect();
      setIndicatorStyle({
        left: tabRect.left - containerRect.left,
        top: tabRect.top - containerRect.top,
        width: tabRect.width,
        height: tabRect.height,
        ready: true,
      });
      setHasTransition(true);
    }
    onSelectTab(tabId);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) setIsProfileOpen(false);
      if (syncRef.current && !syncRef.current.contains(target)) setIsSyncOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
        setIsSyncOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const allPlants = React.useMemo(() => {
    const raw = accounts.flatMap((a) => a.plants || []);
    const seen = new Set<string>();
    return raw.filter((p) => {
      if (!p.stationID || seen.has(p.stationID)) return false;
      seen.add(p.stationID);
      return true;
    });
  }, [accounts]);
  const isMultiPlant = allPlants.length >= 2;
  const isCombined = isMultiPlant && activeContext === 'combined';
  const activePlant = allPlants.find((p) => p.stationID === activeContext) || allPlants[0];
  const isGenerating = !isEstimatedLive && liveKw > 0.05;

  return (
    <nav
      aria-label="Primary Navigation"
      className="sticky top-3 z-50 flex justify-center w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-7 mt-3 mb-3 select-none font-sans"
    >
      <div className="relative isolate flex items-center justify-between gap-4 sm:gap-6 w-full h-[54px] sm:h-[56px] rounded-full px-5 sm:px-6 transition-all duration-300">
        <div
          aria-hidden="true"
          className={`absolute inset-0 -z-10 overflow-hidden rounded-full transition-all duration-300 border ${
            isScrolled ? 'bg-white/90 border-slate-200/95' : 'bg-white/95 border-slate-200/90'
          }`}
          style={{
            backdropFilter: isScrolled ? 'blur(24px) saturate(1.9)' : 'blur(20px) saturate(1.8)',
            WebkitBackdropFilter: isScrolled ? 'blur(24px) saturate(1.9)' : 'blur(20px) saturate(1.8)',
            boxShadow: isScrolled
              ? 'inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 12px 36px -6px rgba(15, 23, 42, 0.14)'
              : 'inset 0 1px 0 rgba(255, 255, 255, 1), 0 8px 30px -4px rgba(15, 23, 42, 0.06)',
          }}
        />

        <div
          onClick={() => handleTabClick('home')}
          className="flex items-center gap-2.5 group cursor-pointer select-none shrink-0"
          title="SolarTrack Overview"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b] group-hover:scale-125 transition-transform shrink-0" />
          <span className="text-xs font-black text-slate-900 tracking-[0.22em] uppercase font-sans whitespace-nowrap">
            <span className="sm:hidden">S T</span>
            <span className="hidden sm:inline">SOLARTRACK</span>
          </span>
        </div>

        <div
          ref={tabsContainerRef}
          role="tablist"
          aria-label="Navigation Tabs"
          className="relative hidden md:flex items-center gap-1.5 shrink-0"
        >
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 rounded-full bg-slate-100/90 border border-slate-200/80 shadow-2xs pointer-events-none will-change-transform"
            style={{
              transform: `translate3d(${indicatorStyle.left}px, ${indicatorStyle.top}px, 0)`,
              width: `${indicatorStyle.width}px`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.ready ? 1 : 0,
              transition: hasTransition
                ? 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), width 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 150ms ease'
                : 'opacity 150ms ease',
            }}
          />

          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                  else tabRefs.current.delete(tab.id);
                }}
                onClick={() => handleTabClick(tab.id)}
                className={`relative z-10 rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer select-none whitespace-nowrap transition-colors duration-200 ${
                  isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <HeaderSyncPopover
            syncRef={syncRef}
            isSyncOpen={isSyncOpen}
            onToggleOpen={() => {
              setIsSyncOpen((prev) => !prev);
              setIsProfileOpen(false);
            }}
            onClose={() => setIsSyncOpen(false)}
            plantName={activePlant?.plantName || 'Solar Station'}
            capacityText={capacityText}
            locationName={locationName}
            lastUpdateText={lastUpdateText}
            syncStatusText={syncStatusText}
            syncMeta={syncMeta}
            isRefreshing={isRefreshing}
            isGenerating={isGenerating}
            isNight={isNight}
            alertsEnabled={alertsEnabled}
            latestNewData={latestNewData}
            onRefresh={onRefresh}
            onToggleAlerts={onToggleAlerts}
            onOpenLocationEdit={onOpenLocationEdit}
          />

          <HeaderAccountMenu
            profileRef={profileRef}
            isProfileOpen={isProfileOpen}
            onToggleOpen={() => {
              setIsProfileOpen((prev) => !prev);
              setIsSyncOpen(false);
            }}
            onClose={() => setIsProfileOpen(false)}
            title={title}
            locationName={locationName}
            tariffPerKwh={tariffPerKwh}
            lastUpdateText={lastUpdateText}
            isGenerating={isGenerating}
            isNight={isNight}
            allPlants={allPlants}
            isMultiPlant={isMultiPlant}
            isCombined={isCombined}
            activePlant={activePlant}
            activeContext={activeContext}
            onSelectContext={onSelectContext}
            onOpenLocationEdit={onOpenLocationEdit}
            onOpenAddAccount={onOpenAddAccount}
            onLogout={onLogout}
          />

          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-slate-50 text-slate-700 md:hidden hover:bg-slate-100 transition"
          >
            {isMobileMenuOpen ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <span className="relative block h-2.5 w-3.5">
                <span className="absolute left-0 top-0 block h-0.5 w-3.5 bg-slate-700 rounded-full" />
                <span className="absolute left-0 bottom-0 block h-0.5 w-3.5 bg-slate-700 rounded-full" />
              </span>
            )}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-x-4 top-[74px] md:hidden rounded-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 bg-white/98 border border-slate-200/90 shadow-2xl"
          style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        >
          <div className="flex flex-col space-y-1">
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    onSelectTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`px-3 py-2 text-left rounded-xl text-xs font-semibold transition ${
                    isActive ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};
