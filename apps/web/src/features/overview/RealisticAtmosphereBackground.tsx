import React, { useEffect, useRef, useMemo } from 'react';
import type { EffectiveAtmosphereMode } from './atmosphereStageData';

export interface RealisticAtmosphereBackgroundProps {
  mode: EffectiveAtmosphereMode;
  windKmH?: number;
  dni?: number;
  usAqi?: number;
  isNight?: boolean;
}

const RealisticCloudSvg: React.FC<{
  type: 'major' | 'minor' | 'wisp';
  width: number;
  height: number;
  opacity?: number;
  mode: EffectiveAtmosphereMode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ type, width, height, opacity = 1, mode, className = '', style = {} }) => {
  const isDark = mode === 'thunderstorm';
  const isRain = mode === 'rainy' || mode === 'showers';
  const fillGrad = isDark
    ? 'url(#stormCloudGrad)'
    : isRain
    ? 'url(#rainCloudGradBg)'
    : 'url(#dayPartlyCloudGrad)';
  const rimStroke = isDark ? '#FDE047' : isRain ? '#94A3B8' : '#FFFFFF';

  if (type === 'wisp') {
    return (
      <svg
        viewBox="0 0 200 40"
        width={width}
        height={height}
        className={`overflow-visible pointer-events-none select-none ${className}`}
        style={{ ...style, opacity }}
        fill="none"
      >
        <path
          d="M 15,20 C 35,14 65,22 95,16 C 125,10 155,20 185,15 C 170,25 140,20 110,25 C 80,30 50,22 25,26 Z"
          fill={fillGrad}
          filter="blur(1.5px)"
        />
      </svg>
    );
  }

  if (type === 'minor') {
    return (
      <svg
        viewBox="0 0 120 50"
        width={width}
        height={height}
        className={`overflow-visible pointer-events-none select-none ${className}`}
        style={{ ...style, opacity }}
        fill="none"
      >
        <path
          d="M 18,44 C 10,44 4,36 6,28 C 8,18 18,15 26,18 C 32,8 48,6 58,12 C 68,6 84,8 90,18 C 98,16 108,24 108,34 C 112,40 108,44 100,44 Z"
          fill={fillGrad}
          filter="drop-shadow(0 4px 12px rgba(15, 23, 42, 0.08))"
        />
        <path
          d="M 26,18 C 32,8 48,6 58,12 C 68,6 84,8 90,18"
          stroke={rimStroke}
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity={0.65}
        />
      </svg>
    );
  }

  // 'major'
  return (
    <svg
      viewBox="0 0 200 70"
      width={width}
      height={height}
      className={`overflow-visible pointer-events-none select-none ${className}`}
      style={{ ...style, opacity }}
      fill="none"
    >
      <path
        d="M 25,60 C 14,60 5,50 8,38 C 10,26 22,22 32,25 C 38,13 54,6 70,10 C 80,4 100,3 114,12 C 126,8 145,10 154,22 C 166,20 180,30 180,42 C 188,48 186,60 172,60 Z"
        fill={fillGrad}
        filter="drop-shadow(0 6px 16px rgba(15, 23, 42, 0.09))"
      />
      <path
        d="M 32,25 C 38,13 54,6 70,10 C 80,4 100,3 114,12 C 126,8 145,10 154,22"
        stroke={rimStroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity={0.8}
      />
    </svg>
  );
};

export const RealisticAtmosphereBackground: React.FC<RealisticAtmosphereBackgroundProps> = ({
  mode,
  windKmH = 9,
  isNight = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Normalized wind physics (0.5 to 3.0 multiplier for speed)
  const windFactor = useMemo(() => {
    const raw = Math.max(1, windKmH);
    return Math.min(3.0, Math.max(0.6, raw / 10));
  }, [windKmH]);

  // 60fps Canvas Simulation for Rain, Concentric Ripples, Lightning, Snow, Dust motes, and 100+ Night Stars
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 296);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    const isRain = mode === 'rainy' || mode === 'showers' || mode === 'thunderstorm';
    const isSnow = mode === 'snow';
    const isStarryNight = isNight || mode === 'night';
    const isHazy = mode === 'hazy';

    // 1. Raindrops & Concentric Ground Ripples
    interface RainDrop {
      x: number;
      y: number;
      length: number;
      speed: number;
      alpha: number;
      thickness: number;
    }
    interface Ripple {
      x: number;
      y: number;
      radiusX: number;
      radiusY: number;
      maxRadius: number;
      alpha: number;
    }
    const rainDrops: RainDrop[] = [];
    const ripples: Ripple[] = [];
    if (isRain) {
      const dropCount = mode === 'thunderstorm' ? 145 : mode === 'rainy' ? 110 : 85;
      for (let i = 0; i < dropCount; i++) {
        rainDrops.push({
          x: Math.random() * (width + 120) - 60,
          y: Math.random() * height,
          length: 14 + Math.random() * 18,
          speed: (16 + Math.random() * 8) * windFactor,
          alpha: 0.55 + Math.random() * 0.4,
          thickness: 1.2 + Math.random() * 1.3,
        });
      }
    }

    // 2. Snowflakes with Brownian Swirl
    interface SnowFlake {
      x: number;
      y: number;
      radius: number;
      speedY: number;
      speedX: number;
      angle: number;
      angleStep: number;
      alpha: number;
    }
    const snowFlakes: SnowFlake[] = [];
    if (isSnow) {
      for (let i = 0; i < 75; i++) {
        snowFlakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 1.2 + Math.random() * 3.0,
          speedY: (0.7 + Math.random() * 1.5) * windFactor,
          speedX: 0.3 * windFactor,
          angle: Math.random() * Math.PI * 2,
          angleStep: 0.02 + Math.random() * 0.03,
          alpha: 0.4 + Math.random() * 0.55,
        });
      }
    }

    // 3. Floating Micro-Dust Motes (Hazy Atmospheric Particulates)
    interface DustMote {
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      alpha: number;
    }
    const dustMotes: DustMote[] = [];
    if (isHazy) {
      for (let i = 0; i < 55; i++) {
        dustMotes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: 0.8 + Math.random() * 1.8,
          vx: (0.12 + Math.random() * 0.25) * windFactor,
          vy: (Math.random() - 0.5) * 0.2,
          alpha: 0.25 + Math.random() * 0.45,
        });
      }
    }

    // 4. Night Deep Space Starfield (100+ Stars)
    interface Star {
      x: number;
      y: number;
      radius: number;
      baseAlpha: number;
      twinkleSpeed: number;
      phase: number;
      color: string;
    }
    const stars: Star[] = [];
    if (isStarryNight) {
      const starColors = ['#FFFDF7', '#FEF08A', '#E0F2FE', '#BAE6FD', '#FDE68A', '#FFFFFF'];
      for (let i = 0; i < 110; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * (height * 0.9),
          radius: 0.5 + Math.random() * 1.5,
          baseAlpha: 0.2 + Math.random() * 0.7,
          twinkleSpeed: 0.015 + Math.random() * 0.045,
          phase: Math.random() * Math.PI * 2,
          color: starColors[Math.floor(Math.random() * starColors.length)],
        });
      }
    }

    // 5. Procedural Thunderstorm Lightning Bolt
    let lightningTimer = 0;
    let lightningDuration = 0;
    let boltPath: Array<{ x: number; y: number }> = [];

    const generateBolt = () => {
      boltPath = [];
      let startX = width * 0.3 + Math.random() * (width * 0.4);
      let startY = 8;
      boltPath.push({ x: startX, y: startY });

      while (startY < height * 0.75) {
        startY += 12 + Math.random() * 18;
        startX += (Math.random() - 0.48) * 34;
        boltPath.push({ x: startX, y: startY });
      }
    };

    let tick = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      tick++;

      // A. Render 100+ Night Stars
      if (isStarryNight && stars.length > 0) {
        for (const star of stars) {
          const currentAlpha = Math.max(
            0.1,
            Math.min(1.0, star.baseAlpha + Math.sin(tick * star.twinkleSpeed + star.phase) * 0.35)
          );
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx.fillStyle = star.color;
          ctx.globalAlpha = currentAlpha;
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      }

      // B. Render Rain & Concentric Ground Ripples
      if (isRain && rainDrops.length > 0) {
        const slantX = windKmH * 0.6;
        ctx.strokeStyle = mode === 'thunderstorm' ? '#BAE6FD' : '#FFFFFF';

        for (const drop of rainDrops) {
          ctx.lineWidth = drop.thickness;
          ctx.globalAlpha = drop.alpha;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + slantX, drop.y + drop.length);
          ctx.stroke();

          drop.x += slantX * 0.25 * windFactor;
          drop.y += drop.speed;

          // Impact at bottom of card -> spawn expanding ripple
          if (drop.y > height - 16) {
            if (Math.random() < 0.28) {
              ripples.push({
                x: drop.x + slantX,
                y: height - 10 + (Math.random() * 8 - 4),
                radiusX: 2,
                radiusY: 0.8,
                maxRadius: 7 + Math.random() * 7,
                alpha: 0.65,
              });
            }
            drop.y = -drop.length - Math.random() * 20;
            drop.x = Math.random() * (width + 120) - 60;
          }
        }

        // Render Concentric Ground Ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rp = ripples[i];
          ctx.beginPath();
          ctx.ellipse(rp.x, rp.y, rp.radiusX, rp.radiusY, 0, 0, Math.PI * 2);
          ctx.strokeStyle = '#BAE6FD';
          ctx.lineWidth = 1.0;
          ctx.globalAlpha = rp.alpha;
          ctx.stroke();

          rp.radiusX += 0.7;
          rp.radiusY += 0.28;
          rp.alpha -= 0.045;
          if (rp.alpha <= 0 || rp.radiusX >= rp.maxRadius) {
            ripples.splice(i, 1);
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // C. Render Thunderstorm Ambient Flash & Lightning Bolt
      if (mode === 'thunderstorm') {
        lightningTimer++;
        if (lightningTimer > 180 + Math.random() * 200) {
          lightningTimer = 0;
          lightningDuration = 7 + Math.floor(Math.random() * 8);
          generateBolt();
        }

        if (lightningDuration > 0) {
          lightningDuration--;
          // Whole-card ambient specular lightning flash
          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.fillRect(0, 0, width, height);

          if (boltPath.length > 1) {
            ctx.beginPath();
            ctx.moveTo(boltPath[0].x, boltPath[0].y);
            for (let i = 1; i < boltPath.length; i++) {
              ctx.lineTo(boltPath[i].x, boltPath[i].y);
            }
            ctx.strokeStyle = '#FEF08A';
            ctx.lineWidth = 3.0;
            ctx.shadowColor = '#FACC15';
            ctx.shadowBlur = 18;
            ctx.stroke();

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }
      }

      // D. Render Snowflakes with Brownian Swirl
      if (isSnow && snowFlakes.length > 0) {
        for (const sf of snowFlakes) {
          sf.angle += sf.angleStep;
          sf.x += Math.sin(sf.angle) * 1.1 + sf.speedX;
          sf.y += sf.speedY;

          if (sf.y > height + 5) {
            sf.y = -5;
            sf.x = Math.random() * width;
          }
          if (sf.x > width + 5) sf.x = -5;

          ctx.beginPath();
          ctx.arc(sf.x, sf.y, sf.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = sf.alpha;
          ctx.shadowColor = '#BAE6FD';
          ctx.shadowBlur = 5;
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      }

      // E. Render Floating Hazy Dust Motes
      if (isHazy && dustMotes.length > 0) {
        for (const dm of dustMotes) {
          dm.x += dm.vx;
          dm.y += dm.vy;
          if (dm.x > width + 10) dm.x = -10;
          if (dm.y > height + 10) dm.y = -10;
          if (dm.y < -10) dm.y = height + 10;

          ctx.beginPath();
          ctx.arc(dm.x, dm.y, dm.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#FEF08A';
          ctx.globalAlpha = dm.alpha;
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur = 4;
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [mode, windFactor, windKmH, isNight]);

  // Dynamic wind-scaled cloud drift conveyor durations (seconds for a full 100% loop)
  const cloudDuration1 = useMemo(() => Math.max(18, Math.round(36 / windFactor)), [windFactor]);
  const cloudDuration2 = useMemo(() => Math.max(26, Math.round(54 / windFactor)), [windFactor]);
  const cloudDuration3 = useMemo(() => Math.max(38, Math.round(82 / windFactor)), [windFactor]);

  // Translucent, natural cloud opacities: soft & realistic without obscuring live telemetry
  const cloudOpacities = useMemo(() => {
    switch (mode) {
      case 'partly_cloudy':
        return { wisp: 0.22, cumulus: 0.36, cloudlet: 0.26 };
      case 'cloudy':
        return { wisp: 0.45, cumulus: 0.65, cloudlet: 0.48 };
      case 'rainy':
      case 'showers':
        return { wisp: 0.38, cumulus: 0.55, cloudlet: 0.42 };
      case 'thunderstorm':
        return { wisp: 0.55, cumulus: 0.75, cloudlet: 0.60 };
      default:
        return { wisp: 0.20, cumulus: 0.30, cloudlet: 0.22 };
    }
  }, [mode]);

  const showClouds =
    mode === 'partly_cloudy' ||
    mode === 'cloudy' ||
    mode === 'rainy' ||
    mode === 'showers' ||
    mode === 'thunderstorm';

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 rounded-3xl">
      {/* SVG Definitions for Heat Shimmer & Realistic Cloud Fills */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="solarHeatShimmer" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03 0.08" numOctaves="1" result="noise">
              <animate
                attributeName="baseFrequency"
                dur="8s"
                values="0.03 0.08; 0.03 0.13; 0.03 0.08"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          {/* Natural Daytime Cumulus Cloud Fill (Sunlit Top, Soft Translucent Base) */}
          <linearGradient id="dayPartlyCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#F8FAFC" stopOpacity="0.82" />
            <stop offset="85%" stopColor="#E2E8F0" stopOpacity="0.60" />
            <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.40" />
          </linearGradient>

          {/* Rainy / Showers Cloud Fill */}
          <linearGradient id="rainCloudGradBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#94A3B8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#64748B" stopOpacity="0.75" />
          </linearGradient>

          {/* Thunderstorm Dark Charcoal Cloud Fill */}
          <linearGradient id="stormCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#334155" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.9" />
          </linearGradient>
        </defs>
      </svg>

      {/* 1. Luminous Ambient Sky Highlight (Clean & Radiant) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-45 mix-blend-soft-light"
        style={{
          background:
            mode === 'sunset'
              ? 'linear-gradient(to bottom, rgba(251, 113, 133, 0.45), rgba(245, 158, 11, 0.3) 50%, transparent 80%)'
              : mode === 'night'
              ? 'radial-gradient(ellipse at 50% 0%, rgba(30, 41, 59, 0.65) 0%, transparent 80%)'
              : mode === 'hazy'
              ? 'radial-gradient(ellipse at 50% 25%, rgba(254, 215, 170, 0.45) 0%, transparent 75%)'
              : 'radial-gradient(ellipse at 50% 20%, rgba(254, 240, 138, 0.55) 0%, transparent 75%)',
        }}
      />

      {/* 2. Natural Multi-Layer Scattered Clouds (Conveyor Wrap-Around, Wind Physics) */}
      {showClouds && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          {/* Layer 1: High-Altitude Soft Wispy Cirrus (Farthest Parallax, Slowest Drift) */}
          <div
            className="absolute inset-0 w-[200%] h-full flex pointer-events-none clouds-conveyor"
            style={{ animationDuration: `${cloudDuration3}s` }}
          >
            <div className="w-1/2 h-full relative shrink-0">
              <div className="absolute top-[8px] left-[5%]">
                <RealisticCloudSvg type="wisp" width={180} height={36} opacity={cloudOpacities.wisp} mode={mode} />
              </div>
              <div className="absolute top-[20px] left-[38%]">
                <RealisticCloudSvg type="wisp" width={220} height={42} opacity={cloudOpacities.wisp * 1.1} mode={mode} />
              </div>
              <div className="absolute top-[10px] left-[72%]">
                <RealisticCloudSvg type="wisp" width={190} height={38} opacity={cloudOpacities.wisp * 0.9} mode={mode} />
              </div>
            </div>
            <div className="w-1/2 h-full relative shrink-0" aria-hidden="true">
              <div className="absolute top-[8px] left-[5%]">
                <RealisticCloudSvg type="wisp" width={180} height={36} opacity={cloudOpacities.wisp} mode={mode} />
              </div>
              <div className="absolute top-[20px] left-[38%]">
                <RealisticCloudSvg type="wisp" width={220} height={42} opacity={cloudOpacities.wisp * 1.1} mode={mode} />
              </div>
              <div className="absolute top-[10px] left-[72%]">
                <RealisticCloudSvg type="wisp" width={190} height={38} opacity={cloudOpacities.wisp * 0.9} mode={mode} />
              </div>
            </div>
          </div>

          {/* Layer 2: Midground Scattered Fluffy Cumulus Clouds (Main Atmospheric Body) */}
          <div
            className="absolute inset-0 w-[200%] h-full flex pointer-events-none clouds-conveyor"
            style={{ animationDuration: `${cloudDuration2}s` }}
          >
            <div className="w-1/2 h-full relative shrink-0">
              <div className="absolute top-[22px] left-[8%]">
                <RealisticCloudSvg type="major" width={190} height={66} opacity={cloudOpacities.cumulus} mode={mode} />
              </div>
              <div className="absolute top-[50px] left-[28%]">
                <RealisticCloudSvg type="minor" width={120} height={50} opacity={cloudOpacities.cumulus * 0.88} mode={mode} />
              </div>
              <div className="absolute top-[14px] left-[52%]">
                <RealisticCloudSvg type="major" width={220} height={76} opacity={cloudOpacities.cumulus * 1.05} mode={mode} />
              </div>
              <div className="absolute top-[56px] left-[76%]">
                <RealisticCloudSvg type="minor" width={130} height={52} opacity={cloudOpacities.cumulus * 0.92} mode={mode} />
              </div>
              <div className="absolute top-[30px] left-[92%]">
                <RealisticCloudSvg type="minor" width={110} height={45} opacity={cloudOpacities.cumulus * 0.82} mode={mode} />
              </div>
            </div>
            <div className="w-1/2 h-full relative shrink-0" aria-hidden="true">
              <div className="absolute top-[22px] left-[8%]">
                <RealisticCloudSvg type="major" width={190} height={66} opacity={cloudOpacities.cumulus} mode={mode} />
              </div>
              <div className="absolute top-[50px] left-[28%]">
                <RealisticCloudSvg type="minor" width={120} height={50} opacity={cloudOpacities.cumulus * 0.88} mode={mode} />
              </div>
              <div className="absolute top-[14px] left-[52%]">
                <RealisticCloudSvg type="major" width={220} height={76} opacity={cloudOpacities.cumulus * 1.05} mode={mode} />
              </div>
              <div className="absolute top-[56px] left-[76%]">
                <RealisticCloudSvg type="minor" width={130} height={52} opacity={cloudOpacities.cumulus * 0.92} mode={mode} />
              </div>
              <div className="absolute top-[30px] left-[92%]">
                <RealisticCloudSvg type="minor" width={110} height={45} opacity={cloudOpacities.cumulus * 0.82} mode={mode} />
              </div>
            </div>
          </div>

          {/* Layer 3: Foreground Low Floating Cloudlets (Closest Parallax, Airy & Translucent) */}
          <div
            className="absolute inset-0 w-[200%] h-full flex pointer-events-none clouds-conveyor"
            style={{ animationDuration: `${cloudDuration1}s` }}
          >
            <div className="w-1/2 h-full relative shrink-0">
              <div className="absolute top-[74px] left-[16%]">
                <RealisticCloudSvg type="minor" width={115} height={48} opacity={cloudOpacities.cloudlet} mode={mode} />
              </div>
              <div className="absolute top-[86px] left-[44%]">
                <RealisticCloudSvg type="wisp" width={140} height={32} opacity={cloudOpacities.cloudlet * 0.85} mode={mode} />
              </div>
              <div className="absolute top-[80px] left-[66%]">
                <RealisticCloudSvg type="minor" width={120} height={50} opacity={cloudOpacities.cloudlet * 0.95} mode={mode} />
              </div>
              <div className="absolute top-[88px] left-[86%]">
                <RealisticCloudSvg type="minor" width={95} height={40} opacity={cloudOpacities.cloudlet * 0.8} mode={mode} />
              </div>
            </div>
            <div className="w-1/2 h-full relative shrink-0" aria-hidden="true">
              <div className="absolute top-[74px] left-[16%]">
                <RealisticCloudSvg type="minor" width={115} height={48} opacity={cloudOpacities.cloudlet} mode={mode} />
              </div>
              <div className="absolute top-[86px] left-[44%]">
                <RealisticCloudSvg type="wisp" width={140} height={32} opacity={cloudOpacities.cloudlet * 0.85} mode={mode} />
              </div>
              <div className="absolute top-[80px] left-[66%]">
                <RealisticCloudSvg type="minor" width={120} height={50} opacity={cloudOpacities.cloudlet * 0.95} mode={mode} />
              </div>
              <div className="absolute top-[88px] left-[86%]">
                <RealisticCloudSvg type="minor" width={95} height={40} opacity={cloudOpacities.cloudlet * 0.8} mode={mode} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Canvas Particle Stage (Rain streaks, ripples, snow, lightning, stars, dust motes) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};
