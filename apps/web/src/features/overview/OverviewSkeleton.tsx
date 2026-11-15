import React from 'react';

/**
 * Premium Apple-grade Skeleton Screen for Overview Tab.
 * Matches exact pixel dimensions of the live dashboard to eliminate Cumulative Layout Shift (CLS)
 * and prevent UI jumping / jitter during refresh.
 */
export const OverviewSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-5 animate-in fade-in duration-150 select-none font-sans">
      {/* 1. Hero Atmosphere & Satellite Map Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-4 min-h-[296px]">
        {/* Atmosphere Hero Card Skeleton */}
        <div className="rounded-3xl p-6 sm:p-7 apple-glass-static min-h-[296px] flex flex-col justify-between relative overflow-hidden skeleton-shimmer-box border border-white/70">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 rounded-full bg-slate-200/80" />
            <div className="h-4 w-36 rounded-full bg-slate-200/60" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center my-auto py-4">
            <div className="md:col-span-6 space-y-3">
              <div className="h-12 w-40 rounded-2xl bg-slate-300/60" />
              <div className="h-5 w-24 rounded-full bg-slate-200/70" />
              <div className="h-3.5 w-48 rounded-full bg-slate-200/50 mt-2" />
            </div>

            <div className="md:col-span-6 flex justify-end">
              <div className="h-24 w-56 rounded-2xl bg-white/60 border border-slate-200/60 p-4 space-y-2 hidden md:block">
                <div className="h-6 w-20 rounded-lg bg-slate-200/70" />
                <div className="h-3.5 w-32 rounded-full bg-slate-200/50" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="h-3 w-32 rounded-full bg-slate-200/50" />
            <div className="h-3 w-28 rounded-full bg-slate-200/50" />
          </div>
        </div>

        {/* Satellite Plant Map Skeleton */}
        <div className="rounded-3xl p-5 apple-glass-static min-h-[296px] hidden lg:flex flex-col justify-between relative overflow-hidden skeleton-shimmer-box border border-white/70">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 rounded-full bg-slate-200/70" />
            <div className="h-5 w-24 rounded-full bg-slate-200/70" />
          </div>
          <div className="w-16 h-16 rounded-full bg-slate-200/50 mx-auto" />
          <div className="h-3.5 w-32 rounded-full bg-slate-200/50 mx-auto" />
        </div>
      </div>

      {/* 2. Standby / Alert Strip Skeleton */}
      <div className="h-11 rounded-2xl apple-glass-card p-3 flex items-center justify-between skeleton-shimmer-box border border-white/70">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-slate-300" />
          <div className="h-3.5 w-64 rounded-full bg-slate-200/70" />
        </div>
        <div className="h-3.5 w-28 rounded-full bg-slate-200/50" />
      </div>

      {/* 3. 4-Column KPI Metric Strip Skeleton */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 apple-glass-card rounded-2xl flex flex-col justify-between min-h-[162px] relative overflow-hidden skeleton-shimmer-box border border-white/70"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 rounded-full bg-slate-200/70" />
              <div className="h-4 w-16 rounded-full bg-slate-200/60" />
            </div>

            <div className="my-3 space-y-1.5">
              <div className="h-8 w-28 rounded-xl bg-slate-300/70" />
              <div className="h-3.5 w-20 rounded-full bg-slate-200/60" />
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="h-1.5 w-full rounded-full bg-slate-200/60" />
              <div className="flex justify-between items-center text-[10px]">
                <div className="h-2.5 w-20 rounded-full bg-slate-200/50" />
                <div className="h-2.5 w-16 rounded-full bg-slate-200/50" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* 4. Generation Curve & Sidebar Cards Skeleton */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Chart Card Skeleton */}
        <div className="lg:col-span-8 p-6 apple-glass-card rounded-3xl min-h-[380px] flex flex-col justify-between relative overflow-hidden skeleton-shimmer-box border border-white/70">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100/80">
            <div className="space-y-1.5">
              <div className="h-5 w-48 rounded-lg bg-slate-300/70" />
              <div className="h-3.5 w-64 rounded-full bg-slate-200/50" />
            </div>
            <div className="h-7 w-32 rounded-xl bg-slate-200/60" />
          </div>

          <div className="h-44 w-full rounded-2xl bg-slate-100/60 my-auto flex items-center justify-center">
            <div className="w-full h-24 border-b border-dashed border-slate-300/60" />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100/80">
            <div className="h-3 w-28 rounded-full bg-slate-200/50" />
            <div className="h-3 w-36 rounded-full bg-slate-200/50" />
          </div>
        </div>

        {/* Sidebar Cards Skeleton */}
        <div className="lg:col-span-4 flex flex-col space-y-5">
          <div className="p-5 apple-glass-card rounded-2xl min-h-[175px] flex flex-col justify-between relative overflow-hidden skeleton-shimmer-box border border-white/70">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 rounded-full bg-slate-200/70" />
              <div className="h-6 w-16 rounded-lg bg-slate-200/60" />
            </div>
            <div className="h-7 w-28 rounded-lg bg-slate-300/70 my-2" />
            <div className="h-3 w-40 rounded-full bg-slate-200/50" />
          </div>

          <div className="p-5 apple-glass-card rounded-2xl min-h-[190px] flex flex-col justify-between relative overflow-hidden skeleton-shimmer-box border border-white/70">
            <div className="flex items-center justify-between">
              <div className="h-4 w-36 rounded-full bg-slate-200/70" />
              <div className="h-4 w-12 rounded-full bg-slate-200/60" />
            </div>
            <div className="h-8 w-32 rounded-lg bg-slate-300/70 my-2" />
            <div className="h-3 w-48 rounded-full bg-slate-200/50" />
          </div>
        </div>
      </section>
    </div>
  );
};
