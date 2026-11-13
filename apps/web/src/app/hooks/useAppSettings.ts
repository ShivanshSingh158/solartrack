import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PanelTechPresetId, PersistedAppSettings } from '@solar-track/core';
import { ApiService } from '../../shared/api/solarApi';

function readStoredFloat(key: string, fallback: number): number {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  const parsed = parseFloat(saved);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStoredClampedInt(key: string, min: number, max: number, fallback: number): number {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  const parsed = parseInt(saved, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function nullableFiniteNumber(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
}

function nullableBoundedMinute(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val)
    ? Math.max(0, Math.min(1440, Math.round(val)))
    : null;
}

/**
 * Central state hook for persisted application settings, plant geometry,
 * financial parameters, cleaning/soiling records, and alert preferences.
 */
export function useAppSettings() {
  const [tariffPerKwh, setTariffPerKwh] = useState<number>(() => readStoredFloat('waaree_tariff', 8.0));
  const [systemCost, setSystemCost] = useState<number>(() => readStoredFloat('waaree_system_cost', 180000));
  const [systemCapacity, setSystemCapacity] = useState<number>(() =>
    readStoredFloat('waaree_system_capacity', 3.0),
  );
  const [billingCycleDay, setBillingCycleDay] = useState<number>(() =>
    readStoredClampedInt('waaree_billing_cycle_day', 1, 28, 1),
  );
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>(() =>
    localStorage.getItem('waaree_temp_unit') === 'F' ? 'F' : 'C',
  );
  const [govtSubsidyInr, setGovtSubsidyInr] = useState<number>(() =>
    readStoredFloat('waaree_govt_subsidy', 0),
  );
  const [panelWashCostInr, setPanelWashCostInr] = useState<number>(() =>
    readStoredFloat('waaree_wash_cost', 0),
  );
  const [tariffEscalationPct, setTariffEscalationPct] = useState<number>(() =>
    readStoredFloat('waaree_tariff_escalation', 0),
  );

  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('waaree_packet_alerts');
    return saved === null ? true : saved === 'true';
  });
  const [alertOfflineDelay, setAlertOfflineDelay] = useState<boolean>(true);
  const [alertMorningYield, setAlertMorningYield] = useState<boolean>(true);
  const [alertUnderperformance, setAlertUnderperformance] = useState<boolean>(false);
  const [alertVoltageSpike, setAlertVoltageSpike] = useState<boolean>(true);
  const [offlineDelayMinutes, setOfflineDelayMinutes] = useState<number>(30);
  const [underperformanceThresholdPct, setUnderperformanceThresholdPct] = useState<number>(82);

  const [currentLocation, setCurrentLocation] = useState<{ name: string; lat: number; lon: number }>({
    name: 'Solar Site',
    lat: 20.5937,
    lon: 78.9629,
  });
  const [plantDisplayName, setPlantDisplayName] = useState<string | null>(null);
  const [commissioningDateOverride, setCommissioningDateOverride] = useState<string | null>(null);
  const [arrayTiltDeg, setArrayTiltDeg] = useState<number>(26.5);
  const [arrayAzimuthDeg, setArrayAzimuthDeg] = useState<number>(0);
  const [panelTechPreset, setPanelTechPreset] = useState<PanelTechPresetId>('mono_perc');
  const [thermalCoeffPerC, setThermalCoeffPerC] = useState<number>(0.0038);
  const [basePrAtStc, setBasePrAtStc] = useState<number>(0.85);
  const [inverterEfficiency, setInverterEfficiency] = useState<number>(0.972);
  const [panelDegradationPctYr, setPanelDegradationPctYr] = useState<number>(0.55);
  const [co2KgPerKwh, setCo2KgPerKwh] = useState<number>(0.85);
  const [washRecommendPct, setWashRecommendPct] = useState<number>(7.0);
  const [rainResetDailyMm, setRainResetDailyMm] = useState<number>(5.0);
  const [weatherCacheTtlMin, setWeatherCacheTtlMin] = useState<number>(12);
  const [dcCapacityKwp, setDcCapacityKwp] = useState<number>(3.0);
  const [acInverterCapacityKw, setAcInverterCapacityKw] = useState<number>(3.0);
  const [mountingType, setMountingType] = useState<'open_rack' | 'flush_rcc'>('open_rack');
  const [roofAlbedo, setRoofAlbedo] = useState<number>(0.2);
  const [dcCleanFactor, setDcCleanFactor] = useState<number>(0.95);
  const [useCalibratedTwin, setUseCalibratedTwin] = useState<boolean>(true);
  const [kSiteOverride, setKSiteOverride] = useState<number | null>(null);
  const [inverterTareKw, setInverterTareKw] = useState<number | null>(null);
  const [inverterLinearLoss, setInverterLinearLoss] = useState<number | null>(null);
  const [inverterQuadLoss, setInverterQuadLoss] = useState<number | null>(null);

  const [physicalEtotalKwh, setPhysicalEtotalKwh] = useState<number | null>(null);
  const [physicalEtotalCloudRefKwh, setPhysicalEtotalCloudRefKwh] = useState<number | null>(null);
  const [physicalEtotalSetAtYmd, setPhysicalEtotalSetAtYmd] = useState<string | null>(null);
  const [physicalEtotalSetAtMin, setPhysicalEtotalSetAtMin] = useState<number | null>(null);
  const [physicalEmonthKwh, setPhysicalEmonthKwh] = useState<number | null>(null);
  const [physicalEmonthCloudRefKwh, setPhysicalEmonthCloudRefKwh] = useState<number | null>(null);
  const [physicalEmonthYm, setPhysicalEmonthYm] = useState<string | null>(null);
  const [physicalEmonthSetAtYmd, setPhysicalEmonthSetAtYmd] = useState<string | null>(null);
  const [physicalEmonthSetAtMin, setPhysicalEmonthSetAtMin] = useState<number | null>(null);

  const [manualGridOffDates, setManualGridOffDates] = useState<string[]>([]);
  const [cleaningEvents, setCleaningEvents] = useState<NonNullable<PersistedAppSettings['cleaningEvents']>>([]);
  const [lastCleanedDate, setLastCleanedDate] = useState<string | null>(null);

  const onAfterResetRef = useRef<(() => Promise<void> | void) | null>(null);
  const setAfterResetHandler = useCallback((handler: (() => Promise<void> | void) | null) => {
    onAfterResetRef.current = handler;
  }, []);

  const applyHydratedSettings = useCallback((s: Partial<PersistedAppSettings>) => {
    if (!s) return;
    if (s.plantLocation) setCurrentLocation(s.plantLocation);
    if (s.plantDisplayName !== undefined) setPlantDisplayName(s.plantDisplayName || null);
    if (s.commissioningDateOverride !== undefined) {
      setCommissioningDateOverride(s.commissioningDateOverride || null);
    }
    if (typeof s.arrayTiltDeg === 'number' && Number.isFinite(s.arrayTiltDeg)) setArrayTiltDeg(s.arrayTiltDeg);
    if (typeof s.arrayAzimuthDeg === 'number' && Number.isFinite(s.arrayAzimuthDeg)) {
      setArrayAzimuthDeg(s.arrayAzimuthDeg);
    }
    if (s.panelTechPreset) setPanelTechPreset(s.panelTechPreset);
    if (typeof s.thermalCoeffPerC === 'number' && Number.isFinite(s.thermalCoeffPerC)) {
      setThermalCoeffPerC(s.thermalCoeffPerC);
    }
    if (typeof s.basePrAtStc === 'number' && Number.isFinite(s.basePrAtStc)) setBasePrAtStc(s.basePrAtStc);
    if (typeof s.inverterEfficiency === 'number' && Number.isFinite(s.inverterEfficiency)) {
      setInverterEfficiency(s.inverterEfficiency);
    }
    if (typeof s.dcCapacityKwp === 'number' && s.dcCapacityKwp > 0) setDcCapacityKwp(s.dcCapacityKwp);
    else if (typeof s.systemCapacity === 'number' && s.systemCapacity > 0) setDcCapacityKwp(s.systemCapacity);

    if (typeof s.acInverterCapacityKw === 'number' && s.acInverterCapacityKw > 0) {
      setAcInverterCapacityKw(s.acInverterCapacityKw);
    } else if (typeof s.systemCapacity === 'number' && s.systemCapacity > 0) {
      setAcInverterCapacityKw(s.systemCapacity);
    }

    if (s.mountingType === 'flush_rcc' || s.mountingType === 'open_rack') setMountingType(s.mountingType);
    if (typeof s.roofAlbedo === 'number' && Number.isFinite(s.roofAlbedo)) setRoofAlbedo(s.roofAlbedo);
    if (typeof s.dcCleanFactor === 'number' && Number.isFinite(s.dcCleanFactor)) setDcCleanFactor(s.dcCleanFactor);
    if (typeof s.useCalibratedTwin === 'boolean') setUseCalibratedTwin(s.useCalibratedTwin);
    if (s.kSiteOverride !== undefined) setKSiteOverride(nullableFiniteNumber(s.kSiteOverride));
    if (s.inverterTareKw !== undefined) setInverterTareKw(nullableFiniteNumber(s.inverterTareKw));
    if (s.inverterLinearLoss !== undefined) setInverterLinearLoss(nullableFiniteNumber(s.inverterLinearLoss));
    if (s.inverterQuadLoss !== undefined) setInverterQuadLoss(nullableFiniteNumber(s.inverterQuadLoss));

    if (s.physicalEtotalKwh !== undefined) setPhysicalEtotalKwh(nullableFiniteNumber(s.physicalEtotalKwh));
    if (s.physicalEtotalCloudRefKwh !== undefined) {
      setPhysicalEtotalCloudRefKwh(nullableFiniteNumber(s.physicalEtotalCloudRefKwh));
    }
    if (s.physicalEtotalSetAtYmd !== undefined) {
      setPhysicalEtotalSetAtYmd(typeof s.physicalEtotalSetAtYmd === 'string' ? s.physicalEtotalSetAtYmd : null);
    }
    if (s.physicalEtotalSetAtMin !== undefined) {
      setPhysicalEtotalSetAtMin(nullableBoundedMinute(s.physicalEtotalSetAtMin));
    }

    if (s.physicalEmonthKwh !== undefined) setPhysicalEmonthKwh(nullableFiniteNumber(s.physicalEmonthKwh));
    if (s.physicalEmonthCloudRefKwh !== undefined) {
      setPhysicalEmonthCloudRefKwh(nullableFiniteNumber(s.physicalEmonthCloudRefKwh));
    }
    if (s.physicalEmonthYm !== undefined) {
      setPhysicalEmonthYm(typeof s.physicalEmonthYm === 'string' ? s.physicalEmonthYm : null);
    }
    if (s.physicalEmonthSetAtYmd !== undefined) {
      setPhysicalEmonthSetAtYmd(typeof s.physicalEmonthSetAtYmd === 'string' ? s.physicalEmonthSetAtYmd : null);
    }
    if (s.physicalEmonthSetAtMin !== undefined) {
      setPhysicalEmonthSetAtMin(nullableBoundedMinute(s.physicalEmonthSetAtMin));
    }

    if (Array.isArray(s.manualGridOffDates)) {
      setManualGridOffDates(
        s.manualGridOffDates.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)),
      );
    }
    if (typeof s.panelDegradationPctYr === 'number' && Number.isFinite(s.panelDegradationPctYr)) {
      setPanelDegradationPctYr(s.panelDegradationPctYr);
    }
    if (typeof s.co2KgPerKwh === 'number' && Number.isFinite(s.co2KgPerKwh)) setCo2KgPerKwh(s.co2KgPerKwh);

    if (typeof s.tariffPerKwh === 'number' && s.tariffPerKwh > 0) {
      setTariffPerKwh(s.tariffPerKwh);
      localStorage.setItem('waaree_tariff', String(s.tariffPerKwh));
    }
    if (typeof s.systemCost === 'number' && s.systemCost > 0) {
      setSystemCost(s.systemCost);
      localStorage.setItem('waaree_system_cost', String(s.systemCost));
    }
    if (typeof s.dcCapacityKwp === 'number' && s.dcCapacityKwp > 0) {
      setSystemCapacity(s.dcCapacityKwp);
      localStorage.setItem('waaree_system_capacity', String(s.dcCapacityKwp));
    } else if (typeof s.systemCapacity === 'number' && s.systemCapacity > 0) {
      setSystemCapacity(s.systemCapacity);
      localStorage.setItem('waaree_system_capacity', String(s.systemCapacity));
    }

    if (typeof s.billingCycleDay === 'number' && s.billingCycleDay >= 1) {
      const safeDay = Math.min(28, Math.max(1, Math.round(s.billingCycleDay)));
      setBillingCycleDay(safeDay);
      localStorage.setItem('waaree_billing_cycle_day', String(safeDay));
    }
    if (s.tempUnit === 'F' || s.tempUnit === 'C') {
      setTempUnit(s.tempUnit);
      localStorage.setItem('waaree_temp_unit', s.tempUnit);
    }
    if (typeof s.packetAlertsEnabled === 'boolean') {
      setAlertsEnabled(s.packetAlertsEnabled);
      localStorage.setItem('waaree_packet_alerts', String(s.packetAlertsEnabled));
    }
    if (typeof s.alertOfflineDelay === 'boolean') setAlertOfflineDelay(s.alertOfflineDelay);
    if (typeof s.alertMorningYield === 'boolean') setAlertMorningYield(s.alertMorningYield);
    if (typeof s.alertUnderperformance === 'boolean') setAlertUnderperformance(s.alertUnderperformance);
    if (typeof s.alertVoltageSpike === 'boolean') setAlertVoltageSpike(s.alertVoltageSpike);
    if (typeof s.offlineDelayMinutes === 'number' && Number.isFinite(s.offlineDelayMinutes)) {
      setOfflineDelayMinutes(Math.round(s.offlineDelayMinutes));
    }
    if (typeof s.underperformanceThresholdPct === 'number' && Number.isFinite(s.underperformanceThresholdPct)) {
      setUnderperformanceThresholdPct(Math.round(s.underperformanceThresholdPct));
    }
    if (typeof s.washRecommendPct === 'number' && Number.isFinite(s.washRecommendPct)) {
      setWashRecommendPct(s.washRecommendPct);
    }
    if (typeof s.rainResetDailyMm === 'number' && Number.isFinite(s.rainResetDailyMm)) {
      setRainResetDailyMm(s.rainResetDailyMm);
    }
    if (typeof s.weatherCacheTtlMin === 'number' && Number.isFinite(s.weatherCacheTtlMin)) {
      setWeatherCacheTtlMin(Math.round(s.weatherCacheTtlMin));
    }
    if (Array.isArray(s.cleaningEvents)) setCleaningEvents(s.cleaningEvents);
    if (s.lastCleanedDate !== undefined) setLastCleanedDate(s.lastCleanedDate || null);

    if (typeof s.govtSubsidyInr === 'number' && s.govtSubsidyInr >= 0) {
      setGovtSubsidyInr(s.govtSubsidyInr);
      localStorage.setItem('waaree_govt_subsidy', String(s.govtSubsidyInr));
    }
    if (typeof s.panelWashCostInr === 'number' && s.panelWashCostInr >= 0) {
      setPanelWashCostInr(s.panelWashCostInr);
      localStorage.setItem('waaree_wash_cost', String(s.panelWashCostInr));
    }
    if (typeof s.tariffEscalationPct === 'number' && s.tariffEscalationPct >= 0) {
      setTariffEscalationPct(s.tariffEscalationPct);
      localStorage.setItem('waaree_tariff_escalation', String(s.tariffEscalationPct));
    }
  }, []);

  useEffect(() => {
    let active = true;
    ApiService.getSettings()
      .then((s) => {
        if (active && s) applyHydratedSettings(s);
      })
      .catch((err) => console.error('Error fetching initial settings:', err));
    return () => {
      active = false;
    };
  }, [applyHydratedSettings]);

  const syncSettingsToServer = useCallback(
    async (partial: Partial<PersistedAppSettings>) => {
      try {
        const updated = await ApiService.updateSettings(partial);
        if (updated) applyHydratedSettings(updated);
        return updated;
      } catch (e) {
        console.error('Failed to persist settings:', e);
        return null;
      }
    },
    [applyHydratedSettings],
  );

  const handleUpdateSettingsPartial = useCallback(
    async (partial: Partial<PersistedAppSettings>) => {
      applyHydratedSettings(partial);
      return syncSettingsToServer(partial);
    },
    [applyHydratedSettings, syncSettingsToServer],
  );

  const handleUpdateTariff = useCallback(
    (val: number) => {
      void handleUpdateSettingsPartial({ tariffPerKwh: val });
    },
    [handleUpdateSettingsPartial],
  );

  const handleUpdateSystemCost = useCallback(
    (val: number) => {
      void handleUpdateSettingsPartial({ systemCost: val });
    },
    [handleUpdateSettingsPartial],
  );

  const handleUpdateGovtSubsidy = useCallback(
    (val: number) => {
      void handleUpdateSettingsPartial({ govtSubsidyInr: Math.max(0, Math.round(Number(val) || 0)) });
    },
    [handleUpdateSettingsPartial],
  );

  const handleUpdatePanelWashCost = useCallback(
    (val: number) => {
      void handleUpdateSettingsPartial({ panelWashCostInr: Math.max(0, Math.round(Number(val) || 0)) });
    },
    [handleUpdateSettingsPartial],
  );

  const handleResetSettings = useCallback(
    async (options?: { preserveLocation?: boolean; preserveCleaning?: boolean }) => {
      const reset = await ApiService.resetSettings(options);
      if (reset) applyHydratedSettings(reset);
      if (onAfterResetRef.current) await onAfterResetRef.current();
      return reset;
    },
    [applyHydratedSettings],
  );

  const handleToggleAlerts = useCallback(async () => {
    const nextVal = !alertsEnabled;
    setAlertsEnabled(nextVal);
    localStorage.setItem('waaree_packet_alerts', String(nextVal));
    void syncSettingsToServer({ packetAlertsEnabled: nextVal });
    if (
      nextVal &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignore blocked browser prompt
      }
    }
  }, [alertsEnabled, syncSettingsToServer]);

  const resolvedDcDisplayCap = dcCapacityKwp > 0 ? dcCapacityKwp : systemCapacity;
  const resolveAcDisplayCap = useCallback(
    (summaryCap?: string | number, plantCap?: string | number) =>
      acInverterCapacityKw > 0
        ? acInverterCapacityKw
        : parseFloat(String(summaryCap || plantCap || systemCapacity || '3.00')) || 3.0,
    [acInverterCapacityKw, systemCapacity],
  );

  const buildFullPersistedSettings = useMemo(
    () => (resolvedAcDisplayCap: number): PersistedAppSettings => ({
      billingCycleDay,
      lastCleanedDate,
      cleaningEvents,
      plantDisplayName,
      commissioningDateOverride,
      plantLocation: currentLocation,
      arrayTiltDeg,
      arrayAzimuthDeg,
      panelTechPreset,
      thermalCoeffPerC,
      basePrAtStc,
      inverterEfficiency,
      tariffPerKwh,
      systemCapacity: resolvedDcDisplayCap,
      dcCapacityKwp: resolvedDcDisplayCap,
      acInverterCapacityKw: resolvedAcDisplayCap,
      mountingType,
      roofAlbedo,
      dcCleanFactor,
      useCalibratedTwin,
      kSiteOverride,
      inverterTareKw,
      inverterLinearLoss,
      inverterQuadLoss,
      physicalEtotalKwh,
      physicalEtotalCloudRefKwh,
      physicalEtotalSetAtYmd,
      physicalEtotalSetAtMin,
      physicalEmonthKwh,
      physicalEmonthCloudRefKwh,
      physicalEmonthYm,
      physicalEmonthSetAtYmd,
      physicalEmonthSetAtMin,
      manualGridOffDates,
      systemCost,
      govtSubsidyInr,
      panelWashCostInr,
      tariffEscalationPct,
      panelDegradationPctYr,
      co2KgPerKwh,
      tempUnit,
      packetAlertsEnabled: alertsEnabled,
      alertOfflineDelay,
      alertMorningYield,
      alertUnderperformance,
      alertVoltageSpike,
      offlineDelayMinutes,
      underperformanceThresholdPct,
      washRecommendPct,
      rainResetDailyMm,
      weatherCacheTtlMin,
    }),
    [
      billingCycleDay,
      lastCleanedDate,
      cleaningEvents,
      plantDisplayName,
      commissioningDateOverride,
      currentLocation,
      arrayTiltDeg,
      arrayAzimuthDeg,
      panelTechPreset,
      thermalCoeffPerC,
      basePrAtStc,
      inverterEfficiency,
      tariffPerKwh,
      resolvedDcDisplayCap,
      mountingType,
      roofAlbedo,
      dcCleanFactor,
      useCalibratedTwin,
      kSiteOverride,
      inverterTareKw,
      inverterLinearLoss,
      inverterQuadLoss,
      physicalEtotalKwh,
      physicalEtotalCloudRefKwh,
      physicalEtotalSetAtYmd,
      physicalEtotalSetAtMin,
      physicalEmonthKwh,
      physicalEmonthCloudRefKwh,
      physicalEmonthYm,
      physicalEmonthSetAtYmd,
      physicalEmonthSetAtMin,
      manualGridOffDates,
      systemCost,
      govtSubsidyInr,
      panelWashCostInr,
      tariffEscalationPct,
      panelDegradationPctYr,
      co2KgPerKwh,
      tempUnit,
      alertsEnabled,
      alertOfflineDelay,
      alertMorningYield,
      alertUnderperformance,
      alertVoltageSpike,
      offlineDelayMinutes,
      underperformanceThresholdPct,
      washRecommendPct,
      rainResetDailyMm,
      weatherCacheTtlMin,
    ],
  );

  return {
    tariffPerKwh,
    govtSubsidyInr,
    panelWashCostInr,
    tariffEscalationPct,
    alertsEnabled,
    alertOfflineDelay,
    alertMorningYield,
    alertUnderperformance,
    alertVoltageSpike,
    offlineDelayMinutes,
    underperformanceThresholdPct,
    currentLocation,
    setCurrentLocation,
    plantDisplayName,
    commissioningDateOverride,
    manualGridOffDates,
    lastCleanedDate,
    setLastCleanedDate,
    resolvedDcDisplayCap,
    resolveAcDisplayCap,
    buildFullPersistedSettings,
    applyHydratedSettings,
    handleUpdateSettingsPartial,
    handleUpdateTariff,
    handleUpdateSystemCost,
    handleUpdateGovtSubsidy,
    handleUpdatePanelWashCost,
    handleResetSettings,
    handleToggleAlerts,
    setAfterResetHandler,
  };
}
