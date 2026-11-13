/**
 * Atmospheric, Open-Meteo irradiance, and 365-day climatology baseline contracts.
 */

export interface SolarWeatherCurrent {
  temperature: number;
  humidity: number;
  cloudCover: number;
  shortwaveRadiation: number;
  directNormalIrradiance: number;
  globalTiltedIrradiance?: number;
  diffuseRadiation?: number;
  directRadiation?: number;
  precipitation?: number;
  windSpeed: number;
  windGusts?: number;
  isDay: boolean;
  weatherCode: number;
  time: string;
  usAqi?: number;
  pm10?: number;
  pm25?: number;
  dust?: number;
  aerosolOpticalDepth?: number;
}

export interface SolarWeatherHourly {
  globalTiltedIrradiance?: number[];
  globalTiltedIrradianceInstant?: number[];
  temperature2m?: number[];
  windSpeed10m?: number[];
  pm10?: number[];
  aerosolOpticalDepth?: number[];
  shortwaveRadiationClearSky?: number[];
  diffuseRadiation?: number[];
  directNormalIrradiance?: number[];
  cloudCover?: number[];
  dewPoint2m?: number[];
}

export interface SolarWeatherForecast {
  dateYmd?: string;
  expectedYieldKwh: number;
  expectedSavingsINR: number;
  radiationMjM2: number;
  sunshineDurationHours?: number;
  precipitationSum?: number;
  dewPoint?: number;
  maxTemp: number;
  minTemp: number;
  cloudCover: number;
  condition: string;
  conditionType: string;
  irradianceDni: number;
  irradianceGti?: number;
  irradianceGhi: number;
  sunrise?: string;
  sunset?: string;
  usAqi?: number;
  pm10?: number;
  aerosolOpticalDepth?: number;
  currentSurfaceLossPct?: number;
}

export interface SolarWeatherPastDay {
  date: string;
  sunrise?: string | null;
  sunset?: string | null;
  radiationMjM2?: number | null;
  hourlyGti?: number[];
  hourlyGtiInstant?: number[];
  minutely15Gti?: number[];
  minutely15GtiInstant?: number[];
  hourlyTempC?: number[];
  hourlyWindKmh?: number[];
  hourlyPm10?: number[];
  hourlyAod?: number[];
  hourlyDni?: number[];
  hourlyDiffuse?: number[];
  hourlyCloudCover?: number[];
  gtiFetchedAzimuthDeg?: number | null;
}

export interface AnnualMonthlyBaselineEntry {
  month: number;
  shortMonth: string;
  daysSampled: number;
  avgDailyRadMj: number;
  avgDailyGtiKwhM2: number;
  rTilt: number;
  avgTempMaxC: number | null;
  avgTempMinC: number | null;
  avgDailyKwhPerKwp: number;
}

export interface AnnualSolarBaseline {
  source: 'open_meteo_365d_archive';
  startYmd: string;
  endYmd: string;
  fetchedAtYmd: string;
  fetchedAtMs?: number;
  lat: number;
  lon: number;
  tiltDegrees: number;
  azimuthDegrees?: number;
  annualKwhPerKwp: number;
  months: AnnualMonthlyBaselineEntry[];
}

export interface SolarWeatherResponse {
  errno: number;
  available: boolean;
  fetchedAtIso?: string;
  istDateYmd?: string;
  current: SolarWeatherCurrent;
  hourly?: SolarWeatherHourly;
  minutely15?: {
    globalTiltedIrradiance?: number[];
    globalTiltedIrradianceInstant?: number[];
  };
  todayForecast: SolarWeatherForecast;
  tomorrowForecast: SolarWeatherForecast;
  pastDays?: Record<string, SolarWeatherPastDay>;
  annualBaseline?: AnnualSolarBaseline | null;
  azimuthDegrees?: number;
  location?: {
    name: string;
    lat: number;
    lon: number;
    azimuthDegrees?: number;
  };
}

export interface DayComparisonWeather {
  dateYmd: string;
  sunrise: string | null;
  sunset: string | null;
  radiationMjM2: number | null;
  sunshineDurationHours: number | null;
  weatherCode: number;
  condition: string;
  conditionType: string;
  tempMax: number | null;
  tempMin: number | null;
  hourlyGti: number[];
  hourlyGtiInstant?: number[];
  minutely15Gti: number[];
  minutely15GtiInstant?: number[];
  hourlyTempC?: number[];
  hourlyWindKmh?: number[];
  hourlyPm10?: number[];
  hourlyAod?: number[];
  hourlyDni?: number[];
  hourlyDiffuse?: number[];
  hourlyCloudCover?: number[];
  gtiFetchedAzimuthDeg?: number | null;
  source?: string;
  cached?: boolean;
}
