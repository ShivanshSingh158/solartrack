import React, { useState, useMemo } from 'react';
import { Bell, Droplets, Trash2, Plus, CloudRain, ShieldCheck } from 'lucide-react';
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
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

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
    [canonicalSnapshot, todayRawSeries, liveFlow, weatherData, intelligenceReport, settings]
  );

  const guardByKey = useMemo(() => {
    const map = new Map<string, (typeof healthReport.guards)[number]>();
    for (const g of healthReport.guards) map.set(g.key, g);
    return map;
  }, [healthReport]);

  const handleRequestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } catch {
      // Ignore denied permission popup
    }
  };

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
        {state === 'Triggered' ? 'Triggered' : state === 'Normal' ? 'Armed' : 'Muted'}
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
      {/* LEFT COLUMN: 5 Live Telemetry Guards & Thresholds */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Live Telemetry Guards (5)
          </h4>
          <span className="text-[11px] font-semibold text-slate-400">
            Status synced with System Health
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {/* 1. New Telemetry Packet Alerts */}
          <div className="py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[13px] font-bold text-slate-800">New Data Arrival Alert</span>
                {renderGuardBadge(undefined, settings.packetAlertsEnabled)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Shows a notification banner when fresh rooftop inverter data packets arrive.
              </p>
              {settings.packetAlertsEnabled && notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
                <button
                  type="button"
                  onClick={handleRequestBrowserPermission}
                  className="mt-1.5 text-[11px] font-bold text-sky-700 hover:text-sky-800 underline"
                >
                  Enable browser desktop notifications ({notifPermission})
                </button>
              )}
            </div>
            <SettingSwitch
              checked={settings.packetAlertsEnabled}
              onChange={(v) => void onUpdateSettings({ packetAlertsEnabled: v })}
              ariaLabel="Toggle new telemetry packet notifications"
            />
          </div>

          {/* 2. Offline Delay Watchdog */}
          <div className="py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">Wi-Fi Offline Watchdog</span>
                {renderGuardBadge('offline', settings.alertOfflineDelay)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Alerts when the inverter stops uploading data during daylight hours.
              </p>
              {settings.alertOfflineDelay && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Alert after:</span>
                  <NumericInput
                    value={settings.offlineDelayMinutes ?? 30}
                    onChangeValue={(v) =>
                      void onUpdateSettings({ offlineDelayMinutes: Math.min(240, Math.max(5, Math.round(v))) })
                    }
                    min={5}
                    max={240}
                    allowDecimal={false}
                    ariaLabel="Offline delay threshold in minutes"
                    className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[12px] font-bold text-slate-900 tabular-nums"
                  />
                  <span className="text-[11px] text-slate-500">minutes</span>
                </div>
              )}
            </div>
            <SettingSwitch
              checked={settings.alertOfflineDelay}
              onChange={(v) => void onUpdateSettings({ alertOfflineDelay: v })}
              ariaLabel="Toggle offline delay watchdog"
            />
          </div>

          {/* 3. Morning Wake Check */}
          <div className="py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">Morning Sun Wake-Up Check</span>
                {renderGuardBadge('morning', settings.alertMorningYield)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Checks that your inverter powers on and connects to the grid each morning once the sun rises.
              </p>
            </div>
            <SettingSwitch
              checked={settings.alertMorningYield}
              onChange={(v) => void onUpdateSettings({ alertMorningYield: v })}
              ariaLabel="Toggle morning production wake check"
            />
          </div>

          {/* 4. Restored: Underperformance Guard */}
          <div className="py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">Low Production Guard</span>
                {renderGuardBadge('underperf', settings.alertUnderperformance)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Alerts when your actual generation drops significantly below the expected solar target.
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
                    className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[12px] font-bold text-slate-900 tabular-nums"
                  />
                  <span className="text-[11px] text-slate-500">%</span>
                </div>
              )}
            </div>
            <SettingSwitch
              checked={settings.alertUnderperformance}
              onChange={(v) => void onUpdateSettings({ alertUnderperformance: v })}
              ariaLabel="Toggle weather-normalized drift guard"
            />
          </div>

          {/* 5. Grid Anti-Islanding & Voltage Protection */}
          <div className="py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">Grid Safety &amp; Power Cut Watchdog</span>
                {renderGuardBadge('voltage', settings.alertVoltageSpike)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Monitors grid voltage and detects if your inverter pauses due to a neighborhood power cut.
              </p>
            </div>
            <SettingSwitch
              checked={settings.alertVoltageSpike}
              onChange={(v) => void onUpdateSettings({ alertVoltageSpike: v })}
              ariaLabel="Toggle grid anti-islanding and voltage watchdog"
            />
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Soiling Sensitivity & Interactive Panel Wash Log */}
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5 text-sky-600" />
            Soiling Engine &amp; Maintenance Log
          </h4>
          <span className="text-[11px] font-bold text-slate-600 tabular-nums">
            Current Est Loss: {canonicalSnapshot.soiling.surfaceLossPct.toFixed(1)}%
          </span>
        </div>

        {/* Soiling Threshold Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-100">
          <div className="rounded-xl bg-slate-50/80 border border-slate-200/80 p-3">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Wash Recommended Loss (%)
            </label>
            <div className="flex items-center gap-2">
              <NumericInput
                value={settings.washRecommendPct ?? 7.0}
                onChangeValue={(v) => void onUpdateSettings({ washRecommendPct: v })}
                min={1}
                max={25}
                allowDecimal
                ariaLabel="Soiling wash recommend threshold percent"
                className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-900 tabular-nums"
              />
              <div className="flex gap-1">
                {[5, 7, 10].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => void onUpdateSettings({ washRecommendPct: pct })}
                    className={`px-2 py-1 rounded text-[10px] font-bold border ${
                      Math.abs((settings.washRecommendPct ?? 7) - pct) < 0.1
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600'
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
                className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-900 tabular-nums"
              />
              <div className="flex gap-1">
                {[3, 5, 8].map((mm) => (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => void onUpdateSettings({ rainResetDailyMm: mm })}
                    className={`px-2 py-1 rounded text-[10px] font-bold border ${
                      Math.abs((settings.rainResetDailyMm ?? 5) - mm) < 0.1
                        ? 'bg-sky-50 border-sky-300 text-sky-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {mm}mm
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Log New Wash Event */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-slate-800">Manual Panel Wash Log</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isWashBusy}
                onClick={() => void handleLogWash(minDateYmd, 'Commissioning clean baseline')}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 text-[11px] font-semibold hover:bg-slate-50 disabled:opacity-50"
                title={`Set clean baseline on installation date (${minDateYmd})`}
              >
                Reset to Install ({minDateYmd})
              </button>
              <button
                type="button"
                disabled={isWashBusy}
                onClick={() => void handleLogWash(todayYmd, 'Washed today')}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                + Log Clean Today
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={washDateInput}
              min={minDateYmd}
              max={todayYmd}
              onChange={(e) => setWashDateInput(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-slate-800 tabular-nums"
            />
            <input
              type="text"
              value={washNoteInput}
              maxLength={60}
              placeholder="Optional note (e.g. sponge rinse)"
              onChange={(e) => setWashNoteInput(e.target.value)}
              className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] text-slate-800"
            />
            <button
              type="button"
              disabled={isWashBusy}
              onClick={() => void handleLogWash(washDateInput, washNoteInput)}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {washFeedback && (
            <p className="mt-1.5 text-[11px] font-semibold text-emerald-700">{washFeedback}</p>
          )}
        </div>

        {/* Logged Washes List */}
        <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 max-h-[210px] overflow-y-auto">
          {cleaningEventsDesc.length === 0 ? (
            <div className="px-3.5 py-4 text-[12px] text-slate-500 text-center">
              No manual washes recorded since commissioning ({minDateYmd}). Soiling relies on natural rain &amp; PM10 dust accumulation.
            </div>
          ) : (
            cleaningEventsDesc.map((ev) => (
              <div key={ev.ymd} className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-white">
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-slate-800 tabular-nums">{ev.ymd}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {ev.note || 'Manual surface cleaning'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isWashBusy}
                  onClick={() => void handleRemoveWash(ev.ymd)}
                  aria-label={`Remove wash log for ${ev.ymd}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
