import React, { useState, useMemo } from 'react';
import {
  Droplets,
  Trash2,
  Plus,
  CloudRain,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { NumericInput } from '../../shared/ui/NumericInput';
import { ApiService } from '../../shared/api/solarApi';
import {
  buildSystemHealthReport,
  getIstClockParts,
  type LiveFlowData,
  type SolarIntelligenceReport,
  type SolarWeatherResponse,
} from '@solar-track/core';
import { SettingSwitch, type BasePanelProps } from './SettingsShared';

interface AlertsSoilingPanelProps extends BasePanelProps {
  stationId: string;
  intelligenceReport: SolarIntelligenceReport | null;
  onIntelligenceReportChange: (report: SolarIntelligenceReport) => void;
  weatherData: SolarWeatherResponse | null;
  todayRawSeries?: any[];
  liveFlow?: LiveFlowData | null;
}

export const AlertsSoilingPanel: React.FC<AlertsSoilingPanelProps> = ({
  settings,
  onUpdateSettings,
  canonicalSnapshot,
  stationId,
  intelligenceReport,
  onIntelligenceReportChange,
  weatherData,
  todayRawSeries,
  liveFlow,
}) => {
  const todayYmd = getIstClockParts().ymd;
  const minDateYmd = canonicalSnapshot.config.commissioningYmd || '2026-10-28';

  const [washDateInput, setWashDateInput] = useState<string>(todayYmd);
  const [washNoteInput, setWashNoteInput] = useState<string>('');
  const [isWashBusy, setIsWashBusy] = useState(false);
  const [washFeedback, setWashFeedback] = useState<string | null>(null);

  const healthReport = useMemo(
    () =>
      buildSystemHealthReport({
        canonicalSnapshot,
        todayRaw: todayRawSeries || [],
        liveFlow: liveFlow || null,
        weatherData,
        intelligenceReport,
        settings,
      }),
    [canonicalSnapshot, todayRawSeries, liveFlow, weatherData, intelligenceReport, settings],
  );

  const guardByKey = useMemo(() => {
    const map = new Map<string, (typeof healthReport.guards)[number]>();
    for (const g of healthReport.guards) map.set(g.key, g);
    return map;
  }, [healthReport]);

  const handleLogWash = async (targetYmd: string, noteText?: string) => {
    const safeYmd = /^\d{4}-\d{2}-\d{2}$/.test(targetYmd) ? targetYmd : todayYmd;
    const clampedYmd = safeYmd > todayYmd ? todayYmd : safeYmd < minDateYmd ? minDateYmd : safeYmd;
    setIsWashBusy(true);
    setWashFeedback(null);
    const res = await ApiService.markPanelsCleaned(clampedYmd, noteText?.trim() || undefined, 'add');
    if (res) {
      await onUpdateSettings({
        cleaningEvents: res.cleaningEvents || [],
        lastCleanedDate: res.lastCleanedDate || null,
      });
      setWashNoteInput('');
      setWashFeedback(`Logged panel wash on ${clampedYmd}`);
      const refreshedIntel = await ApiService.getSolarIntelligence(stationId, true);
      if (refreshedIntel?.report) onIntelligenceReportChange(refreshedIntel.report);
      setTimeout(() => setWashFeedback(null), 3000);
    } else {
      setWashFeedback('Failed to save panel wash event.');
    }
    setIsWashBusy(false);
  };

  const handleRemoveWash = async (targetYmd: string) => {
    setIsWashBusy(true);
    setWashFeedback(null);
    const res = await ApiService.markPanelsCleaned(targetYmd, undefined, 'remove');
    if (res) {
      await onUpdateSettings({
        cleaningEvents: res.cleaningEvents || [],
        lastCleanedDate: res.lastCleanedDate || null,
      });
      setWashFeedback(`Removed wash entry for ${targetYmd}`);
      const refreshedIntel = await ApiService.getSolarIntelligence(stationId, true);
      if (refreshedIntel?.report) onIntelligenceReportChange(refreshedIntel.report);
      setTimeout(() => setWashFeedback(null), 3000);
    }
    setIsWashBusy(false);
  };

  const cleaningEventsDesc = useMemo(() => {
    return Array.isArray(settings.cleaningEvents)
      ? settings.cleaningEvents.toSorted((a, b) => b.ymd.localeCompare(a.ymd))
      : [];
  }, [settings.cleaningEvents]);

  const renderGuardBadge = (guardKey?: string, isArmedFallback = false) => {
    const g = guardKey ? guardByKey.get(guardKey) : undefined;
    const state = g ? g.liveState : isArmedFallback ? 'Normal' : 'Muted';
    const cls =
      state === 'Triggered'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : state === 'Normal'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-100 text-slate-500 border-slate-200';
    return (
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
        {state === 'Triggered' ? 'Triggered' : state === 'Normal' ? 'Active' : 'Disabled'}
      </span>
    );
  };

  return (
    <div className="p-5 sm:p-6 space-y-6 max-w-3xl">
      {/* SECTION 1: SYSTEM ALERT GUARDS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            System Alert Guards
          </h4>
          <span className="text-[11px] font-semibold text-slate-400">
            Automated Protection
          </span>
        </div>

        <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
          {/* 1. Offline Delay Watchdog */}
          <div className="py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">Inverter Offline Warning</span>
                {renderGuardBadge('offline', settings.alertOfflineDelay)}
              </div>
              <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
                Alerts you when the solar inverter stops uploading data during daylight hours.
              </p>
              {settings.alertOfflineDelay && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Notify after:</span>
                  <NumericInput
                    value={settings.offlineDelayMinutes ?? 30}
                    onChangeValue={(v) =>
                      void onUpdateSettings({ offlineDelayMinutes: Math.min(240, Math.max(5, Math.round(v))) })
                    }
                    min={5}
                    max={240}
                    allowDecimal={false}
                    ariaLabel="Offline delay threshold in minutes"
                    className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[12px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-[11.5px] text-slate-500">minutes of silence</span>
                </div>
              )}
            </div>
            <SettingSwitch
              checked={settings.alertOfflineDelay}
              onChange={(v) => void onUpdateSettings({ alertOfflineDelay: v })}
              ariaLabel="Toggle offline delay watchdog"
            />
          </div>

          {/* 2. Morning Sun Wake Check */}
          <div className="py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">Morning Sunrise Wake-Up Check</span>
                {renderGuardBadge('morning', settings.alertMorningYield)}
              </div>
              <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
                Verifies that your solar plant powers on and connects to the grid each morning after sunrise.
              </p>
            </div>
            <SettingSwitch
              checked={settings.alertMorningYield}
              onChange={(v) => void onUpdateSettings({ alertMorningYield: v })}
              ariaLabel="Toggle morning production wake check"
            />
          </div>

          {/* 3. Grid Safety & Power Cut Watchdog */}
          <div className="py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">Power Cut &amp; Grid Outage Alert</span>
                {renderGuardBadge('voltage', settings.alertVoltageSpike)}
              </div>
              <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
                Detects when your inverter pauses due to a neighborhood electricity power cut.
              </p>
            </div>
            <SettingSwitch
              checked={settings.alertVoltageSpike}
              onChange={(v) => void onUpdateSettings({ alertVoltageSpike: v })}
              ariaLabel="Toggle grid power cut watchdog"
            />
          </div>

          {/* 4. Underperformance Guard */}
          <div className="py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">Underperformance Warning</span>
                {renderGuardBadge('underperf', settings.alertUnderperformance)}
              </div>
              <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">
                Notifies you if actual solar generation drops significantly below clear-sky weather expectations.
              </p>
              {settings.alertUnderperformance && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Minimum expected capture:</span>
                  <NumericInput
                    value={settings.underperformanceThresholdPct ?? 82}
                    onChangeValue={(v) =>
                      void onUpdateSettings({ underperformanceThresholdPct: Math.min(99, Math.max(50, Math.round(v))) })
                    }
                    min={50}
                    max={99}
                    allowDecimal={false}
                    ariaLabel="Underperformance alert minimum capture percent"
                    className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[12px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-[11.5px] text-slate-500">% of expected model</span>
                </div>
              )}
            </div>
            <SettingSwitch
              checked={settings.alertUnderperformance}
              onChange={(v) => void onUpdateSettings({ alertUnderperformance: v })}
              ariaLabel="Toggle underperformance guard"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: PANEL CLEANING & MAINTENANCE TRACKER */}
      <div className="pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-sky-600" />
              Panel Cleaning &amp; Maintenance Log
            </h4>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Current estimated surface dust loss: <strong className="text-slate-800 tabular-nums">{canonicalSnapshot.soiling.surfaceLossPct.toFixed(1)}%</strong>
            </p>
          </div>

          <button
            type="button"
            disabled={isWashBusy}
            onClick={() => handleLogWash(todayYmd, 'Cleaned today')}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-[12px] font-bold hover:bg-emerald-800 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Log Cleaning Today
          </button>
        </div>

        {/* Cleaning Sensitivity Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-3">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Wash Recommended Trigger (%)
            </label>
            <div className="flex items-center gap-2">
              <NumericInput
                value={settings.washRecommendPct ?? 7.0}
                onChangeValue={(v) => void onUpdateSettings({ washRecommendPct: v })}
                min={1}
                max={25}
                allowDecimal
                ariaLabel="Soiling wash recommend threshold percent"
                className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[12px] font-bold text-slate-900 tabular-nums"
              />
              <div className="flex gap-1">
                {[5, 7, 10].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => void onUpdateSettings({ washRecommendPct: pct })}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                      Math.abs((settings.washRecommendPct ?? 7) - pct) < 0.1
                        ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-3">
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-700 mb-1">
              <CloudRain className="w-3 h-3 text-sky-600" />
              Auto Rain Clean Reset (mm/day)
            </label>
            <div className="flex items-center gap-2">
              <NumericInput
                value={settings.rainResetDailyMm ?? 5.0}
                onChangeValue={(v) => void onUpdateSettings({ rainResetDailyMm: v })}
                min={0.5}
                max={30}
                allowDecimal
                ariaLabel="Daily rain auto-clean reset threshold in mm"
                className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[12px] font-bold text-slate-900 tabular-nums"
              />
              <div className="flex gap-1">
                {[3, 5, 8].map((mm) => (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => void onUpdateSettings({ rainResetDailyMm: mm })}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                      Math.abs((settings.rainResetDailyMm ?? 5) - mm) < 0.1
                        ? 'bg-sky-50 border-sky-300 font-bold text-sky-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {mm}mm
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Manual Wash Form */}
        <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2 mb-4">
          <span className="text-[11px] font-bold text-slate-700 block">Record Past Cleaning Date</span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={washDateInput}
              min={minDateYmd}
              max={todayYmd}
              onChange={(e) => setWashDateInput(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[12px] font-bold text-slate-800"
            />
            <input
              type="text"
              value={washNoteInput}
              placeholder="Optional note (e.g. sponge rinse, hose)"
              onChange={(e) => setWashNoteInput(e.target.value)}
              className="flex-1 min-w-[180px] bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[12px] text-slate-800"
            />
            <button
              type="button"
              disabled={isWashBusy}
              onClick={() => handleLogWash(washDateInput, washNoteInput)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Wash
            </button>
          </div>
          {washFeedback && (
            <p className="text-[11.5px] font-medium text-emerald-700">{washFeedback}</p>
          )}
        </div>

        {/* Cleaning History Table */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Cleaning History ({cleaningEventsDesc.length} washes)
          </span>
          {cleaningEventsDesc.length === 0 ? (
            <p className="text-[11.5px] text-slate-400 italic">No manual washes recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              {cleaningEventsDesc.slice(0, 5).map((ev) => (
                <div key={ev.ymd} className="px-3.5 py-2 flex items-center justify-between gap-2 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 tabular-nums">{ev.ymd}</span>
                    {ev.note && <span className="text-slate-500">· {ev.note}</span>}
                  </div>
                  <button
                    type="button"
                    disabled={isWashBusy}
                    onClick={() => handleRemoveWash(ev.ymd)}
                    aria-label={`Remove cleaning event for ${ev.ymd}`}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
