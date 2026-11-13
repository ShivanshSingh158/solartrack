import { PANEL_TECH_PRESETS, type PersistedAppSettings } from '@solar-track/core';

export type SettingsWorkspaceTab = 'plant' | 'utility' | 'alerts' | 'engine';

export function formatInrExact(val: number): string {
  const safe = Math.round(Number(val) || 0);
  const sign = safe < 0 ? '-' : '';
  return `${sign}₹${Math.abs(safe).toLocaleString('en-IN')}`;
}

export function formatInrCompact(val: number): string {
  const safe = Number(val) || 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

export function formatAzimuthLabel(azDeg: number): string {
  const az = Math.round(Number(azDeg) || 0);
  if (az === 0) return '0° South';
  if (az === -45) return '-45° SE';
  if (az === 45) return '+45° SW';
  if (az === -90) return '-90° East';
  if (az === 90) return '+90° West';
  if (Math.abs(az) === 180) return '180° North';
  return `${az > 0 ? '+' : ''}${az}°`;
}

export function getTechPresetLabel(preset: PersistedAppSettings['panelTechPreset']): string {
  if (!preset || preset === 'custom') return 'Custom Physics';
  return PANEL_TECH_PRESETS[preset]?.label || 'Mono-PERC';
}
