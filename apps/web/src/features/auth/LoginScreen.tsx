import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  User,
  ShieldCheck,
  Trash2,
  Sun,
  Zap,
} from 'lucide-react';
import { ApiService } from '../../shared/api/solarApi';
import { SolarTrackLogo } from '../../shared/components/SolarTrackLogo';

interface LoginScreenProps {
  onLoginSuccess: (user?: any) => void;
}

interface SavedProfile {
  username: string;
  password?: string;
  displayName?: string;
  savedAt: number;
}

const SAVED_PROFILE_STORAGE_KEY = 'solartrack_saved_profile';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  // 1. Lazy initialize saved profile to prevent cascading re-renders and eliminate layout shift
  const [savedProfile, setSavedProfile] = useState<SavedProfile | null>(() => {
    try {
      const raw = localStorage.getItem(SAVED_PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.username && parsed.password) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage read errors
    }
    return null;
  });

  const [isQuickMode, setIsQuickMode] = useState<boolean>(() => Boolean(savedProfile));
  const [username, setUsername] = useState<string>(() => savedProfile?.username || '');
  const [password, setPassword] = useState<string>(() => savedProfile?.password || '');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lazy initialize initial hour to keep render pure
  const [currentHour] = useState(() => new Date().getHours());

  // Dynamic subtle atmospheric background according to hour of day
  const atmosphericTheme = useMemo(() => {
    if (currentHour >= 6 && currentHour < 12) {
      return {
        gradient: 'from-[#FFFDF7] via-[#FFFBEB] to-[#F0FDF4]',
        leftBg: 'from-amber-50/40 via-white/60 to-emerald-50/20',
        sunX: 160,
        sunY: 65,
        sunColor: '#F59E0B',
        periodLabel: 'Morning Sunlight',
      };
    }
    if (currentHour >= 12 && currentHour < 16) {
      return {
        gradient: 'from-[#FFFDF5] via-[#FEFCE8] to-[#F0F9FF]',
        leftBg: 'from-sky-50/30 via-white/60 to-amber-50/20',
        sunX: 260,
        sunY: 34,
        sunColor: '#F59E0B',
        periodLabel: 'Peak Generation Window',
      };
    }
    if (currentHour >= 16 && currentHour < 19) {
      return {
        gradient: 'from-[#FFFBF5] via-[#FFF7ED] to-[#FEF2F2]',
        leftBg: 'from-orange-50/30 via-white/60 to-rose-50/20',
        sunX: 360,
        sunY: 75,
        sunColor: '#EA580C',
        periodLabel: 'Evening Golden Hour',
      };
    }
    return {
      gradient: 'from-[#F8FAFC] via-[#F1F5F9] to-[#FEF3C7]',
      leftBg: 'from-slate-50/50 via-white/60 to-indigo-50/20',
      sunX: 430,
      sunY: 105,
      sunColor: '#0284C7',
      periodLabel: 'Standby / Night Inactive',
    };
  }, [currentHour]);

  const executeLogin = async (userToSubmit: string, passToSubmit: string) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await ApiService.login({
        username: userToSubmit.trim(),
        password: passToSubmit.trim(),
      });
      if (res && res.authenticated) {
        if (rememberMe) {
          try {
            const profileToStore: SavedProfile = {
              username: userToSubmit.trim(),
              password: passToSubmit.trim(),
              displayName: res.user?.username || userToSubmit.trim(),
              savedAt: Date.now(),
            };
            localStorage.setItem(SAVED_PROFILE_STORAGE_KEY, JSON.stringify(profileToStore));
          } catch {
            // Storage quota/private mode ignore
          }
        }
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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(username, password);
  };

  const handleQuickLogin = async () => {
    if (!savedProfile || !savedProfile.password) return;
    await executeLogin(savedProfile.username, savedProfile.password);
  };

  const handleRemoveSavedProfile = () => {
    try {
      localStorage.removeItem(SAVED_PROFILE_STORAGE_KEY);
    } catch {}
    setSavedProfile(null);
    setIsQuickMode(false);
    setPassword('');
  };

  return (
    <div
      className={`min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-x-hidden bg-gradient-to-br ${atmosphericTheme.gradient} text-slate-900 font-sans selection:bg-amber-500/20`}
    >
      {/* Subtle atmospheric ambient glow */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-amber-200/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 right-10 w-[550px] h-[550px] bg-emerald-100/30 rounded-full blur-[150px] pointer-events-none" />

      {/* Meta Astryx Login Split Container */}
      <div className="w-full max-w-5xl rounded-3xl border border-white/80 bg-white/75 shadow-2xl shadow-slate-200/50 backdrop-blur-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px] relative z-10">
        
        {/* Left Flank: Solar Asset & Ambient Twin (7 cols / ~58%) */}
        <div className={`lg:col-span-7 p-6 sm:p-9 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100/90 bg-gradient-to-b ${atmosphericTheme.leftBg}`}>
          <div>
            {/* Brand Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SolarTrackLogo size={42} className="shadow-sm rounded-xl" />
                <div>
                  <div className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                    SolarTrack
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100/80 text-amber-800 border border-amber-200/60 uppercase tracking-wider">
                      OS 2.0
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Waaree Dual MPPT Inverter Station
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-slate-200/60 text-[11px] font-medium text-slate-600 shadow-2xs">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>{atmosphericTheme.periodLabel}</span>
              </div>
            </div>

            {/* Headline */}
            <div className="mt-8 space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                High-precision solar telemetry & yield intelligence.
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed max-w-md">
                Physics-based performance ratio, automated DISCOM net metering calculations, and micro-inverter diagnostic logs.
              </p>
            </div>
          </div>

          {/* Precision SVG Solar Curve Card */}
          <div className="my-6 p-5 rounded-2xl border border-slate-200/80 bg-white/85 shadow-sm backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-800">Clear-Sky Physics Benchmark</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">3.3 kWp Mono PERC</span>
            </div>

            {/* Precision SVG */}
            <div className="py-1">
              <svg viewBox="0 0 520 145" className="w-full h-32 overflow-visible" fill="none">
                <defs>
                  <linearGradient id="loginCurveFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                    <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="loginCurveLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="40%" stopColor="#F59E0B" />
                    <stop offset="60%" stopColor="#D97706" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>

                {/* Baseline grid */}
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
                  fill="url(#loginCurveFillGrad)"
                />

                {/* Real-world Generation Curve */}
                <path
                  d="M 35 120 C 110 118, 175 32, 260 32 C 345 32, 410 118, 485 120"
                  stroke="url(#loginCurveLineGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Solar Noon Apex Marker */}
                <circle cx="260" cy="32" r="3.5" fill="#D97706" />

                {/* Sun Position Orb */}
                <g transform={`translate(${atmosphericTheme.sunX * 1.04}, ${atmosphericTheme.sunY})`}>
                  <circle cx="0" cy="0" r="12" fill={atmosphericTheme.sunColor} fillOpacity="0.18" />
                  <circle cx="0" cy="0" r="5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
                </g>

                {/* Axis Timestamps */}
                <text x="35" y="137" fill="#94A3B8" fontSize="10" fontWeight="500" textAnchor="middle">06:27 AM</text>
                <text x="260" y="137" fill="#64748B" fontSize="10.5" fontWeight="600" textAnchor="middle">Peak Noon 11:53 AM</text>
                <text x="485" y="137" fill="#94A3B8" fontSize="10" fontWeight="500" textAnchor="middle">05:19 PM</text>
              </svg>
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>kSite 1.0095 &bull; Dual MPPT</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-700">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Station Online</span>
              </span>
            </div>
          </div>

          {/* Footer security badges */}
          <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>AES-256 Session Encrypted</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>IST Clock Calibration</span>
            </span>
          </div>
        </div>

        {/* Right Flank: Glass Credentials Form (5 cols / ~42%) */}
        <div className="lg:col-span-5 p-6 sm:p-9 lg:p-10 flex flex-col justify-center bg-white/95">
          {isQuickMode && savedProfile ? (
            /* Quick Sign In Mode (Saved on PC) */
            <div className="space-y-6">
              <div>
                <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Device Authorized</span>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                  Welcome back
                </h2>
                <p className="text-xs text-slate-500 font-normal mt-1">
                  Saved station profile ready for instant unlock.
                </p>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Profile Card */}
              <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex items-center gap-3.5 shadow-2xs">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 font-bold text-lg shrink-0">
                  {savedProfile.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 text-sm truncate">
                    {savedProfile.username}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Credentials Active</span>
                  </div>
                </div>
              </div>

              {/* 1-Click Sign In Button */}
              <button
                type="button"
                onClick={handleQuickLogin}
                disabled={isLoading}
                className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-sm tracking-tight transition duration-150 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Unlocking Station...</span>
                  </>
                ) : (
                  <>
                    <span>1-Click Sign In</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition" />
                  </>
                )}
              </button>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => setIsQuickMode(false)}
                  className="font-semibold text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Use another account
                </button>
                <button
                  type="button"
                  onClick={handleRemoveSavedProfile}
                  className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title="Forget saved account on this PC"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Forget</span>
                </button>
              </div>
            </div>
          ) : (
            /* Manual Credentials Form */
            <div className="space-y-5">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Authentication</span>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                  Sign In
                </h2>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Enter your Waaree Cloud or Local Station details.
                </p>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone or Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. solartrack_admin"
                      required
                      autoFocus
                      className="w-full bg-slate-50/70 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      className="w-full bg-slate-50/70 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
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

                {/* Save Profile Checkbox */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-medium">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-amber-500 focus:ring-2 cursor-pointer"
                    />
                    <span>Save profile on this device</span>
                  </label>

                  {savedProfile && (
                    <button
                      type="button"
                      onClick={() => setIsQuickMode(true)}
                      className="font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                    >
                      Back to saved
                    </button>
                  )}
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
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Clean Footer Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center text-[11px] text-slate-400 gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Encrypted Session &bull; ISO/IEC 27001</span>
          </div>
        </div>

      </div>
    </div>
  );
};
