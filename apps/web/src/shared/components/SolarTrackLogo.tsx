import React from 'react';

interface SolarTrackLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

/**
 * Option A: Solar Arc & Photon Stream
 * Luxury titanium squircle with glowing golden solar arc and precision diagonal photon trajectory.
 */
export const SolarTrackLogo: React.FC<SolarTrackLogoProps> = ({
  size = 40,
  className = '',
  glow = true,
}) => (
  <svg
    viewBox="0 0 100 100"
    width={size}
    height={size}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 select-none ${className}`}
  >
    <defs>
      {/* Brushed Obsidian Titanium Background Gradient */}
      <radialGradient id="stTitaniumBg" cx="45%" cy="40%" r="65%">
        <stop offset="0%" stopColor="#232834" />
        <stop offset="65%" stopColor="#0E1117" />
        <stop offset="100%" stopColor="#07080B" />
      </radialGradient>

      {/* Metallic Rim Gradient */}
      <linearGradient id="stRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4B5565" />
        <stop offset="50%" stopColor="#232834" />
        <stop offset="100%" stopColor="#11141A" />
      </linearGradient>

      {/* Solar Arc Radiant Ring Gradient */}
      <linearGradient id="stSolarArcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#B45309" />
        <stop offset="30%" stopColor="#D97706" />
        <stop offset="60%" stopColor="#F59E0B" />
        <stop offset="85%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#FEF08A" />
      </linearGradient>

      {glow && (
        <>
          {/* Solar Ring Ambient Glow */}
          <filter id="stSolarGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Photon Flash Glow Filter */}
          <filter id="stBeamGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </>
      )}

      {/* Photon Laser Beam Gradient */}
      <linearGradient id="stPhotonBeamGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
        <stop offset="20%" stopColor="#F59E0B" stopOpacity="0.8" />
        <stop offset="50%" stopColor="#FFFDF5" stopOpacity="1" />
        <stop offset="80%" stopColor="#FDE047" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Squircle Base with Metallic Rim */}
    <rect
      x="2"
      y="2"
      width="96"
      height="96"
      rx="22"
      fill="url(#stTitaniumBg)"
      stroke="url(#stRimGrad)"
      strokeWidth="1.5"
    />

    {/* Subtle Concentric Optical Ring */}
    <circle cx="50" cy="50" r="28" stroke="#F59E0B" strokeOpacity="0.15" strokeWidth="1" />

    {/* Soft Diffused Solar Corona Glow */}
    {glow && (
      <circle
        cx="50"
        cy="50"
        r="22"
        stroke="url(#stSolarArcGrad)"
        strokeWidth="7"
        strokeOpacity="0.3"
        filter="url(#stSolarGlow)"
      />
    )}

    {/* The Main Glowing Solar Arc Ring */}
    <circle
      cx="50"
      cy="50"
      r="22"
      stroke="url(#stSolarArcGrad)"
      strokeWidth="6.2"
      strokeLinecap="round"
    />

    {/* Secondary Thin Optical Ring (Echo of Irradiance) */}
    <circle
      cx="50"
      cy="50"
      r="24.5"
      stroke="#FDE047"
      strokeOpacity="0.25"
      strokeWidth="0.75"
    />

    {/* Diagonal 45-degree Photon Trajectory Stream */}
    {glow && (
      <line
        x1="18"
        y1="82"
        x2="82"
        y2="18"
        stroke="#F59E0B"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.4"
        filter="url(#stBeamGlow)"
      />
    )}
    <line
      x1="20"
      y1="80"
      x2="80"
      y2="20"
      stroke="url(#stPhotonBeamGrad)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />

    {/* Center Energy Flash Spark */}
    <circle cx="50" cy="50" r="1.5" fill="#FFFFFF" />
  </svg>
);
