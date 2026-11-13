import type {
  Account,
  CombinedSummary,
  SinglePlantSummary,
  LiveFlowData,
  RawSeries,
  MergedTimePoint,
  HistoryReportSeries,
  DashboardInitResponse,
  DayComparisonResponse,
  SolarIntelligenceResponse,
  DeviceRealAllData,
  PlantAlarmsPayload,
} from '@solar-track/core';

export const ApiService = {
  // Init & Capabilities
  async getDashboardInit(): Promise<DashboardInitResponse | null> {
    try {
      const res = await fetch('/api/dashboard/init');
      return await res.json();
    } catch {
      return null;
    }
  },

  // Accounts
  async getAccounts(): Promise<Account[]> {
    const res = await fetch('/api/accounts/list');
    const data = await res.json();
    return data.accounts || [];
  },

  async addAccount(username: string, password: string): Promise<{ errno: number; error?: string; account?: Account }> {
    const res = await fetch('/api/accounts/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  async removeAccount(id: string): Promise<void> {
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
  },

  async testCloudConnection(): Promise<{ errno: number; success: boolean; latencyMs: number; message: string }> {
    try {
      const res = await fetch('/api/accounts/test-connection');
      return await res.json();
    } catch (err: any) {
      return { errno: -1, success: false, latencyMs: 0, message: err?.message || 'Network request failed' };
    }
  },

  // Fleet & Combined
  async getCombinedSummary(): Promise<CombinedSummary | null> {
    const res = await fetch('/api/combined/summary');
    const data = await res.json();
    return data.result || null;
  },

  async getCombinedRaw(beginDate: { year: number; month: number; day: number }): Promise<MergedTimePoint[]> {
    const res = await fetch('/api/combined/raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timespan: 'day',
        beginDate: { ...beginDate, hour: 0, minute: 0, second: 0 },
      }),
    });
    const data = await res.json();
    return (data.result && data.result.merged) || [];
  },

  // Individual Plant
  async getPlantDetail(stationId: string): Promise<SinglePlantSummary | null> {
    const res = await fetch(`/api/plant/detail?stationID=${encodeURIComponent(stationId)}`);
    const data = await res.json();
    return data.result || null;
  },

  async getPlantFlow(stationId: string): Promise<LiveFlowData | null> {
    const res = await fetch(`/api/flow?stationID=${encodeURIComponent(stationId)}`);
    const data = await res.json();
    return data.result || null;
  },

  async getPlantRaw(
    stationId: string,
    beginDate: { year: number; month: number; day: number }
  ): Promise<RawSeries[]> {
    const res = await fetch('/api/plant/raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationID: stationId,
        timespan: 'day',
        beginDate: { ...beginDate, hour: 0, minute: 0, second: 0 },
        variables: ['generationPower', 'pvPower', 'feedinPower', 'loadsPower', 'gridConsumptionPower'],
      }),
    });
    const data = await res.json();
    return data.result || [];
  },

  async getPlantHistory(
    stationId: string,
    reportType: 'month' | 'year',
    queryDate: { year: number; month?: number }
  ): Promise<HistoryReportSeries[]> {
    const res = await fetch('/api/plant/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationID: stationId,
        reportType,
        queryDate,
        variables: ['generation', 'feedin', 'gridConsumption', 'loads'],
      }),
    });
    const data = await res.json();
    return data.result || [];
  },

  // Settings & Persistent Config
  async getSettings(): Promise<any | null> {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      return data.settings || null;
    } catch {
      return null;
    }
  },

  async updateSettings(partial: any): Promise<any | null> {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      return data.settings || null;
    } catch {
      return null;
    }
  },

  async resetSettings(options?: { preserveLocation?: boolean; preserveCleaning?: boolean }): Promise<any | null> {
    try {
      const res = await fetch('/api/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });
      const data = await res.json();
      return data.settings || null;
    } catch {
      return null;
    }
  },

  async getProxyStatus(): Promise<any | null> {
    try {
      const res = await fetch('/api/proxy/status');
      return await res.json();
    } catch {
      return null;
    }
  },

  async getAnnualSolarBaseline(capacity?: number, force = false): Promise<any | null> {
    try {
      const params = new URLSearchParams();
      if (capacity) params.set('capacity', String(capacity));
      if (force) params.set('force', 'true');
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/annual-solar-baseline${q}`);
      return await res.json();
    } catch {
      return null;
    }
  },

  async refreshBackendCaches(): Promise<any | null> {
    try {
      const res = await fetch('/api/cache/refresh', { method: 'POST' });
      return await res.json();
    } catch {
      return null;
    }
  },

  async markPanelsCleaned(
    dateYmd?: string,
    note?: string,
    action: 'add' | 'remove' = 'add'
  ): Promise<{
    lastCleanedDate: string | null;
    cleanedYmd?: string;
    cleaningEvents?: Array<{ ymd: string; timestampIso: string; type: 'manual'; note?: string }>;
  } | null> {
    try {
      const res = await fetch('/api/settings/clean-panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateYmd, note, action }),
      });
      const data = await res.json();
      if (data.errno !== 0) return null;
      return {
        lastCleanedDate: data.lastCleanedDate || null,
        cleanedYmd: data.cleanedYmd,
        cleaningEvents: data.cleaningEvents,
      };
    } catch {
      return null;
    }
  },

  async getSolarIntelligence(stationID?: string, force = false): Promise<SolarIntelligenceResponse | null> {
    try {
      const params = new URLSearchParams();
      if (stationID) params.set('stationID', stationID);
      if (force) params.set('force', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/solar-intelligence${query}`);
      const data = await res.json();
      return data?.errno === 0 && data?.report ? data : null;
    } catch {
      return null;
    }
  },

  // Open-Meteo Satellite Solar Weather & Forecast
  async getSolarWeather(lat?: number, lon?: number, force = false): Promise<any | null> {
    try {
      const params = new URLSearchParams();
      if (lat && lon) {
        params.set('lat', String(lat));
        params.set('lon', String(lon));
      }
      if (force) params.set('force', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/weather/solar${query}`);
      return await res.json();
    } catch {
      return null;
    }
  },

  // Simultaneous Weather + Waaree Telemetry Sync
  async getLiveSync(stationID?: string, force = false): Promise<any | null> {
    try {
      const params = new URLSearchParams();
      if (stationID) params.set('stationID', stationID);
      if (force) params.set('force', 'true');
      const res = await fetch(`/api/live/sync?${params.toString()}`);
      return await res.json();
    } catch {
      return null;
    }
  },

  // Location Lookup (Auto-Reverse Geocode Coordinates or Search City)
  async lookupLocation(query: string): Promise<any | null> {
    try {
      const res = await fetch(`/api/location/lookup?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      return data.location || null;
    } catch {
      return null;
    }
  },

  async reverseGeocode(lat: number, lon: number): Promise<any | null> {
    try {
      const res = await fetch(`/api/location/lookup?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      return data.location || null;
    } catch {
      return null;
    }
  },

  // Historical Date Comparison + Calendar Month Availability
  async getDayComparison(
    stationID?: string,
    dateYmd?: string,
    options?: { calendarMonth?: string; calendarOnly?: boolean; force?: boolean }
  ): Promise<DayComparisonResponse | null> {
    try {
      const params = new URLSearchParams();
      if (stationID) params.set('stationID', stationID);
      if (dateYmd) params.set('date', dateYmd);
      if (options?.calendarMonth) params.set('calendarMonth', options.calendarMonth);
      if (options?.calendarOnly) params.set('calendarOnly', 'true');
      if (options?.force) params.set('force', 'true');
      const res = await fetch(`/api/day-comparison?${params.toString()}`);
      return await res.json();
    } catch {
      return null;
    }
  },

  // Live Multi-String Hardware Modbus Telemetry
  async getDeviceRealAll(stationId?: string): Promise<DeviceRealAllData | null> {
    try {
      const url = stationId ? `/api/device/real-all?stationID=${encodeURIComponent(stationId)}` : '/api/device/real-all';
      const res = await fetch(url);
      const data = await res.json();
      return (data && data.errno === 0 && data.result) || null;
    } catch {
      return null;
    }
  },

  // Official Inverter Hardware Alarms
  async getPlantAlarms(stationId?: string): Promise<PlantAlarmsPayload | null> {
    try {
      const url = stationId ? `/api/plant/alarms?stationID=${encodeURIComponent(stationId)}` : '/api/plant/alarms';
      const res = await fetch(url);
      const data = await res.json();
      return (data && data.errno === 0 && data.result) || null;
    } catch {
      return null;
    }
  },

  // High-Security Auth & Session Lifecycle
  async getAuthStatus(): Promise<{
    errno: number;
    authenticated: boolean;
    user?: { username: string; plantName: string; stationID: string; accountsCount: number };
    hasConfiguredAccount?: boolean;
  }> {
    try {
      const res = await fetch('/api/auth/status');
      return await res.json();
    } catch {
      return { errno: -1, authenticated: false };
    }
  },

  async login(payload: { username: string; password: string }): Promise<{
    errno: number;
    authenticated: boolean;
    sessionToken?: string;
    user?: { username: string; plantName: string; stationID: string };
    error?: string;
  }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { errno: -1, authenticated: false, error: err?.message || 'Login request failed' };
    }
  },

  async logout(): Promise<{ errno: number; authenticated: boolean; message?: string }> {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      return await res.json();
    } catch {
      return { errno: 0, authenticated: false };
    }
  },
};
