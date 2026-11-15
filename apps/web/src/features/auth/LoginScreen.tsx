import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  User,
} from 'lucide-react';
import { ApiService } from '../../shared/api/solarApi';
import { SolarTrackLogo } from '../../shared/components/SolarTrackLogo';

interface LoginScreenProps {
  onLoginSuccess: (user?: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic subtle atmospheric background according to hour of day
  const atmosphericTheme = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return {
        gradient: 'from-[#FFFDF7] via-[#FFFBEB] to-[#F0FDF4]',
        sunX: 160,
        sunY: 65,
        sunColor: '#F59E0B',
      };
    }
    if (hour >= 12 && hour < 16) {
      return {
        gradient: 'from-[#FFFDF5] via-[#FEFCE8] to-[#F0F9FF]',
        sunX: 250,
        sunY: 34,
        sunColor: '#F59E0B',
      };
    }
    if (hour >= 16 && hour < 19) {
      return {
        gradient: 'from-[#FFFBF5] via-[#FFF7ED] to-[#FEF2F2]',
        sunX: 340,
        sunY: 75,
        sunColor: '#EA580C',
      };
    }
    return {
      gradient: 'from-[#F8FAFC] via-[#F1F5F9] to-[#FEF3C7]',
      sunX: 420,
      sunY: 110,
      sunColor: '#0284C7',
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
      className={`min-h-screen w-full relative flex items-center justify-center py-8 sm:py-12 px-6 sm:px-10 lg:px-14 xl:px-20 overflow-x-hidden bg-gradient-to-br ${atmosphericTheme.gradient} text-slate-900 font-sans selection:bg-amber-500/20`}
    >
      {/* Subtle organic light diffusions (soft, non-distracting) */}
      <div className="absolute -top-32 -left-32 w-[650px] h-[650px] bg-amber-200/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 right-10 w-[600px] h-[600px] bg-emerald-100/30 rounded-full blur-[150px] pointer-events-none" />

      {/* Main Container: Explicit 55% / 45% Split Architecture */}
      <div className="w-full max-w-[1380px] relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14 xl:gap-20">
        
        {/* Left Side: 55% Column */}
        <div className="w-full lg:w-[55%] flex flex-col justify-center space-y-6 sm:space-y-7">
          {/* Brand Header */}
          <div className="flex items-center gap-3.5">
            <SolarTrackLogo size={50} className="shadow-md rounded-2xl" />
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                SolarTrack
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Rooftop Solar
              </p>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-slate-900 tracking-tight leading-[1.12]">
              Track your solar energy in real time.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-xl">
              See your daily power generation, savings, and solar system performance in one simple place.
            </p>
          </div>

          {/* Clean, Full-Width Solar Curve Card */}
          <div
            className="w-full rounded-3xl p-6 sm:p-8 border border-slate-200/80 bg-white/85 shadow-xl shadow-slate-200/40 backdrop-blur-md space-y-5"
          >
            {/* Header: Pure Typography, Zero Pills */}
            <div className="flex items-center justify-between text-xs text-slate-500 pb-2.5 border-b border-slate-100">
              <span className="font-semibold text-slate-800 text-sm">
                Today's Solar Power
              </span>
              <span className="text-slate-500 font-medium text-xs">
                3.3 kW System
              </span>
            </div>

            {/* Precision SVG Solar Curve */}
            <div className="py-2">
              <svg viewBox="0 0 520 145" className="w-full h-38 overflow-visible" fill="none">
                <defs>
                  {/* Generation Area Gradient */}
                  <linearGradient id="curveFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.28" />
                    <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Curve Line Gradient */}
                  <linearGradient id="curveLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="40%" stopColor="#F59E0B" />
                    <stop offset="60%" stopColor="#D97706" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>

                {/* Subtle Baseline Grid */}
                <line x1="20" y1="40" x2="500" y2="40" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="20" y1="80" x2="500" y2="80" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="20" y1="120" x2="500" y2="120" stroke="#E2E8F0" strokeWidth="1" />

                {/* Vertical Solar Noon Guide */}
                <line x1="260" y1="26" x2="260" y2="120" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />

                {/* Clear Sky Theoretical Reference Curve */}
                <path
                  d="M 35 120 C 110 118, 170 26, 260 26 C 350 26, 410 118, 485 120"
                  stroke="#94A3B8"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  strokeOpacity="0.5"
                />

                {/* Shaded Area Under Curve */}
                <path
                  d="M 35 120 C 110 118, 175 32, 260 32 C 345 32, 410 118, 485 120 L 485 120 L 35 120 Z"
                  fill="url(#curveFillGrad)"
                />

                {/* Real-world Generation Curve */}
                <path
                  d="M 35 120 C 110 118, 175 32, 260 32 C 345 32, 410 118, 485 120"
                  stroke="url(#curveLineGrad)"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                />

                {/* Solar Noon Apex Marker */}
                <circle cx="260" cy="32" r="3.5" fill="#D97706" />

                {/* Clean Sun Position Orb (No pills, no ping gimmicks) */}
                <g transform={`translate(${atmosphericTheme.sunX * 1.04}, ${atmosphericTheme.sunY})`}>
                  <circle cx="0" cy="0" r="12" fill={atmosphericTheme.sunColor} fillOpacity="0.18" />
                  <circle cx="0" cy="0" r="6" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
                </g>

                {/* Minimalist Axis Timestamps */}
                <text x="35" y="137" fill="#94A3B8" fontSize="10.5" fontWeight="500" textAnchor="middle">06:27 AM</text>
                <text x="260" y="137" fill="#64748B" fontSize="11" fontWeight="600" textAnchor="middle">Peak Noon 11:53 AM</text>
                <text x="485" y="137" fill="#94A3B8" fontSize="10.5" fontWeight="500" textAnchor="middle">05:19 PM</text>
              </svg>
            </div>

            {/* Calm, Understated Baseline Note */}
            <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Sunlight today: 10 hrs 52 mins</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Connected to Inverter
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: 45% Column */}
        <div className="w-full lg:w-[45%] flex items-center justify-center lg:justify-end">
          <div
            className="w-full max-w-[440px] rounded-3xl p-8 sm:p-10 bg-white/90 border border-slate-200/80 shadow-2xl shadow-slate-200/60 backdrop-blur-md"
          >
            {/* Header */}
            <div className="mb-7">
              <h2 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
                Sign In
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1.5">
                Enter your details to view your solar dashboard.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Phone or Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter phone or username"
                    required
                    autoFocus
                    className="w-full bg-slate-50/70 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
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
                    className="w-full bg-slate-50/70 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
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
                className="w-full mt-2 py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-sm tracking-tight transition duration-150 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition" />
                  </>
                )}
              </button>
            </form>

            {/* Clean Footer Note */}
            <div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-center text-xs text-slate-400 gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Encrypted &amp; Secure</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
