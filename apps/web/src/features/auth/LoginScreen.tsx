import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Sparkles,
  User,
} from 'lucide-react';
import { ApiService } from '../../shared/api/solarApi';

interface LoginScreenProps {
  onLoginSuccess: (user?: any) => void;
}

/**
 * Official SolarTrack squircle brand logo from favicon.svg
 */
const SolarTrackBrandLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 48,
  className = '',
}) => (
  <svg
    viewBox="0 0 64 64"
    width={size}
    height={size}
    fill="none"
    className={`shrink-0 drop-shadow-sm select-none ${className}`}
  >
    <defs>
      <linearGradient id="brandSunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="brandTrackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#107C41" />
        <stop offset="100%" stopColor="#16A34A" />
      </linearGradient>
      <filter id="brandGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#D97706" floodOpacity="0.3" />
      </filter>
    </defs>

    {/* Background rounded squircle */}
    <rect width="64" height="64" rx="16" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />

    {/* Solar Core Orb with Subtle Glow */}
    <circle cx="32" cy="32" r="11" fill="url(#brandSunGrad)" filter="url(#brandGlow)" />

    {/* Solar Tracking Orbital Trajectory Sweep */}
    <path
      d="M 16 37 A 19 19 0 1 1 48 37"
      fill="none"
      stroke="url(#brandTrackGrad)"
      strokeWidth="3.5"
      strokeLinecap="round"
    />

    {/* Active Tracking Ray Points */}
    <circle cx="32" cy="13" r="2.5" fill="#107C41" />
    <circle cx="18" cy="21" r="2" fill="#107C41" />
    <circle cx="46" cy="21" r="2" fill="#107C41" />

    {/* Solar Panel Foundation Grid */}
    <path d="M 22 47 L 42 47" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M 26 43 L 38 43" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
    <path d="M 32 38 L 32 47" stroke="#107C41" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic atmospheric palette based on local hour
  const atmosphericTheme = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return {
        mode: 'Morning Sun',
        gradient: 'from-[#FFFDF5] via-[#FEF9E7] to-[#F0FDF4]',
        accent: '#F59E0B',
        accentBg: 'bg-amber-500/10 text-amber-800 border-amber-200/80',
        sunX: 130,
        sunY: 62,
        sunColor: '#F59E0B',
        label: 'Morning Solar Harvest',
      };
    }
    if (hour >= 12 && hour < 16) {
      return {
        mode: 'Solar Noon',
        gradient: 'from-[#FFFDF2] via-[#FEFCE8] to-[#E0F2FE]',
        accent: '#D97706',
        accentBg: 'bg-amber-500/10 text-amber-800 border-amber-200/80',
        sunX: 200,
        sunY: 38,
        sunColor: '#FBBF24',
        label: 'Peak Direct Irradiance',
      };
    }
    if (hour >= 16 && hour < 19) {
      return {
        mode: 'Golden Hour',
        gradient: 'from-[#FFF7ED] via-[#FFEDD5] to-[#FEF2F2]',
        accent: '#EA580C',
        accentBg: 'bg-orange-500/10 text-orange-800 border-orange-200/80',
        sunX: 285,
        sunY: 72,
        sunColor: '#F97316',
        label: 'Golden Hour Tracking',
      };
    }
    return {
      mode: 'Clear Twilight',
      gradient: 'from-[#F8FAFC] via-[#F1F5F9] to-[#FEF3C7]',
      accent: '#0284C7',
      accentBg: 'bg-sky-500/10 text-sky-800 border-sky-200/80',
      sunX: 340,
      sunY: 96,
      sunColor: '#38BDF8',
      label: 'Night Standby & Sync',
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await ApiService.login({
        username: username.trim(),
        password: password.trim(),
      });
      if (res && res.authenticated) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(
          res?.error || 'Invalid credentials. Please verify your username and password.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error connecting to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-full relative flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-hidden bg-gradient-to-br ${atmosphericTheme.gradient} text-slate-900 font-sans selection:bg-amber-500/20`}
    >
      {/* Organic Atmospheric Ambient Backdrops (Seamless Blending) */}
      <div className="absolute -top-40 -left-40 w-[650px] h-[650px] bg-amber-300/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-emerald-400/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-40 right-10 w-[600px] h-[600px] bg-sky-300/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-10 -right-20 w-[450px] h-[450px] bg-orange-300/20 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Container - Blended Dual-Stage Architecture */}
      <div className="w-full max-w-6xl relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Side: Visual Solar Intelligence Showcase */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-8 pr-0 lg:pr-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3.5">
            <SolarTrackBrandLogo size={52} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  SolarTrack
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Rooftop Solar Intelligence &amp; Astronomy Engine
              </p>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-slate-900 tracking-tight leading-[1.18]">
              High-precision solar telemetry, calibrated for your rooftop.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-lg">
              Continuously modeling solar elevation, atmospheric aerosol transmittance, and inverter performance curves in real time.
            </p>
          </div>

          {/* Dynamic Celestial Solar Arc Card (SVG + Fluid Animation) */}
          <div
            className="rounded-3xl p-6 sm:p-7 border border-white/80 shadow-xl shadow-slate-200/60 relative overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.72)',
              backdropFilter: 'blur(24px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 1), 0 20px 40px -15px rgba(15, 23, 42, 0.07)',
            }}
          >
            {/* Top Stat Row */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-bold text-slate-800 tracking-wide">
                  Kanpur Rooftop Station
                </span>
              </div>
              <span className="text-xs font-extrabold text-amber-700 tracking-tight">
                3.27 kWp DC · 3.0 kW AC
              </span>
            </div>

            {/* Celestial Parabolic Solar Arc SVG */}
            <div className="py-2 relative">
              <svg viewBox="0 0 400 130" className="w-full h-32 overflow-visible" fill="none">
                <defs>
                  {/* Arc Stroke Gradient */}
                  <linearGradient id="solarPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D97706" stopOpacity="0.3" />
                    <stop offset="25%" stopColor="#F59E0B" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#FBBF24" stopOpacity="1" />
                    <stop offset="75%" stopColor="#F59E0B" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#D97706" stopOpacity="0.3" />
                  </linearGradient>

                  {/* Shaded Area Under Parabola */}
                  <linearGradient id="areaGlowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.45" />
                    <stop offset="60%" stopColor="#FEF9C3" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Pulsing Sun Radial Gradient */}
                  <radialGradient id="liveSunOrb" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFFBEB" />
                    <stop offset="40%" stopColor="#FDE047" />
                    <stop offset="85%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#D97706" />
                  </radialGradient>
                </defs>

                {/* Horizon Baseline */}
                <line
                  x1="10"
                  y1="115"
                  x2="390"
                  y2="115"
                  stroke="#E2E8F0"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />

                {/* Shaded Area Under Parabola */}
                <path
                  d="M 20 115 Q 200 15 380 115 Z"
                  fill="url(#areaGlowGrad)"
                />

                {/* Parabolic Sun Trajectory Curve */}
                <path
                  d="M 20 115 Q 200 15 380 115"
                  stroke="url(#solarPathGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Solar Noon Apex Guide Point */}
                <circle cx="200" cy="40" r="3.5" fill="#CBD5E1" />
                <line x1="200" y1="45" x2="200" y2="115" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />

                {/* Animated Dynamic Sun Position Based on Time of Day */}
                <g transform={`translate(${atmosphericTheme.sunX}, ${atmosphericTheme.sunY})`}>
                  {/* Outer Pulsing Corona Rays */}
                  <circle cx="0" cy="0" r="18" fill={atmosphericTheme.sunColor} fillOpacity="0.15" className="animate-ping" style={{ animationDuration: '3s' }} />
                  <circle cx="0" cy="0" r="12" fill={atmosphericTheme.sunColor} fillOpacity="0.25" />
                  {/* Glowing Solar Core */}
                  <circle cx="0" cy="0" r="6.5" fill="url(#liveSunOrb)" stroke="#FFFFFF" strokeWidth="1.5" className="shadow-md" />
                </g>
              </svg>
            </div>

            {/* Bottom Timeline Legend */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pt-2 border-t border-slate-100/80">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                06:27 AM Sunrise
              </span>
              <span className="text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 shadow-2xs">
                Solar Noon 11:53 AM
              </span>
              <span className="flex items-center gap-1.5">
                05:19 PM Sunset
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Seamless Floating Apple-Glass Authentication Pane */}
        <div className="lg:col-span-5 flex justify-center">
          <div
            className="w-full max-w-[420px] rounded-3xl p-7 sm:p-9 border border-white/90 shadow-2xl relative"
            style={{
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(32px) saturate(2)',
              WebkitBackdropFilter: 'blur(32px) saturate(2)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 1), 0 24px 60px -15px rgba(15, 23, 42, 0.08), 0 4px 16px -2px rgba(15, 23, 42, 0.03)',
            }}
          >
            {/* Header */}
            <div className="mb-7">
              <h2 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 tracking-tight">
                Sign In
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-1.5">
                Access your real-time generation and daily telemetry
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200/80 text-rose-800 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-150">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Username or Phone
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter phone or username"
                    required
                    autoFocus
                    className="w-full bg-white/90 border border-slate-200/90 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none transition shadow-2xs pr-11"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full bg-white/90 border border-slate-200/90 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none transition shadow-2xs pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 active:from-slate-950 active:to-slate-900 text-white font-bold text-sm tracking-tight transition duration-150 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Connecting to Waaree Cloud...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Station</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition" />
                  </>
                )}
              </button>
            </form>

            {/* Seamless Footer */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Direct Cloud Sync
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-semibold">
                <Sparkles className="w-3 h-3 text-amber-500" />
                {atmosphericTheme.mode}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
