import React from 'react';
import type { CanonicalSolarSnapshot, PersistedAppSettings } from '@solar-track/core';

interface SettingSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

export const SettingSwitch: React.FC<SettingSwitchProps> = ({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
      checked ? 'bg-emerald-600' : 'bg-slate-200'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <span
      className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
        checked ? 'translate-x-5.5' : 'translate-x-1'
      }`}
    />
  </button>
);

interface SettingRowProps {
  title: string;
  description: string;
  badgeText?: string;
  badgeTone?: 'slate' | 'emerald' | 'amber' | 'rose';
  children: React.ReactNode;
}

export const SettingFieldShell: React.FC<SettingRowProps> = ({
  title,
  description,
  badgeText,
  badgeTone = 'slate',
  children,
}) => {
  const dotColor =
    badgeTone === 'emerald'
      ? 'bg-emerald-500'
      : badgeTone === 'amber'
        ? 'bg-amber-500'
        : badgeTone === 'rose'
          ? 'bg-rose-500'
          : 'bg-slate-400';

  return (
    <div className="py-3.5 border-b border-slate-100/90 last:border-b-0 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold text-slate-800">{title}</span>
            {badgeText && (
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-700">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                <span>{badgeText}</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
};

export type SettingsUpdater = (partial: Partial<PersistedAppSettings>) => Promise<any> | void;

export interface BasePanelProps {
  settings: PersistedAppSettings;
  onUpdateSettings: SettingsUpdater;
  canonicalSnapshot: CanonicalSolarSnapshot;
}
