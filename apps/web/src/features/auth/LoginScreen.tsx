import React, { useState } from 'react';
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
 * Official SolarTrack Brand Logo SVG.
 * Features the signature golden solar core, orbital tracking trajectory sweep,
 * emerald node indicators, and the solar panel foundation grid.
 */
const SolarTrackBrandLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 44,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    <defs>
      <linearGradient id="brandSunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="brandTrackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <filter id="brandGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#F59E0B" floodOpacity="0.45" />
      </filter>
    </defs>
    {/* Dark glass squircle base */}
    <rect
      width="64"
      height="64"
      rx="18"
      fill="#0B132B"
      stroke="rgba(255, 255, 255, 0.15)"
      strokeWidth="1.5"
    />
    {/* Solar Core Orb with Radial Bloom */}
    <circle cx="32" cy="32" r="11" fill="url(#brandSunGrad)" filter="url(#brandGlow)" />
    {/* Solar Tracking Orbital Sweep Arc */}
    <path
      d="M 16 37 A 19 19 0 1 1 48 37"
      fill="none"
      stroke="url(#brandTrackGrad)"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    {/* Active Tracking Node Points */}
    <circle cx="32" cy="13" r="2.5" fill="#34D399" />
    <circle cx="18" cy="21" r="2" fill="#34D399" />
    <circle cx="46" cy="21" r="2" fill="#34D399" />
    {/* Solar Panel Foundation Mount */}
    <path d="M 22 47 L 42 47" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M 26 43 L 38 43" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
    <path d="M 32 38 L 32 47" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          res?.error || 'Incorrect username or password. Please verify and try again.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error connecting to the telemetry gateway.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-slate-950 text-slate-100 font-sans overflow-hidden selection:bg-amber-500/30 selection:text-amber-200">
      {/* Dynamic Ambient Background Gradients & Glows */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Soft Golden Solar Dawn Orb on Left */}
        <div className="absolute -top-40 -left-40 w-[750px] h-[750px] bg-gradient-to-tr from-amber-500/15 via-orange-600/10 to-transparent rounded-full blur-[140px]" />
        {/* Deep Cyan / Emerald Atmospheric Glow in Center */}
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/[0.05] rounded-full blur-[150px]" />
        {/* Soft Indigo Backlight on Right */}
        <div className="absolute -bottom-32 -right-32 w-[700px] h-[700px] bg-gradient-to-tl from-indigo-600/15 via-amber-500/[0.05] to-transparent rounded-full blur-[140px]" />
        {/* Subtle Starlight / Grid Dust Overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Main Unified Responsive Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-16">
        {/* Left Column: Visual Showcase & Brand Narrative */}
        <div className="w-full lg:flex-1 flex flex-col justify-center space-y-8 max-w-xl">
          {/* Header Brand Link */}
          <div className="flex items-center gap-3.5 group cursor-default">
            <SolarTrackBrandLogo size={46} className="shadow-lg shadow-amber-500/15" />
            <div>
              <span className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                SolarTrack
              </span>
              <span className="text-[11px] font-semibold text-amber-400/90 tracking-widest uppercase block -mt-0.5">
                Rooftop Solar Intelligence
              </span>
            </div>
          </div>

          {/* Headline & Description */}
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-white tracking-tight leading-[1.15]">
              Real-time solar curves, microclimate &amp; physics.
            </h1>
            <p className="text-sm sm:text-base text-slate-400 font-normal leading-relaxed">
              Continuous 5-minute inverter telemetry, astronomical clear-sky tracking, and automated performance analytics in one clean view.
            </p>
          </div>

          {/* Interactive Solar Arc Visualization Card */}
          <div className="p-6 rounded-3xl bg-slate-900/40 border border-white/10 backdrop-blur-xl shadow-2xl space-y-4 relative overflow-hidden group">
            {/* Top Bar with Live Parameters */}
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 font-medium">Station Reference</span>
                <div className="text-slate-200 font-bold text-sm mt-0.5">Kanpur Rooftop</div>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-medium">System Capacity</span>
                <div className="text-amber-400 font-bold text-sm mt-0.5">3.27 kWp DC</div>
              </div>
            </div>

            {/* Precision SVG Trajectory Arc with Glow & Animation */}
            <div className="relative pt-2">
              <svg viewBox="0 0 420 120" className="w-full h-24 overflow-visible" fill="none">
                <defs>
                  <linearGradient id="solarPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                    <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.15" />
                  </linearGradient>
                  <linearGradient id="solarShadedFill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="sunOrbGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.8" />
                  </filter>
                </defs>

                {/* Horizon Ground Line */}
                <line
                  x1="10"
                  y1="108"
                  x2="410"
                  y2="108"
                  stroke="#334155"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />

                {/* Shaded Area Under Arc */}
                <path
                  d="M 25 108 Q 210 12 395 108 L 395 108 L 25 108 Z"
                  fill="url(#solarShadedFill)"
                />

                {/* Golden Trajectory Path */}
                <path
                  d="M 25 108 Q 210 12 395 108"
                  stroke="url(#solarPathGrad)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />

                {/* Pulsing Sun Orb at Solar Noon */}
                <g transform="translate(210, 60)">
                  <circle cx="0" cy="0" r="16" fill="#f59e0b" fillOpacity="0.2" className="animate-ping" style={{ animationDuration: '3s' }} />
                  <circle cx="0" cy="0" r="8" fill="#fbbf24" filter="url(#sunOrbGlow)" />
                  <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
                </g>

                {/* Sunrise Node */}
                <circle cx="25" cy="108" r="3" fill="#f59e0b" />
                {/* Sunset Node */}
                <circle cx="395" cy="108" r="3" fill="#f59e0b" />
              </svg>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mt-2">
                <span>06:27 AM Sunrise</span>
                <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Solar Noon 11:53 AM
                </span>
                <span>05:19 PM Sunset</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Frosted Glassmorphism Authentication Card (Blends Seamlessly) */}
        <div className="w-full lg:w-[440px] xl:w-[460px] shrink-0">
          <div
            className="rounded-3xl p-8 sm:p-10 border border-white/[0.12] shadow-2xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.72) 0%, rgba(15, 23, 42, 0.88) 100%)',
              backdropFilter: 'blur(32px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
              boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Top Accent Light Highlight */}
            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />

            <div className="mb-7">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                Welcome back
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Enter your credentials to load live generation &amp; inverter telemetry.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
                <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
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
                    className="w-full bg-slate-950/60 border border-slate-700/70 focus:border-amber-400 focus:bg-slate-950/80 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none transition duration-150 pr-10"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full bg-slate-950/60 border border-slate-700/70 focus:border-amber-400 focus:bg-slate-950/80 focus:ring-4 focus:ring-amber-500/10 rounded-2xl px-4 py-3 text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none transition duration-150 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-0.5 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-3 py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold text-sm tracking-tight transition duration-200 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-1 transition duration-150" />
                  </>
                )}
              </button>
            </form>

            {/* Minimalist Bottom Info */}
            <div className="mt-6 pt-5 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400/80" />
                Waaree Direct Cloud
              </span>
              <span className="text-[11px] text-slate-400">v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
