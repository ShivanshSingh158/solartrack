/**
 * 12-Month Kanpur Microclimate & Solar Geometry Calibration Profiles.
 *
 * Coordinates: Kanpur, Uttar Pradesh (26.502213° N, 80.236601° E)
 * Array Geometry: 3.27 kWp DC / 3.0 kW AC Inverter, 26.5° Tilt, 0° True South.
 *
 * Factors in:
 * 1. Seasonal Solar Elevation (40.2° winter solstice to 86.8° summer solstice).
 * 2. Indo-Gangetic winter aerosol inversion (AOD 0.70-1.15 in Nov-Jan vs 0.20-0.35 in monsoon).
 * 3. Dynamic obstacle shadow propagation across solar declination angles (afternoon dip in winter).
 * 4. Ambient-to-cell thermal derating curve (20°C ambient in winter vs 44°C in May/June).
 * 5. Dry season soiling velocity vs natural monsoon rain cleansing cycles.
 */

export interface KanpurMonthlyProfile {
  month: number; // 1 to 12
  monthName: string;
  season: 'Winter' | 'Spring' | 'Summer' | 'Monsoon' | 'Autumn';
  sunElevationMaxDeg: number;
  expectedClearDayKwh: number;
  kSite: number; // Empirical site scale factor
  aodBaseline: number; // Atmospheric aerosol optical depth baseline
  pm10Baseline: number; // Particulate matter baseline (ug/m3)
  soilingDailyRate: number; // Daily percentage accumulation of dust
  typicalAmbientTempMaxC: number;
  cellTempDeratePct: number; // Midday thermal derate percentage
  hourlyShadeFactors: number[]; // 24-hour transmission factors [0..23]
  notes: string;
}

/**
 * Generates an hourly shade profile vector [0..23] for a given month in Kanpur.
 * Captures low-angle morning parapet clearance and winter afternoon obstacle shadows.
 */
function buildKanpurHourlyShadeFactors(month: number): number[] {
  const profile = new Array(24).fill(1.0);

  // Night hours
  for (let h = 0; h < 6; h++) profile[h] = 0.0;
  for (let h = 18; h < 24; h++) profile[h] = 0.0;

  if (month === 11) {
    // November: Low morning sun (haze + parapet), early sunset
    profile[6] = 0.88;  // Sunrise ramp through parapet wall
    profile[7] = 0.94;
    profile[8] = 0.98;
    profile[16] = 0.90; // Sunset approach
    profile[17] = 0.75;
  } else if (month === 12) {
    // December: Maximum winter slant, persistent afternoon shade, early sunset
    profile[6] = 0.75;
    profile[7] = 0.82;
    profile[8] = 0.90;
    profile[13] = 0.92;
    profile[14] = 0.30; // Deep obstacle shadow due to lowest solar declination (40.2°)
    profile[15] = 0.75;
    profile[16] = 0.65;
    profile[17] = 0.0;
  } else if (month === 1) {
    // January: Severe morning fog attenuation, persistent winter afternoon shade
    profile[6] = 0.70;
    profile[7] = 0.80;
    profile[8] = 0.88;
    profile[14] = 0.35;
    profile[15] = 0.80;
    profile[16] = 0.70;
    profile[17] = 0.0;
  } else if (month === 2) {
    // February: Sun climbing (50.6°), morning fog lifts earlier, obstacle shadow shrinks
    profile[6] = 0.85;
    profile[7] = 0.92;
    profile[14] = 0.65; // Obstacle shadow starts clearing array
    profile[16] = 0.85;
  } else if (month === 3) {
    // March: High sun (61.1°), obstacle shadow clears the array entirely
    profile[6] = 0.92;
    profile[7] = 0.98;
    profile[14] = 0.95;
    profile[15] = 0.96;
    profile[16] = 0.92;
  } else if (month === 4 || month === 5 || month === 6) {
    // April - June: High zenith (73° to 87°), zero rooftop shadows
    profile[5] = 0.90;
    profile[6] = 0.98;
    profile[17] = 0.95;
    profile[18] = 0.80;
  } else if (month === 7 || month === 8) {
    // July - August: Monsoon, zero shadows, washed atmosphere
    profile[5] = 0.90;
    profile[6] = 0.98;
    profile[17] = 0.95;
    profile[18] = 0.85;
  } else if (month === 9) {
    // September: Autumn equinox transition (66.5°)
    profile[6] = 0.95;
    profile[16] = 0.92;
    profile[17] = 0.85;
  } else if (month === 10) {
    // October: Sun descending (55°), minor evening parapet shadow returns
    profile[6] = 0.90;
    profile[7] = 0.95;
    profile[14] = 0.78; // Obstacle shadow begins clipping western panels
    profile[16] = 0.88;
    profile[17] = 0.75;
  }

  return profile;
}

/**
 * Empirical 12-Month Calibration Matrix for Kanpur Rooftop.
 */
export const KANPUR_12_MONTH_PROFILES: Record<number, KanpurMonthlyProfile> = {
  1: {
    month: 1,
    monthName: 'January',
    season: 'Winter',
    sunElevationMaxDeg: 42.2,
    expectedClearDayKwh: 9.8,
    kSite: 0.80,
    aodBaseline: 0.95,
    pm10Baseline: 240,
    soilingDailyRate: 0.0042,
    typicalAmbientTempMaxC: 20.0,
    cellTempDeratePct: 6.2,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(1),
    notes: 'Dense radiation fog, high inversion smog, cold cells (+3% efficiency gain offset by low insolation).',
  },
  2: {
    month: 2,
    monthName: 'February',
    season: 'Spring',
    sunElevationMaxDeg: 50.6,
    expectedClearDayKwh: 12.2,
    kSite: 0.85,
    aodBaseline: 0.58,
    pm10Baseline: 170,
    soilingDailyRate: 0.0028,
    typicalAmbientTempMaxC: 25.5,
    cellTempDeratePct: 8.5,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(2),
    notes: 'Fog lifts, clear sunny days, ideal panel temperature range (35-42°C).',
  },
  3: {
    month: 3,
    monthName: 'March',
    season: 'Spring',
    sunElevationMaxDeg: 61.1,
    expectedClearDayKwh: 14.6,
    kSite: 0.88,
    aodBaseline: 0.44,
    pm10Baseline: 145,
    soilingDailyRate: 0.0026,
    typicalAmbientTempMaxC: 32.0,
    cellTempDeratePct: 12.4,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(3),
    notes: 'High direct irradiance, zero obstacle shadows, moderate thermal loss.',
  },
  4: {
    month: 4,
    monthName: 'April',
    season: 'Summer',
    sunElevationMaxDeg: 73.3,
    expectedClearDayKwh: 15.8,
    kSite: 0.87,
    aodBaseline: 0.48,
    pm10Baseline: 160,
    soilingDailyRate: 0.0032,
    typicalAmbientTempMaxC: 39.5,
    cellTempDeratePct: 15.8,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(4),
    notes: 'Intense insolation, dusty dry winds, significant thermal derating (cell temp >65°C).',
  },
  5: {
    month: 5,
    monthName: 'May',
    season: 'Summer',
    sunElevationMaxDeg: 82.3,
    expectedClearDayKwh: 15.4,
    kSite: 0.84,
    aodBaseline: 0.52,
    pm10Baseline: 180,
    soilingDailyRate: 0.0035,
    typicalAmbientTempMaxC: 44.0,
    cellTempDeratePct: 18.2,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(5),
    notes: 'Peak ambient heat (44°C+), cell temp exceeds 70°C, high thermal losses.',
  },
  6: {
    month: 6,
    monthName: 'June',
    season: 'Summer',
    sunElevationMaxDeg: 86.8,
    expectedClearDayKwh: 13.8,
    kSite: 0.85,
    aodBaseline: 0.40,
    pm10Baseline: 150,
    soilingDailyRate: 0.0018,
    typicalAmbientTempMaxC: 39.0,
    cellTempDeratePct: 16.0,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(6),
    notes: 'Sun at local zenith, pre-monsoon cloudiness, variable direct beam.',
  },
  7: {
    month: 7,
    monthName: 'July',
    season: 'Monsoon',
    sunElevationMaxDeg: 85.0,
    expectedClearDayKwh: 11.2,
    kSite: 0.90,
    aodBaseline: 0.22,
    pm10Baseline: 65,
    soilingDailyRate: 0.0002,
    typicalAmbientTempMaxC: 33.0,
    cellTempDeratePct: 11.5,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(7),
    notes: 'Southwest monsoon, rain self-cleaning (0% soiling), high diffuse fraction.',
  },
  8: {
    month: 8,
    monthName: 'August',
    season: 'Monsoon',
    sunElevationMaxDeg: 77.5,
    expectedClearDayKwh: 11.8,
    kSite: 0.90,
    aodBaseline: 0.24,
    pm10Baseline: 70,
    soilingDailyRate: 0.0003,
    typicalAmbientTempMaxC: 32.5,
    cellTempDeratePct: 11.2,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(8),
    notes: 'Persistent rain cleansing, low aerosol extinction, washed glass.',
  },
  9: {
    month: 9,
    monthName: 'September',
    season: 'Autumn',
    sunElevationMaxDeg: 66.5,
    expectedClearDayKwh: 13.5,
    kSite: 0.89,
    aodBaseline: 0.32,
    pm10Baseline: 95,
    soilingDailyRate: 0.0015,
    typicalAmbientTempMaxC: 31.5,
    cellTempDeratePct: 11.8,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(9),
    notes: 'Post-monsoon clear blue skies, excellent clarity, soiling resumes.',
  },
  10: {
    month: 10,
    monthName: 'October',
    season: 'Autumn',
    sunElevationMaxDeg: 55.0,
    expectedClearDayKwh: 13.0,
    kSite: 0.87,
    aodBaseline: 0.52,
    pm10Baseline: 155,
    soilingDailyRate: 0.0026,
    typicalAmbientTempMaxC: 30.0,
    cellTempDeratePct: 10.5,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(10),
    notes: 'Post-monsoon transition, agricultural burning begins, aerosol starts rising.',
  },
  11: {
    month: 11,
    monthName: 'November',
    season: 'Winter',
    sunElevationMaxDeg: 45.1,
    expectedClearDayKwh: 12.4,
    kSite: 0.88,
    aodBaseline: 0.70,
    pm10Baseline: 190,
    soilingDailyRate: 0.0032,
    typicalAmbientTempMaxC: 28.0,
    cellTempDeratePct: 10.2,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(11),
    notes: 'Clean potential 12.3-13.2 kWh on clear un-interrupted days (e.g. 4 Nov: 13.4 kWh, 8 Nov: 12.4 kWh, 13 Nov: ~12.2 kWh). Drops to 9.7 kWh during grid cuts.',
  },
  12: {
    month: 12,
    monthName: 'December',
    season: 'Winter',
    sunElevationMaxDeg: 40.2,
    expectedClearDayKwh: 9.2,
    kSite: 0.78,
    aodBaseline: 1.05,
    pm10Baseline: 260,
    soilingDailyRate: 0.0045,
    typicalAmbientTempMaxC: 21.0,
    cellTempDeratePct: 6.8,
    hourlyShadeFactors: buildKanpurHourlyShadeFactors(12),
    notes: 'Minimum sun elevation of year (40.2°), longest shadows, dense morning fog.',
  },
};

/**
 * Retrieves the Kanpur calibration profile for a given month (1 to 12).
 */
export function getKanpurMonthlyProfile(month: number): KanpurMonthlyProfile {
  const safeMonth = Math.max(1, Math.min(12, Math.round(month)));
  return KANPUR_12_MONTH_PROFILES[safeMonth] || KANPUR_12_MONTH_PROFILES[11];
}

/**
 * Retrieves the Kanpur calibration profile for an ISO YMD string (e.g. '2026-11-14').
 */
export function getKanpurProfileForDate(ymd: string): KanpurMonthlyProfile {
  if (typeof ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const month = parseInt(ymd.split('-')[1], 10);
    return getKanpurMonthlyProfile(month);
  }
  return getKanpurMonthlyProfile(11);
}

/**
 * Checks whether coordinates match the Kanpur metropolitan rooftop region.
 */
export function isKanpurRegion(lat?: number | null, lon?: number | null): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  return lat >= 26.2 && lat <= 26.8 && lon >= 80.0 && lon <= 80.6;
}
