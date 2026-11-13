import React, { useMemo } from 'react';
import {
  Sun,
  CloudRain,
  Moon,
  CloudFog,
  Cloud,
  CloudSun,
  CloudLightning,
  Snowflake,
  Clock,
} from 'lucide-react';
import {
  formatMinutes12hUpper,
  parseIsoClockMinutes,
  type IndianSolarPhaseInfo,
} from '@solar-track/core';
import { AtmosphereWeatherArtwork } from './AtmosphereWeatherArtwork';
import { SatellitePlantMap } from './SatellitePlantMap';
import {
  buildAtmosphereStateData,
  resolveEffectiveAtmosphereMode,
  type WeatherPreviewMode,
} from './atmosphereStageData';

export type { WeatherPreviewMode };

export interface SolarAtmosphereStageProps {
  plantName: string;
  locationName: string;
  capacityKwp: number;
  liveKw: number;
  realKw?: number;
  modelKw?: number;
  isEstimatedLive: boolean;
  isHardwareFault?: boolean;
  peakKw: number;
  peakTimeText?: string;
  peakIsEstimated?: boolean;
  specificYield: number;
  lastSyncedLabel?: string;
  lastSyncedYieldKwh?: number;
  todayConfirmedYieldKwh?: number | null;
  todayEstYieldKwh?: number;
  weatherData?: any;
  solarPhase: IndianSolarPhaseInfo;
  tariffPerKwh: number;
  onNavigateToPerformance?: () => void;
  onOpenPhysicsModal?: () => void;
  coords?: { lat: number; lon: number };
  onOpenLocationEdit?: () => void;
  lastUpdateText?: string;
  tempUnit?: 'C' | 'F';
  sunContext?: { sunriseMin: number; sunsetMin: number; solarNoonMin: number };
  todayPhysicsPoints?: Array<{ minute: number; kw: number }>;
}

export const SolarAtmosphereStage: React.FC<SolarAtmosphereStageProps> = ({
  capacityKwp = 3.0,
  liveKw = 0,
  modelKw,
  isEstimatedLive = false,
  isHardwareFault = false,
  peakKw = 1.81,
  peakTimeText,
  peakIsEstimated = true,
  weatherData,
  solarPhase,
  onOpenPhysicsModal,
  coords = { lat: 20.5937, lon: 78.9629 },
  onOpenLocationEdit,
  lastUpdateText,
  tempUnit = 'C',
  sunContext,
  todayPhysicsPoints: _todayPhysicsPoints,
}) => {
  const isDayReal = weatherData?.current?.isDay ?? solarPhase?.isDaylight ?? true;
  const tempReal = weatherData?.current?.temperature != null ? Math.round(weatherData.current.temperature) : 22;
  const gtiReal = weatherData?.current?.globalTiltedIrradiance != null
    ? Math.max(0, Math.round(weatherData.current.globalTiltedIrradiance))
    : weatherData?.todayForecast?.irradianceGti != null
    ? Math.max(0, Math.round(weatherData.todayForecast.irradianceGti))
    : weatherData?.current?.shortwaveRadiation != null
    ? Math.round(weatherData.current.shortwaveRadiation * 1.15)
    : 0;
  const dniReal = weatherData?.current?.directNormalIrradiance != null
    ? Math.max(0, Math.round(weatherData.current.directNormalIrradiance))
    : isDayReal
    ? 491
    : 0;
  const humidityReal = weatherData?.current?.humidity != null ? Math.round(weatherData.current.humidity) : 71;
  const windReal = weatherData?.current?.windSpeed != null ? Math.round(weatherData.current.windSpeed) : 4.5;
  const usAqi = weatherData?.current?.usAqi ?? weatherData?.todayForecast?.usAqi ?? 164;

  const effectiveMode = useMemo(
    () =>
      resolveEffectiveAtmosphereMode({
        isEstimatedLive,
        liveKw,
        isDayReal,
        weatherData,
        solarPhase,
        usAqi,
        sunContext,
      }),
    [isEstimatedLive, liveKw, isDayReal, weatherData, solarPhase, usAqi, sunContext]
  );

  const isNight = effectiveMode === 'night';
  const isDarkTheme = effectiveMode === 'night' || effectiveMode === 'thunderstorm';

  const resolvedLiveKw = liveKw;

  const stateData = useMemo(
    () =>
      buildAtmosphereStateData({
        effectiveMode,
        resolvedLiveKw,
        dniReal,
        tempReal,
        humidityReal,
        windReal,
      }),
    [effectiveMode, resolvedLiveKw, dniReal, tempReal, humidityReal, windReal]
  );

  const formattedPeakTime = useMemo(() => {
    if (!peakTimeText) return '';
    return peakTimeText.replace(/^\(+/, '').replace(/\)+$/, '').replace(/^at\s+/i, '').trim();
  }, [peakTimeText]);

  const safeCap = Math.max(1, capacityKwp);
  const showHardwareLive = !isNight && !isEstimatedLive && !isHardwareFault && stateData.displayedKw > 0.05;
  const showEstimatedMode = !isNight && !isHardwareFault && isEstimatedLive && stateData.displayedKw > 0;
  const effectiveModelKw =
    modelKw !== undefined
      ? modelKw
      : isEstimatedLive
      ? stateData.displayedKw
      : 0;

  const spectrumPercent = Math.min(98.5, Math.max(1.2, (stateData.displayedKw / safeCap) * 100));
  const modelSpectrumPercent = Math.min(98.5, Math.max(1.2, (effectiveModelKw / safeCap) * 100));
  const capturePct =
    showHardwareLive && effectiveModelKw > 0.05
      ? Math.round((stateData.displayedKw / effectiveModelKw) * 100)
      : null;

  const compactLastSeen = (lastUpdateText || '1d ago').replace(/^Updated\s+/i, '').trim();

  const sunriseLabel = useMemo(() => {
    const iso =
      solarPhase?.phase === 'pre_dawn'
        ? weatherData?.todayForecast?.sunrise
        : weatherData?.tomorrowForecast?.sunrise ?? weatherData?.todayForecast?.sunrise;
    const mins = parseIsoClockMinutes(iso);
    return formatMinutes12hUpper(mins ?? 6 * 60 + 24);
  }, [solarPhase?.phase, weatherData]);

  const nightSubline =
    solarPhase?.phase === 'pre_dawn'
      ? `Sunrise at ${sunriseLabel}`
      : `Next sunrise ${sunriseLabel} tomorrow`;

  return (
    <div className="w-full select-none font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-4 min-h-[296px]">
        <div
          className={`rounded-[20px] relative overflow-hidden flex flex-col justify-between p-6 sm:p-7 shadow-sm transition-all duration-300 min-h-[296px] ${stateData.bgClass}`}
        >
          <svg
            className="absolute bottom-0 left-0 right-0 w-full h-[55px] pointer-events-none opacity-10"
            viewBox="0 0 1000 55"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M 0,55 L 0,44 L 18,44 L 18,36 L 32,36 L 36,24 L 40,36 L 54,36 L 54,44 L 70,44 L 70,30 L 78,30 L 82,14 L 86,30 L 94,30 L 94,44 L 115,44 L 115,38 L 135,38 L 140,28 L 145,38 L 165,38 L 165,44 L 190,44 L 195,32 L 205,22 L 215,32 L 220,44 L 245,44 L 245,28 L 260,28 L 265,16 L 270,28 L 285,28 L 285,44 L 310,44 L 310,36 L 335,36 L 340,44 L 370,44 L 375,34 L 385,20 L 395,34 L 400,44 L 430,44 L 430,32 L 450,32 L 450,44 L 475,44 L 480,24 L 490,10 L 500,24 L 505,44 L 530,44 L 530,36 L 555,36 L 555,44 L 585,44 L 590,30 L 600,18 L 610,30 L 615,44 L 640,44 L 640,34 L 665,34 L 665,44 L 690,44 L 695,26 L 705,12 L 715,26 L 720,44 L 750,44 L 750,36 L 775,36 L 775,44 L 805,44 L 810,32 L 820,18 L 830,32 L 835,44 L 865,44 L 865,30 L 890,30 L 890,44 L 915,44 L 920,22 L 930,8 L 940,22 L 945,44 L 970,44 L 970,34 L 1000,34 L 1000,55 Z" />
          </svg>

          {isNight && (
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden select-none">
              <span className="star-1 absolute top-5 left-[24%] w-1.5 h-1.5 rounded-full bg-amber-200/50" />
              <span className="star-2 absolute top-12 left-[44%] w-1 h-1 rounded-full bg-yellow-100/40" />
              <span className="star-3 absolute top-7 left-[62%] w-1.5 h-1.5 rounded-full bg-sky-200/50" />
              <span className="star-1 absolute top-14 left-[78%] w-1 h-1 rounded-full bg-amber-100/45" />
              <span className="star-2 absolute top-20 left-[34%] w-1 h-1 rounded-full bg-white/35" />
            </div>
          )}

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 w-full mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {showEstimatedMode ? (
                <button
                  type="button"
                  onClick={() => onOpenPhysicsModal?.()}
                  className="inline-flex items-center gap-2 cursor-pointer group"
                  title="Tap to inspect satellite physics calculation"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_#F59E0B] shrink-0" />
                  <span className={`text-[12px] font-semibold tracking-tight ${stateData.labelColor} group-hover:underline underline-offset-2`}>
                    Satellite Estimate
                  </span>
                </button>
              ) : showHardwareLive ? (
                <div className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10B981] shrink-0" />
                  <span className={`text-[12px] font-semibold tracking-tight ${stateData.labelColor}`}>
                    Live Reading
                  </span>
                </div>
              ) : isHardwareFault ? (
                <div className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                  <span className={`text-[12px] font-semibold tracking-tight ${stateData.labelColor}`}>
                    Inverter Alert
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  <span className={`text-[12px] font-semibold tracking-tight ${isDarkTheme ? 'text-slate-300' : 'text-slate-500'}`}>
                    Night Standby
                  </span>
                </div>
              )}
            </div>

            <div className={`flex items-center space-x-1.5 text-[11px] font-medium select-none ${
              showEstimatedMode
                ? isDarkTheme ? 'text-amber-300' : 'text-amber-700'
                : isDarkTheme ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <Clock className="w-3 h-3 shrink-0 opacity-70" strokeWidth={2} />
              <span>
                {showHardwareLive
                  ? `Synced ${compactLastSeen}`
                  : showEstimatedMode
                  ? `Offline · ${compactLastSeen}`
                  : compactLastSeen}
              </span>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-4 items-center my-auto w-full">
            <div className="md:col-span-5 flex flex-col justify-between space-y-2.5">
              <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex flex-col">
                  <div className="flex items-baseline">
                    {showEstimatedMode && (
                      <button
                        type="button"
                        onClick={() => onOpenPhysicsModal?.()}
                        title="Click to inspect satellite irradiance calculation"
                        className={`p-0 mr-0.5 bg-transparent border-0 text-[48px] font-bold leading-none tabular-nums tracking-tight cursor-pointer hover:scale-105 transition-transform ${
                          isDarkTheme ? 'text-amber-400' : 'text-amber-600'
                        }`}
                      >~</button>
                    )}
                    <span className={`hero-giant-num ${stateData.numColor}`}>
                      {stateData.displayedKw.toFixed(2)}
                    </span>
                    <span className={`ml-1.5 text-[14px] font-semibold opacity-75 ${stateData.labelColor} pb-1 whitespace-nowrap`}>
                      kW
                    </span>
                  </div>
                </div>

                <div className={`flex-shrink-0 backdrop-blur-md rounded-[12px] px-[18px] py-[8px] shadow-xs text-center ${
                  isDarkTheme
                    ? 'bg-white/10 border border-white/15'
                    : 'bg-white/60 border border-white/80'
                }`}>
                  <span className={`text-[17px] font-bold tracking-tight whitespace-nowrap ${stateData.primaryColor}`}>
                    {stateData.cleanStatusText}
                  </span>
                </div>
              </div>

              <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px] ${stateData.labelColor}`}>
                {isNight ? (
                  <>
                    <span className="opacity-85 font-medium">{nightSubline}</span>
                    <span className="tabular-nums opacity-85">
                      Array: <strong className={`font-semibold ${stateData.primaryColor}`}>{safeCap.toFixed(1)} kWp</strong>
                    </span>
                  </>
                ) : showEstimatedMode ? (
                  <>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="opacity-75">Est. Peak: </span>
                      <strong className={`font-bold ${stateData.primaryColor}`}>~{peakKw.toFixed(1)} kW</strong>
                      <span className="opacity-70"> ({formattedPeakTime})</span>
                    </span>
                    <span className="whitespace-nowrap">
                      <span className="opacity-75">Inverter: </span>
                      <strong className={`font-bold ${isDarkTheme ? 'text-amber-300' : 'text-amber-900'}`}>Wi-Fi Offline</strong>
                    </span>
                  </>
                ) : showHardwareLive ? (
                  <>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="opacity-75">Today&apos;s Peak: </span>
                      <strong className={`font-bold ${stateData.primaryColor}`}>{peakIsEstimated ? '~' : ''}{peakKw.toFixed(2)} kW</strong>
                      <span className="opacity-70"> ({formattedPeakTime})</span>
                    </span>
                    {effectiveModelKw > 0.05 ? (
                      <span className="tabular-nums whitespace-nowrap">
                        <span className="opacity-75">Model: </span>
                        <strong className={`font-bold ${stateData.primaryColor}`}>~{effectiveModelKw.toFixed(2)} kW</strong>
                        {capturePct !== null && (
                          <span className={`ml-1 font-semibold ${isDarkTheme ? 'text-emerald-300' : 'text-emerald-800'}`}>
                            ({capturePct}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="tabular-nums whitespace-nowrap">
                        <span className="opacity-75">Array: </span>
                        <strong className={`font-bold ${stateData.primaryColor}`}>{safeCap.toFixed(1)} kWp</strong>
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="opacity-75">Est. Peak: </span>
                      <strong className={`font-bold ${stateData.primaryColor}`}>~{peakKw.toFixed(1)} kW</strong>
                      <span className="opacity-70"> ({formattedPeakTime})</span>
                    </span>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="opacity-75">Array: </span>
                      <strong className={`font-bold ${stateData.primaryColor}`}>{safeCap.toFixed(1)} kWp</strong>
                    </span>
                  </>
                )}
              </div>

              <div>
                <div className={`grid grid-cols-5 text-[11px] font-semibold ${stateData.labelColor} mb-1.5 opacity-90`}>
                  <span className="text-left">Standby</span>
                  <span className="text-center">Low</span>
                  <span className="text-center">Moderate</span>
                  <span className="text-center">Optimal</span>
                  <span className="text-right">Peak</span>
                </div>

                <div className="relative h-[8px] w-full rounded-full flex bg-slate-900/20 overflow-visible">
                  <div className="w-1/5 h-full bg-[#64748B] rounded-l-full" />
                  <div className="w-1/5 h-full bg-[#FACC15]" />
                  <div className="w-1/5 h-full bg-[#F59E0B]" />
                  <div className="w-1/5 h-full bg-[#10B981]" />
                  <div className="w-1/5 h-full bg-[#059669] rounded-r-full" />

                  {showEstimatedMode && (
                    <div
                      style={{ left: `${modelSpectrumPercent}%` }}
                      className={`absolute -top-[4px] -translate-x-1/2 w-[16px] h-[16px] rounded-full border-[2.5px] border-dashed shadow-sm transition-all duration-500 ${
                        isDarkTheme ? 'bg-slate-900/40 border-amber-400' : 'bg-white/40 border-amber-700'
                      }`}
                      title={`Satellite estimate: ~${effectiveModelKw.toFixed(2)} kW`}
                    />
                  )}

                  {showHardwareLive && (
                    <div
                      style={{ left: `${spectrumPercent}%`, borderColor: '#10B981' }}
                      className="absolute -top-[3px] -translate-x-1/2 w-[14px] h-[14px] rounded-full bg-white shadow-md transition-all duration-500 border-[3px]"
                      title={`Waaree live: ${stateData.displayedKw.toFixed(2)} kW`}
                    />
                  )}

                  {!showEstimatedMode && !showHardwareLive && (
                    <div
                      style={{ left: `${spectrumPercent}%`, borderColor: stateData.needleColor }}
                      className="absolute -top-[3px] -translate-x-1/2 w-[14px] h-[14px] rounded-full bg-white shadow-md transition-all duration-300 border-[3px]"
                      title="Standby"
                    />
                  )}
                </div>

                <div className={`flex justify-between text-[11px] font-medium num ${stateData.mutedColor} mt-1.5 opacity-80`}>
                  <span>0.0 kW</span>
                  <span className="font-semibold">
                    {Math.abs(capacityKwp * 10 - Math.round(capacityKwp * 10)) < 0.01
                      ? capacityKwp.toFixed(1)
                      : capacityKwp.toFixed(2)}{' '}
                    kWp
                  </span>
                </div>
              </div>
            </div>

            <AtmosphereWeatherArtwork effectiveMode={effectiveMode} isNight={isNight} />

            <div className="md:col-span-5">
              <div
                className={`rounded-[16px] p-[16px_18px] min-h-[156px] flex flex-col justify-between relative transition-all duration-300 ${
                  isDarkTheme
                    ? 'bg-slate-900/75 border border-slate-700/60 shadow-lg text-white backdrop-blur-md'
                    : 'bg-white/90 border border-slate-200/80 shadow-xs text-slate-900 backdrop-blur-md'
                }`}
              >
                <div className={`flex items-center justify-between gap-2 pb-3 border-b ${
                  isDarkTheme ? 'border-white/10' : 'border-slate-200/80'
                }`}>
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className={`w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0 ${
                      isDarkTheme ? 'bg-white/10' : 'bg-slate-100/90'
                    }`}>
                      {isNight ? (
                        <Moon className="w-6 h-6 text-yellow-300" />
                      ) : effectiveMode === 'thunderstorm' ? (
                        <CloudLightning className="w-6 h-6 text-yellow-400" />
                      ) : effectiveMode === 'snow' ? (
                        <Snowflake className="w-6 h-6 text-cyan-400" />
                      ) : effectiveMode === 'rainy' || effectiveMode === 'showers' ? (
                        <CloudRain className="w-6 h-6 text-sky-500" />
                      ) : effectiveMode === 'cloudy' ? (
                        <Cloud className="w-6 h-6 text-slate-600" />
                      ) : effectiveMode === 'partly_cloudy' ? (
                        <CloudSun className="w-6 h-6 text-amber-500" />
                      ) : effectiveMode === 'hazy' ? (
                        <CloudFog className="w-6 h-6 text-amber-600" />
                      ) : (
                        <Sun className="w-6 h-6 text-amber-500" />
                      )}
                    </div>

                    <div className="flex items-baseline space-x-2.5 shrink-0">
                      <span className={`weather-temp-num ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                        {tempUnit === 'F' ? `${Math.round((stateData.temp * 9) / 5 + 32)}°F` : `${stateData.temp}°C`}
                      </span>
                      <span className={`text-[14px] font-semibold whitespace-nowrap ${
                        isDarkTheme ? 'text-slate-200' : 'text-slate-800'
                      }`}>
                        {stateData.condition}
                      </span>
                    </div>
                  </div>

                  {usAqi > 0 && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight shrink-0 select-none ${
                        isDarkTheme
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-400/25'
                          : 'bg-rose-50/90 text-rose-700 border border-rose-200/70'
                      }`}
                      title={`US Air Quality Index: ${usAqi} (affects atmospheric haze)`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDarkTheme ? 'bg-rose-400' : 'bg-rose-500'}`} />
                      <span className="tabular-nums">AQI {usAqi}</span>
                    </span>
                  )}
                </div>

                <div className={`grid grid-cols-3 divide-x ${
                  isDarkTheme ? 'divide-slate-700/60' : 'divide-slate-200/80'
                } pt-2.5 text-center`}>
                  {[
                    { label: '💧 Humidity', value: `${stateData.humidity}%` },
                    { label: '💨 Wind Speed', value: `${stateData.wind} km/h` },
                    {
                      label: '☀️ Sun Strength',
                      value: `${isNight ? 0 : gtiReal > 0 ? gtiReal : stateData.dni} W/m²`,
                    },
                  ].map((item) => (
                    <div key={item.label} className="px-1 xl:px-1.5 flex flex-col items-center justify-center min-w-0">
                      <span className={`text-[11px] xl:text-[14px] 2xl:text-[14.5px] font-normal block leading-snug xl:whitespace-nowrap ${
                        isDarkTheme ? 'text-slate-300' : 'text-slate-600'
                      }`}>
                        {item.label}
                      </span>
                      <span className={`text-[11px] xl:text-[14px] 2xl:text-[14.5px] font-normal leading-snug num block mt-1 xl:whitespace-nowrap ${
                        isDarkTheme ? 'text-slate-200' : 'text-slate-700'
                      }`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <SatellitePlantMap coords={coords} onOpenLocationEdit={onOpenLocationEdit} />
      </div>
    </div>
  );
};
