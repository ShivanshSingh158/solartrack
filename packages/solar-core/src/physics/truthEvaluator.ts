import { getIstClockParts } from '../time/istDate.ts';
import { SOLAR_CONSTANTS } from './constants.ts';
import { computeAstronomicalSunTimes } from './astronomy.ts';
import type {
  EnvironmentEquivalents,
  FreshnessReport,
  MasterSimulationState,
  TelemetrySunContext,
} from '../types/physics.ts';

export type { EnvironmentEquivalents, TelemetrySunContext, FreshnessReport, MasterSimulationState };

/**
 * Carbon & environmental offset computation:
 * - CO2 avoided: 0.85 kg/kWh (CEA India grid factor)
 * - Coal avoided: 0.40 kg/kWh
 * - Mature trees equivalent: 22 kg CO2 absorbed per tree-year
 */
export function computeEnvironmentEquivalents(
  kwh: number,
  co2FactorKgPerKwh: number = SOLAR_CONSTANTS.CO2_KG_PER_KWH
): EnvironmentEquivalents {
  const safeKwh = Math.max(0, Number.isFinite(kwh) ? kwh : 0);
  const safeFactor =
    Number.isFinite(co2FactorKgPerKwh) && co2FactorKgPerKwh > 0
      ? co2FactorKgPerKwh
      : SOLAR_CONSTANTS.CO2_KG_PER_KWH;
  const co2KgNum = +(safeKwh * safeFactor).toFixed(1);
  const co2TonsNum = co2KgNum / 1000;
  const coalKgNum = +(safeKwh * SOLAR_CONSTANTS.COAL_KG_PER_KWH).toFixed(1);
  const exactTrees = co2KgNum / SOLAR_CONSTANTS.CO2_KG_PER_TREE_YEAR;
  const trees = safeKwh > 0 ? Math.max(1, Math.round(exactTrees)) : 0;
  const nextTreeTarget = Math.floor(exactTrees) + 1;
  const treeProgressPct =
    safeKwh > 0 ? Math.min(100, Math.max(0, Math.round((exactTrees - Math.floor(exactTrees)) * 100))) : 0;
  const kmAvoided = Math.round(co2KgNum / 0.12);

  return {
    co2KgNum,
    co2Kg: co2KgNum.toFixed(1),
    co2Tons: co2TonsNum.toFixed(2),
    coalKgNum,
    coalKg: coalKgNum.toFixed(1),
    trees,
    exactTrees: +exactTrees.toFixed(2),
    nextTreeTarget,
    treeProgressPct,
    kmAvoided: kmAvoided.toLocaleString('en-IN'),
  };
}

/**
 * Parses Waaree telemetry timestamps ("Updated 21 hours ago", ISO, epoch, or formatted strings).
 */
export function parseTelemetryDate(val: string | number | undefined | null): Date {
  if (!val) return new Date();
  if (typeof val === 'number') {
    return new Date(val > 1e11 ? val : val * 1000);
  }

  const str = String(val).trim();
  const dayMatch = str.match(/(\d+)\s*(?:days?|d)\b/i);
  const hourMatch = str.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i);
  const minMatch = str.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);

  if (dayMatch || hourMatch || minMatch) {
    const days = dayMatch ? parseInt(dayMatch[1], 10) : 0;
    const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
    const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
    const totalMs = ((days * 24 + hours) * 60 + mins) * 60 * 1000;
    return new Date(Date.now() - totalMs);
  }

  const parsed = new Date(str.replace(/-/g, '/'));
  if (!isNaN(parsed.getTime())) return parsed;

  const std = new Date(str);
  return !isNaN(std.getTime()) ? std : new Date();
}

export function isSameDayIST(dateA: Date, dateB: Date = new Date()): boolean {
  const dA = dateA.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const dB = dateB.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return dA === dB;
}

export function formatRelativeAgo(mins: number): string {
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 48) {
    return remMins > 0 ? `${hrs}h ${remMins}m ago` : `${hrs}h ago`;
  }
  const days = Math.floor(hrs / 24);
  return `${days} days ago`;
}

/**
 * Truth & Freshness State Machine.
 * Evaluates live telemetry against physical reality, timestamps, and Indian daylight context.
 */
export function evaluateTelemetryTruth(
  lastUpdateInput: string | number | undefined | null,
  rawGenerationKw: number,
  rawYieldTodayKwh: number,
  deviceState: number = 1,
  rVolt: number = 230,
  rFreq: number = 50.0,
  _simState?: MasterSimulationState,
  sunContext?: TelemetrySunContext
): FreshnessReport {
  const now = new Date();
  const lastSync = parseTelemetryDate(lastUpdateInput);
  const diffMs = Math.max(0, now.getTime() - lastSync.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const agoText = formatRelativeAgo(diffMins);

  const exactTimestampIST =
    lastSync.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' IST';

  const isFromToday = isSameDayIST(lastSync, now);

  const istNowClock = getIstClockParts(now);
  const astroToday = computeAstronomicalSunTimes(
    sunContext?.sunriseMin ? SOLAR_CONSTANTS.DEFAULT_LAT : SOLAR_CONSTANTS.DEFAULT_LAT,
    sunContext?.sunsetMin ? SOLAR_CONSTANTS.DEFAULT_LON : SOLAR_CONSTANTS.DEFAULT_LON,
    istNowClock.ymd
  );
  const srMin = sunContext?.sunriseMin ?? astroToday.sunriseMin;
  const ssMin = sunContext?.sunsetMin ?? astroToday.sunsetMin;
  const srText = sunContext?.sunriseText || astroToday.sunriseText;
  const ssText = sunContext?.sunsetText || astroToday.sunsetText;
  const estKwhText = (sunContext?.todayEstKwh ?? 12.2).toFixed(1);
  const radMjText = (sunContext?.todayRadMj ?? 15.3).toFixed(2);
  const nowMinutesIst = sunContext?.nowMinutesIst ?? istNowClock.totalMinutes;
  const hasTodayGeneration =
    Boolean(sunContext?.hasTodayActiveCurve) ||
    rawYieldTodayKwh > 0.05 ||
    (sunContext?.todayCurveKwh ?? 0) > 0.05;
  const duskSettled =
    nowMinutesIst >= ssMin - 35 &&
    rawGenerationKw <= 0.02 &&
    isFromToday &&
    hasTodayGeneration;
  const isNightIST = nowMinutesIst >= ssMin || nowMinutesIst < srMin - 10 || duskSettled;

  const yesterdayYield = !isFromToday && rawYieldTodayKwh > 0 ? rawYieldTodayKwh : undefined;

  if (isNightIST) {
    const nightStaleThreshold =
      duskSettled || (isFromToday && hasTodayGeneration && nowMinutesIst >= ssMin - 35 && nowMinutesIst <= ssMin + 95)
        ? 90
        : 30;
    const isOffline = !isFromToday || deviceState === 0 || diffMins > nightStaleThreshold;
    return {
      status: 'NIGHT_SLEEP',
      badgeColor: isOffline ? 'grey' : 'blue',
      statusHeadline: isOffline
        ? `🌙 Night Standby (Unsynced) • Wi-Fi offline since ${agoText}`
        : duskSettled && nowMinutesIst < ssMin + 20
          ? `🌙 Dusk Standby (Settled) • Last synced ${agoText}`
          : `🌙 Night Standby • Last synced ${agoText}`,
      exactTimestampIST,
      relativeAgo: agoText,
      diffMinutes: diffMins,
      isDataTrustworthy: !isOffline,
      isFromToday,
      safeGenerationKw: 0,
      safeYieldTodayKwh: isFromToday ? rawYieldTodayKwh : null,
      yesterdayFinalYieldKwh: yesterdayYield,
      reassuranceBanner: isOffline
        ? `Sun has set (${ssText} IST). Inverter is in normal night standby (0.00 kW). Wi-Fi dongle has been offline since ${exactTimestampIST}; ${isFromToday && rawYieldTodayKwh > 0 ? `${rawYieldTodayKwh.toFixed(1)} kWh synced before disconnect, while any unsynced tail resets at 00:00 IST` : `unless Wi-Fi reconnects before midnight (00:00 IST) so EDay can upload (~${estKwhText} kWh twin est. from ${radMjText} MJ/m²), today's cloud bar resets at midnight`}.`
        : `Your solar inverter is sleeping for the night and will automatically wake up at sunrise (~${srText} IST).`,
      heroNotice: {
        type: 'standby',
        title: isOffline
          ? 'Night Standby (0.00 kW) · Wi-Fi Offline Before Midnight'
          : 'Solar Station at Rest (Night Standby)',
        description: isOffline
          ? `Sun has set (${ssText} IST). Inverter is in zero-export night sleep. Waaree dongles do not backfill past days from flash—if Wi-Fi stays offline past 00:00 IST, unsynced energy (~${estKwhText} kWh twin est.) stays unlogged in cloud reports until you enter inverter LCD E-Total in Settings.`
          : `Sun has set. DC bus is powered down until first morning light (~${srText} IST).`,
        subNote:
          isFromToday && rawYieldTodayKwh > 0
            ? `Today's Completed Generation: ${rawYieldTodayKwh.toFixed(1)} kWh`
            : undefined,
      },
    };
  }

  if (diffMins > 30 || deviceState === 0) {
    return {
      status: 'OFFLINE_STALE',
      badgeColor: 'grey',
      statusHeadline: `📡 Wi-Fi Offline • Last updated ${agoText}`,
      exactTimestampIST,
      relativeAgo: agoText,
      diffMinutes: diffMins,
      isDataTrustworthy: false,
      isFromToday,
      safeGenerationKw: null,
      safeYieldTodayKwh: isFromToday ? rawYieldTodayKwh : null,
      yesterdayFinalYieldKwh: yesterdayYield,
      reassuranceBanner: `Internet connection to the inverter dongle was lost ${agoText} (${exactTimestampIST}). Don't worry—your solar inverter on the roof continues generating electricity normally and counts today's energy in its internal EDay register.`,
      heroNotice: {
        type: 'warning',
        title: 'Wi-Fi Dongle Disconnected — EDay Counting Locally',
        description: `Last connected ${agoText} (${exactTimestampIST}). Your solar panels continue generating power normally on the roof.`,
        subNote: 'Hardware note: Inverter EDay holds today\'s total until 00:00 IST and recovers the daily bar if Wi-Fi reconnects before midnight, though 5-min outage curves and past-midnight days do not backfill from flash.',
      },
    };
  }

  if (!isNightIST && rawGenerationKw === 0 && (rVolt < 180 || rFreq === 0)) {
    return {
      status: 'GRID_OUTAGE',
      badgeColor: 'amber',
      statusHeadline: `⚡ Grid Power Cut • Updated ${agoText}`,
      exactTimestampIST,
      relativeAgo: agoText,
      diffMinutes: diffMins,
      isDataTrustworthy: true,
      isFromToday,
      safeGenerationKw: 0,
      safeYieldTodayKwh: rawYieldTodayKwh,
      reassuranceBanner: 'Utility grid power is currently down. Your inverter paused generation automatically for lineman safety (Anti-Islanding) and will auto-resume ~60 seconds after grid power returns.',
      heroNotice: {
        type: 'warning',
        title: 'Utility Grid Power Outage (Anti-Islanding Active)',
        description: `Grid voltage dropped to ${rVolt}V. Solar paused automatically for lineman safety.`,
        subNote: 'Will auto-resume generation 60 seconds after utility power stabilizes.',
      },
    };
  }

  if (deviceState === 3) {
    return {
      status: 'FAULT',
      badgeColor: 'red',
      statusHeadline: `🔴 Inverter Alert • Updated ${agoText}`,
      exactTimestampIST,
      relativeAgo: agoText,
      diffMinutes: diffMins,
      isDataTrustworthy: true,
      isFromToday,
      safeGenerationKw: rawGenerationKw,
      safeYieldTodayKwh: rawYieldTodayKwh,
      reassuranceBanner: 'The inverter reported an operating alarm. Check System Health for grid voltage and AC/DC isolator switches.',
      heroNotice: {
        type: 'alert',
        title: 'Inverter Operating Alarm Detected',
        description: 'Inverter reported an internal fault state. Check the AC & DC rotary switches on the wall.',
        subNote: 'Grid voltage is normal; verify miniature circuit breakers (MCBs).',
      },
    };
  }

  if (!isNightIST && rawGenerationKw < 0.3 && istNowClock.hours >= 6 && istNowClock.hours <= 8) {
    return {
      status: 'WARMUP',
      badgeColor: 'amber',
      statusHeadline: `🌅 Morning Warm-Up • Updated ${agoText}`,
      exactTimestampIST,
      relativeAgo: agoText,
      diffMinutes: diffMins,
      isDataTrustworthy: true,
      isFromToday,
      safeGenerationKw: rawGenerationKw,
      safeYieldTodayKwh: rawYieldTodayKwh,
      reassuranceBanner: null,
      heroNotice: {
        type: 'info',
        title: 'Morning Low-Light Warm-Up',
        description: 'Inverter tracking panel voltage and synchronizing with the grid.',
        subNote: 'Efficiency calculations activate once power exceeds 300 W.',
      },
    };
  }

  if (diffMins > 12) {
    return {
      status: 'DELAYED',
      badgeColor: 'amber',
      statusHeadline: `🟡 Weak Wi-Fi Signal • Last synced ${agoText}`,
      exactTimestampIST,
      relativeAgo: agoText,
      diffMinutes: diffMins,
      isDataTrustworthy: true,
      isFromToday,
      safeGenerationKw: rawGenerationKw,
      safeYieldTodayKwh: isFromToday ? rawYieldTodayKwh : null,
      yesterdayFinalYieldKwh: yesterdayYield,
      reassuranceBanner: `Cloud telemetry is delayed by ${agoText}. Inverter is actively generating; awaiting next dongle packet.`,
      heroNotice: {
        type: 'warning',
        title: 'Cloud Sync Delayed (Weak Wi-Fi Signal)',
        description: `Last synced ${agoText} (${exactTimestampIST}). Inverter is actively generating on roof.`,
        subNote: 'Showing last reported power reading (~ dimmed).',
      },
    };
  }

  return {
    status: 'LIVE',
    badgeColor: 'green',
    statusHeadline: `🟢 Online • Updated ${agoText}`,
    exactTimestampIST,
    relativeAgo: agoText,
    diffMinutes: diffMins,
    isDataTrustworthy: true,
    isFromToday,
    safeGenerationKw: rawGenerationKw,
    safeYieldTodayKwh: isFromToday ? rawYieldTodayKwh : 0,
    yesterdayFinalYieldKwh: yesterdayYield,
    reassuranceBanner: null,
  };
}

export function isBeforeCommissioning(
  year: number,
  month: number,
  day: number = 1,
  commissionDateStr: string = ''
): boolean {
  if (!commissionDateStr) return false;
  const commDate = new Date(commissionDateStr);
  if (isNaN(commDate.getTime())) return false;
  const targetDate = new Date(year, month - 1, day, 23, 59, 59);
  return targetDate.getTime() < commDate.getTime();
}

export function calculateNormalizedMonthlyAverage(
  totalMonthKwh: number,
  year: number,
  month: number,
  commissionDateStr: string = '',
  activeSyncedDaysCount?: number
): { avgKwhPerDay: number; activeDaysCount: number } {
  if (totalMonthKwh <= 0) return { avgKwhPerDay: 0, activeDaysCount: 0 };

  if (typeof activeSyncedDaysCount === 'number' && activeSyncedDaysCount > 0) {
    return {
      avgKwhPerDay: parseFloat((totalMonthKwh / activeSyncedDaysCount).toFixed(1)),
      activeDaysCount: activeSyncedDaysCount,
    };
  }

  if (commissionDateStr) {
    const commDate = new Date(commissionDateStr);
    if (!isNaN(commDate.getTime())) {
      const commYear = commDate.getFullYear();
      const commMonth = commDate.getMonth() + 1;
      const commDay = commDate.getDate();

      if (year === commYear && month === commMonth) {
        const totalDaysInMonth = new Date(year, month, 0).getDate();
        const activeDays = Math.max(1, totalDaysInMonth - commDay + 1);
        return {
          avgKwhPerDay: parseFloat((totalMonthKwh / activeDays).toFixed(1)),
          activeDaysCount: activeDays,
        };
      }
    }
  }

  const now = getIstClockParts();
  if (year === now.year && month === now.month) {
    const elapsedDays = Math.max(1, now.day - 1);
    return {
      avgKwhPerDay: parseFloat((totalMonthKwh / elapsedDays).toFixed(1)),
      activeDaysCount: elapsedDays,
    };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    avgKwhPerDay: parseFloat((totalMonthKwh / daysInMonth).toFixed(1)),
    activeDaysCount: daysInMonth,
  };
}
