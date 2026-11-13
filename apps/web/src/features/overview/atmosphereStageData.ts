import { getIstClockParts, type IndianSolarPhaseInfo } from '@solar-track/core';

export type WeatherPreviewMode =
  | 'live'
  | 'sunny'
  | 'partly_cloudy'
  | 'cloudy'
  | 'hazy'
  | 'showers'
  | 'rainy'
  | 'thunderstorm'
  | 'snow'
  | 'sunset'
  | 'night';

export type EffectiveAtmosphereMode = Exclude<WeatherPreviewMode, 'live'>;

export interface AtmosphereStateData {
  bgClass: string;
  badgeClass: string;
  cleanStatusText: string;
  numColor: string;
  liveDotColor: string;
  needleColor: string;
  labelColor: string;
  primaryColor: string;
  mutedColor: string;
  displayedKw: number;
  dni: number;
  temp: number;
  humidity: number;
  wind: number;
  condition: string;
}

interface ModeThemeSample {
  bgClass: string;
  badgeClass: string;
  cleanStatusText: string;
  numColor: string;
  liveDotColor: string;
  needleColor: string;
  labelColor: string;
  primaryColor: string;
  mutedColor: string;
  sampleKw: number;
  sampleDni: number;
  sampleTemp: number;
  sampleHumidity: number;
  sampleWind: number;
  condition: string;
}

const MODE_THEME_TABLE: Record<EffectiveAtmosphereMode, ModeThemeSample> = {
  sunny: {
    bgClass: 'hero-stage-sunny',
    badgeClass: 'stage-state-box-sunny',
    cleanStatusText: 'Optimal Sun',
    numColor: 'text-[#92400E]',
    liveDotColor: 'bg-emerald-500',
    needleColor: '#10B981',
    labelColor: 'text-[#78350F]',
    primaryColor: 'text-[#451A03]',
    mutedColor: 'text-[#78350F]',
    sampleKw: 2.1,
    sampleDni: 680,
    sampleTemp: 28,
    sampleHumidity: 22,
    sampleWind: 6.5,
    condition: 'Sunny · Clear Sky',
  },
  partly_cloudy: {
    bgClass: 'hero-stage-partly-cloudy',
    badgeClass: 'stage-state-box-partly-cloudy',
    cleanStatusText: 'Optimal Sun',
    numColor: 'text-[#065F46]',
    liveDotColor: 'bg-emerald-500',
    needleColor: '#059669',
    labelColor: 'text-[#064E3B]',
    primaryColor: 'text-[#022C22]',
    mutedColor: 'text-[#064E3B]',
    sampleKw: 1.85,
    sampleDni: 520,
    sampleTemp: 26,
    sampleHumidity: 38,
    sampleWind: 8.2,
    condition: 'Partly Cloudy',
  },
  cloudy: {
    bgClass: 'hero-stage-cloudy',
    badgeClass: 'stage-state-box-cloudy',
    cleanStatusText: 'Overcast Light',
    numColor: 'text-[#334155]',
    liveDotColor: 'bg-slate-400',
    needleColor: '#64748B',
    labelColor: 'text-[#1E293B]',
    primaryColor: 'text-[#0F172A]',
    mutedColor: 'text-[#475569]',
    sampleKw: 0.78,
    sampleDni: 210,
    sampleTemp: 23,
    sampleHumidity: 58,
    sampleWind: 11.2,
    condition: 'Overcast Cloud',
  },
  hazy: {
    bgClass: 'hero-stage-hazy',
    badgeClass: 'stage-state-box-hazy',
    cleanStatusText: 'Diffused Sun',
    numColor: 'text-[#C2410C]',
    liveDotColor: 'bg-orange-600',
    needleColor: '#EA580C',
    labelColor: 'text-[#7C2D12]',
    primaryColor: 'text-[#431407]',
    mutedColor: 'text-[#7C2D12]',
    sampleKw: 1.25,
    sampleDni: 385,
    sampleTemp: 28,
    sampleHumidity: 22,
    sampleWind: 6.5,
    condition: 'Smoky Haze',
  },
  showers: {
    bgClass: 'hero-stage-showers',
    badgeClass: 'stage-state-box-showers',
    cleanStatusText: 'Passing Rain',
    numColor: 'text-[#0369A1]',
    liveDotColor: 'bg-sky-500',
    needleColor: '#0284C7',
    labelColor: 'text-[#0C4A6E]',
    primaryColor: 'text-[#082F49]',
    mutedColor: 'text-[#0C4A6E]',
    sampleKw: 0.65,
    sampleDni: 180,
    sampleTemp: 24,
    sampleHumidity: 76,
    sampleWind: 12.5,
    condition: 'Rain Showers',
  },
  rainy: {
    bgClass: 'hero-stage-rainy',
    badgeClass: 'stage-state-box-rainy',
    cleanStatusText: 'Monsoon Wash',
    numColor: 'text-[#075985]',
    liveDotColor: 'bg-sky-600',
    needleColor: '#0369A1',
    labelColor: 'text-[#0C4A6E]',
    primaryColor: 'text-[#082F49]',
    mutedColor: 'text-[#0C4A6E]',
    sampleKw: 0.25,
    sampleDni: 65,
    sampleTemp: 22,
    sampleHumidity: 88,
    sampleWind: 15,
    condition: 'Heavy Monsoon',
  },
  thunderstorm: {
    bgClass: 'hero-stage-thunderstorm',
    badgeClass: 'stage-state-box-thunderstorm',
    cleanStatusText: 'Storm MPPT',
    numColor: 'text-[#FDE047]',
    liveDotColor: 'bg-yellow-400',
    needleColor: '#FACC15',
    labelColor: 'text-amber-200',
    primaryColor: 'text-white',
    mutedColor: 'text-slate-300',
    sampleKw: 0.12,
    sampleDni: 35,
    sampleTemp: 21,
    sampleHumidity: 92,
    sampleWind: 22,
    condition: 'Thunderstorm',
  },
  snow: {
    bgClass: 'hero-stage-snow',
    badgeClass: 'stage-state-box-snow',
    cleanStatusText: 'Cold Array',
    numColor: 'text-[#0369A1]',
    liveDotColor: 'bg-cyan-500',
    needleColor: '#0284C7',
    labelColor: 'text-[#0C4A6E]',
    primaryColor: 'text-[#082F49]',
    mutedColor: 'text-[#0C4A6E]',
    sampleKw: 0.35,
    sampleDni: 120,
    sampleTemp: 2,
    sampleHumidity: 82,
    sampleWind: 9.8,
    condition: 'Snowfall',
  },
  sunset: {
    bgClass: 'hero-stage-sunset',
    badgeClass: 'stage-state-box-sunset',
    cleanStatusText: 'Sunset Ramp',
    numColor: 'text-[#BE123C]',
    liveDotColor: 'bg-rose-600',
    needleColor: '#E11D48',
    labelColor: 'text-[#881337]',
    primaryColor: 'text-[#4C0519]',
    mutedColor: 'text-[#881337]',
    sampleKw: 0.38,
    sampleDni: 45,
    sampleTemp: 24,
    sampleHumidity: 32,
    sampleWind: 7.1,
    condition: 'Golden Sunset',
  },
  night: {
    bgClass: 'hero-stage-night',
    badgeClass: 'stage-state-box-night',
    cleanStatusText: 'Night Standby',
    numColor: 'text-[#F8FAFC]',
    liveDotColor: 'bg-slate-400',
    needleColor: '#64748B',
    labelColor: 'text-slate-300',
    primaryColor: 'text-white',
    mutedColor: 'text-slate-400',
    sampleKw: 0,
    sampleDni: 0,
    sampleTemp: 22,
    sampleHumidity: 71,
    sampleWind: 4.5,
    condition: 'Clear Night',
  },
};

export function resolveEffectiveAtmosphereMode(params: {
  isEstimatedLive: boolean;
  liveKw: number;
  isDayReal: boolean;
  weatherData: any;
  solarPhase: IndianSolarPhaseInfo;
  usAqi: number;
  sunContext?: { sunriseMin: number; sunsetMin: number; solarNoonMin: number };
}): EffectiveAtmosphereMode {
  const { isEstimatedLive, liveKw, isDayReal, weatherData, solarPhase, usAqi, sunContext } =
    params;

  const istMins = getIstClockParts().totalMinutes;
  const hasLiveInverterGeneration = !isEstimatedLive && liveKw > 0.05;
  const srGate = Math.max(240, (sunContext?.sunriseMin ?? 384) - 5);
  const ssGate = Math.min(1320, (sunContext?.sunsetMin ?? 1040) + 15);
  if (!hasLiveInverterGeneration && (!isDayReal || istMins < srGate || istMins >= ssGate)) {
    return 'night';
  }
  if (istMins >= ssGate - 40 && istMins < ssGate) {
    return 'sunset';
  }

  const wCode = weatherData?.current?.weatherCode ?? weatherData?.todayForecast?.weatherCode ?? 0;
  const cond = (weatherData?.todayForecast?.condition || solarPhase?.simpleCondition || '').toLowerCase();

  if (wCode === 95 || wCode === 96 || wCode === 99 || cond.includes('thunder') || cond.includes('hail')) {
    return 'thunderstorm';
  }
  if ((wCode >= 71 && wCode <= 77) || wCode === 85 || wCode === 86 || cond.includes('snow') || cond.includes('blizzard')) {
    return 'snow';
  }
  if (wCode === 63 || wCode === 65 || wCode === 82 || cond.includes('heavy rain') || cond.includes('downpour')) {
    return 'rainy';
  }
  if ((wCode >= 51 && wCode <= 61) || wCode === 80 || wCode === 81 || cond.includes('drizzle') || cond.includes('shower')) {
    return 'showers';
  }
  if (wCode === 45 || wCode === 48 || usAqi > 180 || cond.includes('haze') || cond.includes('smoke') || cond.includes('dust')) {
    return 'hazy';
  }
  if (wCode === 3 || cond.includes('overcast')) {
    return 'cloudy';
  }
  if (wCode === 1 || wCode === 2 || cond.includes('partly')) {
    return 'partly_cloudy';
  }
  return 'sunny';
}

export function evaluateBellCurveKw(
  mins: number,
  sunContext: { sunriseMin: number; sunsetMin: number; solarNoonMin: number } | undefined,
  todayPhysicsPoints: Array<{ minute: number; kw: number }> | undefined,
  peakKw: number
): number {
  const dynSunriseMin = sunContext?.sunriseMin ?? 384;
  const dynSunsetMin = sunContext?.sunsetMin ?? 1040;
  if (mins < dynSunriseMin || mins > dynSunsetMin) return 0;

  if (Array.isArray(todayPhysicsPoints) && todayPhysicsPoints.length >= 2) {
    if (mins <= todayPhysicsPoints[0].minute) return +todayPhysicsPoints[0].kw.toFixed(2);
    const last = todayPhysicsPoints[todayPhysicsPoints.length - 1];
    if (mins >= last.minute) return +last.kw.toFixed(2);
    for (let i = 1; i < todayPhysicsPoints.length; i++) {
      if (mins <= todayPhysicsPoints[i].minute) {
        const span = Math.max(1, todayPhysicsPoints[i].minute - todayPhysicsPoints[i - 1].minute);
        const frac = (mins - todayPhysicsPoints[i - 1].minute) / span;
        return +Math.max(
          0,
          todayPhysicsPoints[i - 1].kw + frac * (todayPhysicsPoints[i].kw - todayPhysicsPoints[i - 1].kw)
        ).toFixed(2);
      }
    }
  }

  const peakMinutes = sunContext?.solarNoonMin ?? Math.round((dynSunriseMin + dynSunsetMin) / 2);
  const halfWidth = Math.max(120, Math.round((dynSunsetMin - dynSunriseMin) / 2));
  const diff = Math.abs(mins - peakMinutes);
  if (diff >= halfWidth) return 0;
  const factor = Math.cos((diff / halfWidth) * (Math.PI / 2));
  const dynamicCeiling = peakKw > 0 ? peakKw : 1.8;
  return +(dynamicCeiling * Math.max(0, factor)).toFixed(2);
}

export function buildAtmosphereStateData(params: {
  effectiveMode: EffectiveAtmosphereMode;
  resolvedLiveKw: number;
  dniReal: number;
  tempReal: number;
  humidityReal: number;
  windReal: number;
}): AtmosphereStateData {
  const { effectiveMode, resolvedLiveKw, dniReal, tempReal, humidityReal, windReal } = params;
  const theme = MODE_THEME_TABLE[effectiveMode] || MODE_THEME_TABLE.night;
  const isNight = effectiveMode === 'night';

  return {
    bgClass: theme.bgClass,
    badgeClass: theme.badgeClass,
    cleanStatusText: theme.cleanStatusText,
    numColor: theme.numColor,
    liveDotColor: theme.liveDotColor,
    needleColor: theme.needleColor,
    labelColor: theme.labelColor,
    primaryColor: theme.primaryColor,
    mutedColor: theme.mutedColor,
    displayedKw: isNight ? 0 : resolvedLiveKw,
    dni: isNight
      ? 0
      : effectiveMode === 'sunset'
      ? Math.min(60, dniReal)
      : dniReal,
    temp: tempReal,
    humidity: humidityReal,
    wind: windReal,
    condition: theme.condition,
  };
}
