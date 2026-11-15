import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
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
  size = 44,
  className = '',
}) => (
  <svg
    viewBox="0 0 64 64"
    width={size}
    height={size}
    fill="none"
    className={`shrink-0 select-none ${className}`}
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
    </defs>

    {/* Background rounded squircle */}
    <rect width="64" height="64" rx="15" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.2" />

    {/* Solar Core Orb */}
    <circle cx="32" cy="32" r="10.5" fill="url(#brandSunGrad)" />

    {/* Solar Tracking Orbital Trajectory Sweep */}
    <path
      d="M 16 37 A 19 19 0 1 1 48 37"
      fill="none"
      stroke="url(#brandTrackGrad)"
      strokeWidth="3.2"
      strokeLinecap="round"
    />

    {/* Tracking Points */}
    <circle cx="32" cy="13" r="2.2" fill="#107C41" />
    <circle cx="18" cy="21" r="1.8" fill="#107C41" />
    <circle cx="46" cy="21" r="1.8" fill="#107C41" />

    {/* Foundation Grid */}
    <path d="M 22 47 L 42 47" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M 26 43 L 38 43" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M 32 38 L 32 47" stroke="#107C41" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

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
      className={`min-h-screen w-full relative flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-hidden bg-gradient-to-br ${atmosphericTheme.gradient} text-slate-900 font-sans selection:bg-amber-500/20`}
    >
      {/* Subtle organic light diffusions (soft, non-distracting) */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-amber-200/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 right-10 w-[550px] h-[550px] bg-emerald-100/30 rounded-full blur-[150px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-5xl relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        {/* Left Side: Editorial Solar Intelligence Showcase */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-8 pr-0 lg:pr-2">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <SolarTrackBrandLogo size={46} />
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                SolarTrack
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Rooftop Solar Intelligence
              </p>
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-slate-900 tracking-tight leading-[1.15]">
              Real-time solar telemetry &amp; rooftop intelligence.
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-lg">
              Track daily generation curves, irradiance modeling, and inverter telemetry in one seamless view.
            </p>
          </div>

          {/* Clean, Human-Designed Solar Curve Card */}
          <div
            className="rounded-2xl p-6 sm:p-7 border border-slate-200/70 bg-white/80 shadow-lg shadow-slate-200/40 backdrop-blur-md space-y-4"
          >
            {/* Header: Pure Typography, Zero Pills */}
            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
              <span className="font-semibold text-slate-800">
                Solar Generation Profile
              </span>
              <span className="text-slate-500 font-medium">
                3.27 kWp DC · 3.0 kW AC
              </span>
            </div>

            {/* Precision SVG Solar Curve */}
            <div className="py-2">
              <svg viewBox="0 0 500 145" className="w-full h-36 overflow-visible" fill="none">
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
                <line x1="20" y1="40" x2="480" y2="40" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="20" y1="80" x2="480" y2="80" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="20" y1="120" x2="480" y2="120" stroke="#E2E8F0" strokeWidth="1" />

                {/* Vertical Solar Noon Guide */}
                <line x1="250" y1="26" x2="250" y2="120" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />

                {/* Clear Sky Theoretical Reference Curve */}
                <path
                  d="M 35 120 C 100 118, 160 26, 250 26 C 340 26, 400 118, 465 120"
                  stroke="#94A3B8"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  strokeOpacity="0.5"
                />

                {/* Shaded Area Under Curve */}
                <path
                  d="M 35 120 C 100 118, 165 32, 250 32 C 335 32, 400 118, 465 120 L 465 120 L 35 120 Z"
                  fill="url(#curveFillGrad)"
                />

                {/* Real-world Generation Curve */}
                <path
                  d="M 35 120 C 100 118, 165 32, 250 32 C 335 32, 400 118, 465 120"
                  stroke="url(#curveLineGrad)"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                />

                {/* Solar Noon Apex Marker */}
                <circle cx="250" cy="32" r="3" fill="#D97706" />

                {/* Clean Sun Position Orb (No pills, no ping gimmicks) */}
                <g transform={`translate(${atmosphericTheme.sunX}, ${atmosphericTheme.sunY})`}>
                  <circle cx="0" cy="0" r="12" fill={atmosphericTheme.sunColor} fillOpacity="0.18" />
                  <circle cx="0" cy="0" r="6" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
                </g>

                {/* Minimalist Axis Timestamps */}
                <text x="35" y="137" fill="#94A3B8" fontSize="10" fontWeight="500" textAnchor="middle">06:27 AM</text>
                <text x="250" y="137" fill="#64748B" fontSize="10" fontWeight="600" textAnchor="middle">Solar Noon 11:53 AM</text>
                <text x="465" y="137" fill="#94A3B8" fontSize="10" fontWeight="500" textAnchor="middle">05:19 PM</text>
              </svg>
            </div>

            {/* Calm, Understated Baseline Note */}
            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Astronomical daylight window · 10h 52m</span>
              <span>Kanpur Array · 26.5° N</span>
            </div>
          </div>
        </div>

        {/* Right Side: Clean Apple-Grade Authentication Pane */}
        <div className="lg:col-span-5 flex justify-center">
          <div
            className="w-full max-w-[400px] rounded-2xl p-7 sm:p-8 bg-white/90 border border-slate-200/80 shadow-xl shadow-slate-200/50 backdrop-blur-md"
          >
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign In
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-1">
                Enter your credentials to access your station.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Username or Phone
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. 9876543210 or user@example.com"
                    required
                    autoFocus
                    className="w-full bg-slate-50/70 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full bg-slate-50/70 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-sm tracking-tight transition duration-150 shadow-sm hover:shadow disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
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
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center text-xs text-slate-400 gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Secure Waaree Telemetry Link</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
