import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE_URL = "https://solartrack-j9wx.onrender.com/api/app/v1";

const STORAGE_KEYS = {
  TOKEN: "@solartrack_session_token",
  USER: "@solartrack_user_profile",
};

export interface UserProfile {
  username: string;
  plantName: string;
  stationId: string;
  capacityKwp?: number;
  country?: string;
  tariffPerKwh?: number;
}

export interface OverviewPayload {
  meta: {
    serverTime: string;
    stationId: string;
    plantName: string;
    dataProvenance: string;
    confidenceScore: number;
    isStale: boolean;
  };
  systemStatus: {
    state: string;
    stateLabel: string;
    isGenerating: boolean;
    isNight: boolean;
    canTrustLiveDial: boolean;
  };
  liveDial: {
    currentPowerKw: number;
    peakTodayKw: number;
    peakTodayTime: string;
    expectedPowerNowKw: number;
    performanceRatioPct: number;
    systemEfficiencyPct: number;
  };
  todayEnergy: {
    todayKwh: number;
    yesterdayKwh: number;
    monthKwh: number;
    lifetimeKwh: number;
    monthSavingsInr: number;
    lifetimeSavingsInr: number;
    co2PreventedKg: number;
  };
  panelHygiene: {
    cleanlinessScorePct: number;
    powerLossPct: number;
    weeklySavingsPotentialInr: number;
    actionHeadline: string;
    needsWash: boolean;
  };
  forecast: {
    tomorrowExpectedKwh: number;
    heavyLoadWindow: string;
    threeDayHorizon: Array<{
      date: string;
      expectedKwh: number;
      condition: string;
    }>;
  };
}

export interface HealthPayload {
  errno: number;
  inverter: {
    model: string;
    status: string;
    efficiencyPct: number;
    temperatureC: number;
  };
  mppt: Array<{
    string: string;
    voltageV: number;
    currentA: number;
    powerW: number;
  }>;
  grid: {
    voltageV: number;
    frequencyHz: number;
    status: string;
  };
}

class SolarApiClient {
  private token: string | null = null;

  async init(): Promise<string | null> {
    try {
      this.token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      return this.token;
    } catch {
      return null;
    }
  }

  async getSavedUser(): Promise<UserProfile | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async login(username: string, password: string):Promise<{ ok: boolean; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.authenticated && data.token) {
        this.token = data.token;
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
        if (data.user) {
          await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
        }
        return { ok: true, user: data.user };
      }

      return {
        ok: false,
        error: data.error || "Authentication failed. Check your Waaree login.",
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Network error. Please check connection." };
    }
  }

  async logout(): Promise<void> {
    this.token = null;
    await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
      headers["x-session-token"] = this.token;
    }
    return headers;
  }

  async getStatus(): Promise<{ authenticated: boolean; user?: UserProfile }> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/status`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return { authenticated: false };
      const data = await res.json();
      return { authenticated: !!data.authenticated, user: data.user };
    } catch {
      return { authenticated: false };
    }
  }

  async getOverview(stationId?: string): Promise<OverviewPayload | null> {
    try {
      const query = stationId ? `?stationId=${encodeURIComponent(stationId)}` : "";
      const res = await fetch(`${API_BASE_URL}/overview${query}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async getHealth(stationId?: string): Promise<HealthPayload | null> {
    try {
      const query = stationId ? `?stationId=${encodeURIComponent(stationId)}` : "";
      const res = await fetch(`${API_BASE_URL}/health${query}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

export const solarClient = new SolarApiClient();
