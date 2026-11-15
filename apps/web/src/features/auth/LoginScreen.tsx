import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Gauge,
  Lock,
  Sparkles,
  User,
  Zap,
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
        mode: 'Morning Horizon',
        gradient: 'from-[#FFFDF5] via-[#FEF9E7] to-[#F0FDF4]',
        accent: '#F59E0B',
        sunX: 165,
        sunY: 62,
        sunLabel: '1.24 kW',
        sunColor: '#F59E0B',
      };
    }
    if (hour >= 12 && hour < 16) {
      return {
        mode: 'Solar Noon',
        gradient: 'from-[#FFFDF2] via-[#FEFCE8] to-[#E0F2FE]',
        accent: '#D97706',
        sunX: 250,
        sunY: 34,
        sunLabel: '1.95 kW Peak',
        sunColor: '#FBBF24',
      };
    }
    if (hour >= 16 && hour < 19) {
      return {
        mode: 'Golden Hour',
        gradient: 'from-[#FFF7ED] via-[#FFEDD5] to-[#FEF2F2]',
        accent: '#EA580C',
        sunX: 350,
        sunY: 78,
        sunLabel: '0.82 kW',
        sunColor: '#F97316',
      };
    }
    return {
      mode: 'Night Standby',
      gradient: 'from-[#F8FAFC] via-[#F1F5F9] to-[#FEF3C7]',
      accent: '#0284C7',
      sunX: 420,
      sunY: 110,
      sunLabel: 'Standby',
      sunColor: '#38BDF8',
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
      {/* Organic Atmospheric Ambient Backdrops (Seamless Soft Blending) */}
      <div className="absolute -top-40 -left-40 w-[650px] h-[650px] bg-amber-300/25 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-emerald-400/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-40 right-10 w-[600px] h-[600px] bg-sky-300/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-10 -right-20 w-[450px] h-[450px] bg-orange-300/20 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Container - Blended Dual-Stage Architecture */}
      <div className="w-full max-w-6xl relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Side: Visual Solar Intelligence Showcase */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-7 pr-0 lg:pr-4">
          {/* Brand Header */}
          <div className="flex items-center gap-3.5">
            <SolarTrackBrandLogo size={52} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  SolarTrack
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
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
          <div className="space-y-2.5">
            <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-black text-slate-900 tracking-tight leading-[1.18]">
              High-precision solar telemetry, calibrated for your rooftop.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-lg">
              Continuously modeling solar elevation, atmospheric aerosol transmittance, and inverter performance curves in real time.
            </p>
          </div>

          {/* High-Grade Studio Solar Curve Card (Apple/Tesla Grade Visualization) */}
          <div
            className="rounded-3xl p-6 sm:p-7 border border-white/80 shadow-xl shadow-slate-200/50 relative overflow-hidden space-y-5"
            style={{
              background: 'rgba(255, 255, 255, 0.76)',
              backdropFilter: 'blur(28px) saturate(1.9)',
              WebkitBackdropFilter: 'blur(28px) saturate(1.9)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 1), 0 20px 45px -15px rgba(15, 23, 42, 0.08)',
            }}
          >
            {/* Top Stat Row (Location-Free Privacy) */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
                <span className="text-xs font-bold text-slate-900 tracking-wide">
                  Rooftop Solar Generation Curve
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-extrabold text-amber-700 tracking-tight bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200/60">
                  3.27 kWp DC
                </span>
                <span className="text-slate-400 font-medium">·</span>
                <span className="font-semibold text-slate-600">3.0 kW AC</span>
              </div>
            </div>

            {/* High-Resolution SVG Solar Curve with Dual Trajectories & Precision Grid */}
            <div className="py-1 relative">
              <svg viewBox="0 0 500 150" className="w-full h-36 overflow-visible" fill="none">
                <defs>
                  {/* Subtle Grid Pattern */}
                  <linearGradient id="gridLineFade" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#CBD5E1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.05" />
                  </linearGradient>

                  {/* Expected Clear-Sky Theoretical Stroke */}
                  <linearGradient id="targetCurveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0284C7" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="#0284C7" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#0284C7" stopOpacity="0.3" />
                  </linearGradient>

                  {/* Active Generation Fill Gradient */}
                  <linearGradient id="genAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.38" />
                    <stop offset="45%" stopColor="#FBBF24" stopOpacity="0.18" />
                    <stop offset="85%" stopColor="#10B981" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Active Generation Line Stroke */}
                  <linearGradient id="genLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                    <stop offset="35%" stopColor="#F59E0B" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#D97706" stopOpacity="1" />
                    <stop offset="65%" stopColor="#F59E0B" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.4" />
                  </linearGradient>

                  {/* Live Sun Glowing Radial Halo */}
                  <radialGradient id="sunAuraGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFFBEB" stopOpacity="1" />
                    <stop offset="35%" stopColor="#FEF08A" stopOpacity="0.9" />
                    <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
                  </radialGradient>
                </defs>

                {/* Horizontal Grid Level Guidelines (0.0 kW, 1.2 kW, 2.4 kW) */}
                <line x1="20" y1="35" x2="480" y2="35" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="20" y1="80" x2="480" y2="80" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="20" y1="125" x2="480" y2="125" stroke="#E2E8F0" strokeWidth="1.2" />

                {/* Vertical Time Meridian Guides (8 AM, 10 AM, 12 PM Noon, 2 PM, 4 PM) */}
                <line x1="120" y1="30" x2="120" y2="125" stroke="url(#gridLineFade)" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="185" y1="25" x2="185" y2="125" stroke="url(#gridLineFade)" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="250" y1="20" x2="250" y2="125" stroke="url(#gridLineFade)" strokeWidth="1.2" strokeDasharray="3 3" />
                <line x1="315" y1="25" x2="315" y2="125" stroke="url(#gridLineFade)" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="380" y1="30" x2="380" y2="125" stroke="url(#gridLineFade)" strokeWidth="1" strokeDasharray="2 2" />

                {/* 1. Expected Sun Target (Dashed Blue Celestial Path) */}
                <path
                  d="M 35 125 C 100 120, 160 22, 250 22 C 340 22, 400 120, 465 125"
                  stroke="url(#targetCurveStroke)"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />

                {/* 2. Shaded Generation Area Under Parabola */}
                <path
                  d="M 35 125 C 100 122, 165 32, 250 32 C 335 32, 400 122, 465 125 L 465 125 L 35 125 Z"
                  fill="url(#genAreaGrad)"
                />

                {/* 3. Sculpted Real Generation Curve */}
                <path
                  d="M 35 125 C 100 122, 165 32, 250 32 C 335 32, 400 122, 465 125"
                  stroke="url(#genLineGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Solar Noon Apex Indicator Marker */}
                <circle cx="250" cy="32" r="3.5" fill="#D97706" />

                {/* Dynamic Animated Sun Orb Traveling on Trajectory */}
                <g transform={`translate(${atmosphericTheme.sunX}, ${atmosphericTheme.sunY})`}>
                  {/* Outer Pulsing Corona Waves */}
                  <circle cx="0" cy="0" r="22" fill={atmosphericTheme.sunColor} fillOpacity="0.12" className="animate-ping" style={{ animationDuration: '3.5s' }} />
                  <circle cx="0" cy="0" r="14" fill={atmosphericTheme.sunColor} fillOpacity="0.25" />
                  {/* Glowing Solar Core Sphere */}
                  <circle cx="0" cy="0" r="7.5" fill="url(#sunAuraGlow)" stroke="#FFFFFF" strokeWidth="2" className="shadow-lg" />
                  {/* Floating Wattage Badge Tag */}
                  <g transform="translate(0, -18)">
                    <rect x="-30" y="-14" width="60" height="17" rx="8.5" fill="#0F172A" fillOpacity="0.92" />
                    <text x="0" y="-2" textAnchor="middle" fill="#F8FAFC" fontSize="9.5" fontWeight="700" fontFamily="sans-serif">
                      {atmosphericTheme.sunLabel}
                    </text>
                  </g>
                </g>

                {/* Axis Labels */}
                <text x="35" y="142" fill="#94A3B8" fontSize="10" fontWeight="600" textAnchor="middle">06:27 AM</text>
                <text x="185" y="142" fill="#94A3B8" fontSize="10" fontWeight="600" textAnchor="middle">10:00 AM</text>
                <text x="250" y="142" fill="#D97706" fontSize="10.5" fontWeight="800" textAnchor="middle">11:53 AM (Noon)</text>
                <text x="315" y="142" fill="#94A3B8" fontSize="10" fontWeight="600" textAnchor="middle">02:00 PM</text>
                <text x="465" y="142" fill="#94A3B8" fontSize="10" fontWeight="600" textAnchor="middle">05:19 PM</text>
              </svg>
            </div>

            {/* Added Value: Real-Time Micro-Metrics Pill Strip */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
              <div className="p-2.5 rounded-2xl bg-white/70 border border-slate-200/70 shadow-2xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Est. Full Day</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">~12.4 kWh</div>
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-white/70 border border-slate-200/70 shadow-2xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Gauge className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Peak Power</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">1.95 kW</div>
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-white/70 border border-slate-200/70 shadow-2xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Clean Energy</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">100% Green</div>
                </div>
              </div>
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
