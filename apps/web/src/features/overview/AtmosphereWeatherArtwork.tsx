import React from 'react';
import type { EffectiveAtmosphereMode } from './atmosphereStageData';

interface AtmosphereWeatherArtworkProps {
  effectiveMode: EffectiveAtmosphereMode;
  isNight: boolean;
}

export const AtmosphereWeatherArtwork: React.FC<AtmosphereWeatherArtworkProps> = ({
  effectiveMode,
  isNight,
}) => (
  <div className="md:col-span-2 hidden md:flex items-center justify-center relative">
    <div className="w-[140px] h-[140px] relative flex items-center justify-center">
      <svg className="w-[140px] h-[140px] drop-shadow-xl overflow-visible" viewBox="0 0 140 140" fill="none">
        <defs>
          {/* Lunar Spherical & Crater Gradients */}
          <radialGradient id="moonSphereGrad" cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#FFFDF7" />
            <stop offset="40%" stopColor="#FEF3C7" />
            <stop offset="75%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </radialGradient>

          <radialGradient id="moonAuraGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#FDE047" stopOpacity="0.22" />
            <stop offset="75%" stopColor="#38BDF8" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
          </radialGradient>

          <radialGradient id="craterGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#D97706" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#B45309" stopOpacity="0.12" />
          </radialGradient>

          {/* 3D Realistic Volumetric Cloud Gradients */}
          <linearGradient id="cloudSunsetVolumetric" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.98" />
            <stop offset="28%" stopColor="#FDE68A" stopOpacity="0.96" />
            <stop offset="58%" stopColor="#FED7AA" stopOpacity="0.92" />
            <stop offset="82%" stopColor="#FDA4AF" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#FB7185" stopOpacity="0.82" />
          </linearGradient>

          <linearGradient id="cloudSunsetRim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FDE047" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1.0" />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="cloudDayVolumetric" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
            <stop offset="45%" stopColor="#F8FAFC" stopOpacity="0.95" />
            <stop offset="78%" stopColor="#E2E8F0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="cloudDayRim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1.0" />
            <stop offset="60%" stopColor="#FEF08A" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.6" />
          </linearGradient>

          <radialGradient id="cloudPuffHighlight" cx="45%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
          </radialGradient>

          <linearGradient id="cloudGradDay" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1.0" />
            <stop offset="60%" stopColor="#F8FAFC" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.92" />
          </linearGradient>

          <linearGradient id="cloudGradBackDay" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.65" />
          </linearGradient>

          <linearGradient id="cloudShadingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#64748B" stopOpacity="0.22" />
          </linearGradient>

          <linearGradient id="nightCloudFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#334155" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#1E293B" stopOpacity="0.98" />
          </linearGradient>

          <linearGradient id="nightCloudBack" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="rainCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#1E293B" stopOpacity="0.98" />
          </linearGradient>

          {/* 3D Specular Solar Sphere Gradients */}
          <radialGradient id="sunSphereGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#FEF08A" />
            <stop offset="60%" stopColor="#F59E0B" />
            <stop offset="90%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </radialGradient>

          {/* Radiant Solar Corona */}
          <radialGradient id="sunAuraGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.8" />
            <stop offset="35%" stopColor="#FEF08A" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
          </radialGradient>

          {/* Ethereal Golden God-Rays emanating directly from the Sun Center (0, 0) */}
          <radialGradient id="sunGodRayGrad" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="100">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="25%" stopColor="#FEF08A" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
          </radialGradient>

          <radialGradient id="sunAuraGradUser" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="50">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#FEF08A" stopOpacity="0.45" />
            <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
          </radialGradient>

          <radialGradient id="sunSphereGradUser" gradientUnits="userSpaceOnUse" cx="-5" cy="-6" r="26">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#FEF08A" />
            <stop offset="60%" stopColor="#F59E0B" />
            <stop offset="90%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </radialGradient>

          <linearGradient id="shootingStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="100%" stopColor="#FDE047" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1. NIGHT SCENE */}
        {isNight && (
          <g>
            <circle cx="70" cy="65" r="50" fill="url(#moonAuraGrad)" className="moon-halo-pulse" />

            <g>
              <path d="M38,24 L39.5,28 L43,29.5 L39.5,31 L38,35 L36.5,31 L33,29.5 L36.5,28 Z" fill="#FFFBEB" opacity="0.9" className="star-1" />
              <circle cx="108" cy="30" r="1.8" fill="#FDE047" className="star-2" />
              <circle cx="25" cy="74" r="1.4" fill="#FEF08A" className="star-3" />
              <circle cx="116" cy="85" r="1.2" fill="#FEF9C3" className="star-1" />
              <circle cx="92" cy="18" r="1.4" fill="#FEF08A" className="star-2" />
              <circle cx="32" cy="108" r="1.0" fill="#FDE047" className="star-3" />
              <path d="M20,16 L38,28" stroke="url(#shootingStarGrad)" strokeWidth="1.2" strokeLinecap="round" className="shooting-star-anim" />
            </g>

            <path
              className="cloud-drift-2"
              d="M34,68 a14,14 0 0,1 26,-7 a18,18 0 0,1 36,4 a12,12 0 0,1 0,22 h-60 a12,12 0 0,1 -2,-19 z"
              fill="url(#nightCloudBack)"
            />

            <g className="moon-float">
              <path
                d="M 52,30 A 38,38 0 1,0 95,102 A 32,32 0 1,1 52,30 Z"
                fill="url(#moonSphereGrad)"
                filter="drop-shadow(0 0 16px rgba(253, 224, 71, 0.45))"
              />
              <ellipse cx="52" cy="62" rx="4.5" ry="3.5" fill="url(#craterGrad)" transform="rotate(-15 52 62)" />
              <ellipse cx="62" cy="82" rx="3.5" ry="2.8" fill="url(#craterGrad)" transform="rotate(-10 62 82)" />
              <ellipse cx="44" cy="46" rx="2.5" ry="2.0" fill="url(#craterGrad)" />
              <path
                d="M 52,30 A 38,38 0 0,0 90,96"
                fill="none"
                stroke="#FFFDF7"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.65"
              />
            </g>

            <g className="cloud-drift-1">
              <path
                d="M 44,78 a 13,13 0 0,1 24,-7 a 18,18 0 0,1 34,5 a 12,12 0 0,1 0,24 h-56 a 12,12 0 0,1 -2,-22 z"
                fill="url(#nightCloudFront)"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1"
                filter="drop-shadow(0 6px 14px rgba(0, 0, 0, 0.45))"
              />
              <path
                d="M 48,75 a 13,13 0 0,1 20,-4 a 18,18 0 0,1 32,5"
                fill="none"
                stroke="#FEF08A"
                strokeWidth="1.2"
                opacity="0.45"
              />
            </g>
          </g>
        )}

        {/* 2. RAIN & SHOWERS */}
        {(effectiveMode === 'rainy' || effectiveMode === 'showers') && (
          <g>
            {effectiveMode === 'showers' && (
              <g>
                <circle cx="50" cy="44" r="26" fill="url(#sunAuraGrad)" className="sun-breathe" />
                <circle cx="50" cy="44" r="19" fill="url(#sunSphereGrad)" />
              </g>
            )}

            <path
              className="cloud-drift-2"
              d="M32,52 a14,14 0 0,1 26,-7 a19,19 0 0,1 36,4 a13,13 0 0,1 0,24 h-60 a13,13 0 0,1 -2,-21 z"
              fill="url(#rainCloudGrad)"
              opacity="0.75"
            />

            <g className="cloud-drift-1">
              <path
                d="M40,58 a15,15 0 0,1 28,-8 a20,20 0 0,1 38,5 a14,14 0 0,1 0,26 h-64 a14,14 0 0,1 -2,-23 z"
                fill="url(#rainCloudGrad)"
                filter="drop-shadow(0 8px 18px rgba(15, 23, 42, 0.35))"
                stroke="rgba(255, 255, 255, 0.18)"
                strokeWidth="1"
              />
            </g>

            <g>
              <line x1="45" y1="92" x2="41" y2="108" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" className="rain-drop-1" opacity="0.9" />
              <line x1="62" y1="96" x2="58" y2="112" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" className="rain-drop-2" opacity="0.95" />
              <line x1="78" y1="90" x2="74" y2="106" stroke="#0284C7" strokeWidth="2.0" strokeLinecap="round" className="rain-drop-3" opacity="0.85" />
              <line x1="94" y1="94" x2="90" y2="110" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" className="rain-drop-4" opacity="0.9" />
              <line x1="53" y1="104" x2="49" y2="118" stroke="#0284C7" strokeWidth="2.0" strokeLinecap="round" className="rain-drop-5" opacity="0.8" />
              <line x1="86" y1="102" x2="82" y2="116" stroke="#38BDF8" strokeWidth="2.2" strokeLinecap="round" className="rain-drop-6" opacity="0.85" />
            </g>
          </g>
        )}

        {/* 3. THUNDERSTORM */}
        {effectiveMode === 'thunderstorm' && (
          <g>
            <g className="cloud-drift-1">
              <path
                d="M36,54 a16,16 0 0,1 30,-9 a22,22 0 0,1 42,6 a15,15 0 0,1 0,28 h-70 a15,15 0 0,1 -2,-25 z"
                fill="url(#rainCloudGrad)"
                filter="drop-shadow(0 10px 22px rgba(0, 0, 0, 0.55))"
                stroke="rgba(250, 204, 21, 0.35)"
                strokeWidth="1.2"
              />
            </g>

            <path
              d="M72,64 L62,82 L74,82 L64,106"
              stroke="#FDE047"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className="lightning-flash"
              filter="drop-shadow(0 0 14px #FACC15)"
            />

            <g>
              <line x1="48" y1="96" x2="43" y2="112" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" className="rain-drop-1" />
              <line x1="88" y1="94" x2="83" y2="110" stroke="#38BDF8" strokeWidth="2.4" strokeLinecap="round" className="rain-drop-3" />
              <line x1="68" y1="104" x2="63" y2="120" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" className="rain-drop-5" opacity="0.85" />
            </g>
          </g>
        )}

        {/* 4. SNOW */}
        {effectiveMode === 'snow' && (
          <g>
            <g className="cloud-drift-1">
              <path
                d="M38,54 a15,15 0 0,1 28,-8 a20,20 0 0,1 38,5 a14,14 0 0,1 0,26 h-64 a14,14 0 0,1 -2,-23 z"
                fill="url(#cloudGradDay)"
                filter="drop-shadow(0 6px 16px rgba(186, 230, 253, 0.45))"
                stroke="#BAE6FD"
                strokeWidth="1.2"
              />
            </g>

            <g className="snow-flake-1">
              <path d="M48,90 L48,102 M42,96 L54,96 M44,92 L52,100 M44,100 L52,92" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" />
            </g>
            <g className="snow-flake-2">
              <circle cx="72" cy="98" r="2.8" fill="#38BDF8" />
              <circle cx="72" cy="98" r="1.5" fill="#FFFFFF" />
            </g>
            <g className="snow-flake-3">
              <path d="M94,92 L94,104 M88,98 L100,98 M90,94 L98,102 M90,102 L98,94" stroke="#0284C7" strokeWidth="1.5" strokeLinecap="round" />
            </g>
            <g className="snow-flake-1">
              <circle cx="60" cy="112" r="2" fill="#38BDF8" />
            </g>
          </g>
        )}

        {/* 5. SUNSET (3D Volumetric Fluffy Twilight Cloud with Sunlit Golden Rim) */}
        {effectiveMode === 'sunset' && (
          <g>
            <circle cx="70" cy="58" r="38" fill="url(#sunAuraGrad)" className="sun-breathe" />
            <circle
              cx="70"
              cy="58"
              r="25"
              fill="url(#sunSphereGrad)"
              filter="drop-shadow(0 4px 18px rgba(245, 158, 11, 0.45))"
            />
            <path
              d="M 54,50 A 18,18 0 0,1 78,38"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.8"
            />

            {/* 3D Volumetric Fluffy Sunset Cloud System */}
            <g className="cloud-drift-1">
              {/* Rear Depth Volume */}
              <path
                d="M 44,78 C 34,74 32,62 38,55 C 42,48 52,47 58,51 C 64,40 80,38 90,45 C 98,42 108,48 110,56 C 118,63 116,74 108,80 C 98,84 86,82 78,79 C 68,83 54,83 44,78 Z"
                fill="#F43F5E"
                opacity="0.30"
                filter="drop-shadow(0 4px 12px rgba(225, 29, 72, 0.25))"
              />

              {/* Main 3D Volumetric Cloud Body */}
              <g filter="drop-shadow(0 8px 20px rgba(190, 24, 93, 0.22))">
                <path
                  d="M 36,88 C 24,86 20,74 26,65 C 30,56 42,54 48,58 C 54,46 72,42 84,49 C 92,46 106,52 108,62 C 116,68 116,80 106,88 C 96,93 82,91 74,87 C 64,92 48,93 36,88 Z"
                  fill="url(#cloudSunsetVolumetric)"
                />

                {/* 3D Volumetric Spherical Puff Highlights (Fluffy depth) */}
                <ellipse cx="68" cy="58" rx="16" ry="12" fill="url(#cloudPuffHighlight)" />
                <ellipse cx="44" cy="70" rx="12" ry="9" fill="url(#cloudPuffHighlight)" />
                <ellipse cx="94" cy="72" rx="14" ry="10" fill="url(#cloudPuffHighlight)" />

                {/* Intense Sunlit Golden-Amber Rim Light along Upper Contour */}
                <path
                  d="M 26,65 C 30,56 42,54 48,58 C 54,46 72,42 84,49 C 92,46 106,52 108,62 C 116,68 116,78 108,84"
                  stroke="url(#cloudSunsetRim)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.95"
                />
              </g>
            </g>
          </g>
        )}

        {/* 6. HAZY */}
        {effectiveMode === 'hazy' && (
          <g>
            <circle cx="70" cy="62" r="40" fill="url(#sunAuraGrad)" className="sun-breathe" />
            <circle cx="70" cy="62" r="26" fill="url(#sunSphereGrad)" opacity="0.9" />

            <g className="mist-wave-1">
              <rect x="20" y="52" width="82" height="4.5" rx="2.25" fill="#EA580C" opacity="0.32" />
              <rect x="38" y="68" width="72" height="4.5" rx="2.25" fill="#C2410C" opacity="0.35" />
            </g>
            <g className="mist-wave-2">
              <rect x="28" y="80" width="90" height="5.5" rx="2.75" fill="#EA580C" opacity="0.38" />
            </g>
          </g>
        )}

        {/* 7. CLOUDY & PARTLY CLOUDY */}
        {(effectiveMode === 'cloudy' || effectiveMode === 'partly_cloudy') && (
          <g>
            <circle cx="56" cy="46" r="30" fill="url(#sunAuraGrad)" className="sun-breathe" />
            <circle cx="56" cy="46" r="21" fill="url(#sunSphereGrad)" />

            {/* 3D Volumetric Fluffy Cloud System with Sunlit Golden-White Rim */}
            <g className="cloud-drift-1">
              {/* Rear Depth Volume */}
              <path
                d="M 44,78 C 34,74 32,62 38,55 C 42,48 52,47 58,51 C 64,40 80,38 90,45 C 98,42 108,48 110,56 C 118,63 116,74 108,80 C 98,84 86,82 78,79 C 68,83 54,83 44,78 Z"
                fill="#94A3B8"
                opacity="0.25"
                filter="drop-shadow(0 4px 12px rgba(15, 23, 42, 0.15))"
              />

              {/* Main 3D Volumetric Cloud Body */}
              <g filter="drop-shadow(0 8px 20px rgba(15, 23, 42, 0.16))">
                <path
                  d="M 36,88 C 24,86 20,74 26,65 C 30,56 42,54 48,58 C 54,46 72,42 84,49 C 92,46 106,52 108,62 C 116,68 116,80 106,88 C 96,93 82,91 74,87 C 64,92 48,93 36,88 Z"
                  fill="url(#cloudDayVolumetric)"
                />

                {/* 3D Volumetric Spherical Puff Highlights */}
                <ellipse cx="68" cy="58" rx="16" ry="12" fill="url(#cloudPuffHighlight)" />
                <ellipse cx="44" cy="70" rx="12" ry="9" fill="url(#cloudPuffHighlight)" />
                <ellipse cx="94" cy="72" rx="14" ry="10" fill="url(#cloudPuffHighlight)" />

                {/* Luminous Sunlit White-Gold Rim Light */}
                <path
                  d="M 26,65 C 30,56 42,54 48,58 C 54,46 72,42 84,49 C 92,46 106,52 108,62 C 116,68 116,78 108,84"
                  stroke="url(#cloudDayRim)"
                  strokeWidth="2.0"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.9"
                />
              </g>
            </g>
          </g>
        )}

        {/* 8. OPTIMAL SUN (Sunny Clear Sky - Sun Rays Anchored Directly to Sun Center) */}
        {effectiveMode === 'sunny' && (
          <g>
            {/* Unified Sun System: Locked and centered at (70, 60) */}
            <g transform="translate(70, 60)">
              {/* 1. Luminous Pulsing Solar Corona at Sun Center */}
              <circle cx="0" cy="0" r="48" fill="url(#sunAuraGradUser)" className="sun-breathe" />

              {/* 2. Soft Celestial God-Rays Rotating Directly Around Sun Center (0, 0) */}
              <g className="sun-god-rays-spin">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="90s"
                  repeatCount="indefinite"
                />
                <g fill="url(#sunGodRayGrad)">
                  <polygon points="0,0 99.5,-9.6 99.5,9.6" />
                  <polygon points="0,0 91.0,41.5 81.4,58.1" />
                  <polygon points="0,0 58.1,81.4 41.5,91.0" />
                  <polygon points="0,0 9.6,99.5 -9.6,99.5" />
                  <polygon points="0,0 -41.5,91.0 -58.1,81.4" />
                  <polygon points="0,0 -81.4,58.1 -91.0,41.5" />
                  <polygon points="0,0 -99.5,9.6 -99.5,-9.6" />
                  <polygon points="0,0 -91.0,-41.5 -81.4,-58.1" />
                  <polygon points="0,0 -58.1,-81.4 -41.5,-91.0" />
                  <polygon points="0,0 -9.6,-99.5 9.6,-99.5" />
                  <polygon points="0,0 41.5,-91.0 58.1,-81.4" />
                  <polygon points="0,0 81.4,-58.1 91.0,-41.5" />
                </g>
              </g>

              {/* 3. Subtle Solar Flare Ring Radiating from Center (0, 0) */}
              <g className="sun-flare-ring-spin">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="28s"
                  repeatCount="indefinite"
                />
                <g stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" opacity="0.75">
                  <line x1="0" y1="-34" x2="0" y2="-28" />
                  <line x1="0" y1="28" x2="0" y2="34" />
                  <line x1="-34" y1="0" x2="-28" y2="0" />
                  <line x1="28" y1="0" x2="34" y2="0" />
                  <line x1="-24" y1="-24" x2="-20" y2="-20" />
                  <line x1="20" y1="20" x2="24" y2="24" />
                  <line x1="24" y1="-24" x2="20" y2="-20" />
                  <line x1="-20" y1="20" x2="-24" y2="24" />
                </g>
              </g>

              {/* 4. 3D Specular Sun Orb */}
              <circle
                cx="0"
                cy="0"
                r="26"
                fill="url(#sunSphereGradUser)"
                filter="drop-shadow(0 4px 16px rgba(245, 158, 11, 0.45))"
              />

              {/* 5. Realistic Curved Specular Highlight on Sun */}
              <path
                d="M -16,-8 A 20,20 0 0,1 8,-20"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.8"
              />
            </g>

            {/* 6. 3D Volumetric Fluffy Foreground Cloud with Sun Rim-Light */}
            {/* Slowly drifts across, dissolves/disappears so full sun shines, then comes back when returning to this place */}
            <g className="cloud-dissipate-return">
              <g filter="drop-shadow(0 8px 20px rgba(180, 83, 9, 0.22))">
                <path
                  d="M 36,88 C 24,86 20,74 26,65 C 30,56 42,54 48,58 C 54,46 72,42 84,49 C 92,46 106,52 108,62 C 116,68 116,80 106,88 C 96,93 82,91 74,87 C 64,92 48,93 36,88 Z"
                  fill="url(#cloudDayVolumetric)"
                />

                {/* 3D Volumetric Spherical Puff Highlights */}
                <ellipse cx="68" cy="58" rx="16" ry="12" fill="url(#cloudPuffHighlight)" />
                <ellipse cx="44" cy="70" rx="12" ry="9" fill="url(#cloudPuffHighlight)" />
                <ellipse cx="94" cy="72" rx="14" ry="10" fill="url(#cloudPuffHighlight)" />

                {/* Luminous Sunlit Golden Rim Light */}
                <path
                  d="M 26,65 C 30,56 42,54 48,58 C 54,46 72,42 84,49 C 92,46 106,52 108,62 C 116,68 116,78 108,84"
                  stroke="url(#cloudDayRim)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.95"
                />
              </g>
            </g>
          </g>
        )}
      </svg>
    </div>
  </div>
);
