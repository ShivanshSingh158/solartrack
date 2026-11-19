import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  User,
  Trash2,
  Sun,
  ShieldCheck,
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
  // Lazy initialize saved profile
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

  const [currentHour] = useState(() => new Date().getHours());

  // Live IST Clock
  const [clockTimeStr, setClockTimeStr] = useState(() => {
    const d = new Date();
    return (
      d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' IST'
    );
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setClockTimeStr(
        d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }) + ' IST'
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Atmospheric Theme according to hour of day (Quiet, subtle luxury tones)
  const atmosphericTheme = useMemo(() => {
    if (currentHour >= 6 && currentHour < 12) {
      return {
        gradient: 'from-[#FFFDF8] via-[#FFFBEB] to-[#F5FAF5]',
        leftBg: 'from-amber-50/30 via-white/40 to-transparent',
        sunColor: '#F59E0B',
        periodLabel: 'Morning Sunlight',
      };
    }
    if (currentHour >= 12 && currentHour < 16) {
      return {
        gradient: 'from-[#FFFDF6] via-[#FEFCE8] to-[#F0F9FF]',
        leftBg: 'from-sky-50/20 via-white/40 to-transparent',
        sunColor: '#EAB308',
        periodLabel: 'Peak Generation Window',
      };
    }
    if (currentHour >= 16 && currentHour < 19) {
      return {
        gradient: 'from-[#FFFBF6] via-[#FFF7ED] to-[#FEF5F5]',
        leftBg: 'from-orange-50/20 via-white/40 to-transparent',
        sunColor: '#EA580C',
        periodLabel: 'Golden Hour',
      };
    }
    return {
      gradient: 'from-[#F8FAFC] via-[#F1F5F9] to-[#FEF3C7]',
      leftBg: 'from-slate-50/30 via-white/40 to-transparent',
      sunColor: '#0284C7',
      periodLabel: 'Standby / Inactive',
    };
  }, [currentHour]);

  // Accurate Solar Physics Arc
  const { sunX, sunY, isSunUp } = useMemo(() => {
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const dawnMin = 6 * 60 + 27; // 06:27 AM
    const duskMin = 17 * 60 + 19; // 05:19 PM

    if (totalMinutes < dawnMin) {
      return { sunX: 60, sunY: 122, isSunUp: false };
    }
    if (totalMinutes > duskMin) {
      return { sunX: 620, sunY: 122, isSunUp: false };
    }
    const ratio = (totalMinutes - dawnMin) / (duskMin - dawnMin);
    const x = 60 + ratio * (620 - 60);
    const y = 122 - 4 * (122 - 24) * ratio * (1 - ratio);
    return { sunX: Math.round(x), sunY: Math.round(y), isSunUp: true };
  }, []);

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
    // 100vw x 100vh Full Screen Canvas, Clean & Uncluttered
    <div
      className={`w-screen h-screen overflow-hidden flex flex-col lg:flex-row bg-gradient-to-br ${atmosphericTheme.gradient} text-slate-900 font-sans selection:bg-amber-500/20 relative no-scrollbar`}
    >
      {/* Subtle atmospheric ambient glow */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-amber-200/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute -bottom-32 left-[30%] w-[550px] h-[550px] bg-emerald-100/20 rounded-full blur-[160px] pointer-events-none" />

      {/* ========================================================================= */}
      {/* LEFT FLANK: 55% WIDTH — CLEAN SOLAR INTELLIGENCE STAGE                    */}
      {/* ========================================================================= */}
      <section
        className={`w-full lg:w-[55%] h-full flex flex-col justify-between p-6 sm:p-8 lg:p-12 xl:p-14 bg-gradient-to-b ${atmosphericTheme.leftBg} relative z-10 overflow-hidden no-scrollbar`}
      >
        {/* Top Brand & Ambient Clock */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SolarTrackLogo size={42} className="shadow-xs rounded-xl shrink-0" />
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span>SolarTrack</span>
                <span className="text-[11px] font-semibold text-amber-800/80 tracking-wide">
                  OS 2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                Waaree Inverter Station #01
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>{atmosphericTheme.periodLabel}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="tabular-nums font-semibold text-slate-600">{clockTimeStr}</span>
          </div>
        </header>

        {/* Headline & Clean Introduction */}
        <div className="my-auto py-6 max-w-xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
              High-precision solar telemetry & yield intelligence.
            </h1>
            <p className="text-sm text-slate-600 font-normal leading-relaxed">
              Physics-based performance ratio, automated DISCOM net metering calculations, and micro-inverter diagnostic logs.
            </p>
          </div>

          {/* Panoramic Solar Physics Arc Card (Clean, unburdened Apple Glass) */}
          <div className="p-6 rounded-3xl border border-white/80 bg-white/70 shadow-sm backdrop-blur-2xl space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-800">Clear-Sky Physics Benchmark</span>
              </div>
              <span className="font-medium text-slate-500">3.3 kWp Mono PERC</span>
            </div>

            {/* Precision SVG */}
            <div className="py-1">
              <svg viewBox="0 0 680 148" className="w-full h-32 sm:h-36 overflow-visible" fill="none">
                <defs>
                  <linearGradient id="cleanSolarFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.22" />
                    <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="cleanSolarLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="35%" stopColor="#F59E0B" />
                    <stop offset="65%" stopColor="#D97706" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>

                {/* Subtle Baseline Grid */}
                <line x1="40" y1="42" x2="640" y2="42" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="82" x2="640" y2="82" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="122" x2="640" y2="122" stroke="#E2E8F0" strokeWidth="1.2" />

                {/* Vertical Solar Noon Guide */}
                <line x1="340" y1="24" x2="340" y2="122" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />

                {/* Theoretical Curve (Dashed) */}
                <path
                  d="M 60 122 C 160 120, 230 24, 340 24 C 450 24, 520 120, 620 122"
                  stroke="#94A3B8"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  strokeOpacity="0.5"
                />

                {/* Shaded Area */}
                <path
                  d="M 60 122 C 160 120, 235 30, 340 30 C 445 30, 520 120, 620 122 L 620 122 L 60 122 Z"
                  fill="url(#cleanSolarFillGrad)"
                />

                {/* Real Generation Curve */}
                <path
                  d="M 60 122 C 160 120, 235 30, 340 30 C 445 30, 520 120, 620 122"
                  stroke="url(#cleanSolarLineGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Apex Marker */}
                <circle cx="340" cy="30" r="3.5" fill="#D97706" />

                {/* Live Sun Position Orb */}
                <g transform={`translate(${sunX}, ${sunY})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r="12"
                    fill={atmosphericTheme.sunColor}
                    fillOpacity={isSunUp ? 0.20 : 0.06}
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="5"
                    fill={atmosphericTheme.sunColor}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="shadow-sm"
                  />
                </g>

                {/* Timestamps */}
                <text x="60" y="138" fill="#94A3B8" fontSize="10" fontWeight="500" textAnchor="middle">06:27 AM</text>
                <text x="340" y="138" fill="#64748B" fontSize="10.5" fontWeight="600" textAnchor="middle">Peak Noon 11:53 AM</text>
                <text x="620" y="138" fill="#94A3B8" fontSize="10" fontWeight="500" textAnchor="middle">05:19 PM</text>
              </svg>
            </div>

            <div className="pt-1 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>kSite 1.0095 • Dual MPPT</span>
              <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Station Online</span>
              </span>
            </div>
          </div>
        </div>

        {/* Ambient Footer */}
        <footer className="flex items-center gap-6 text-xs text-slate-400 font-medium">
          <span>AES-256 Session Encrypted</span>
          <span>•</span>
          <span>IST Clock Calibration</span>
        </footer>
      </section>

      {/* ========================================================================= */}
      {/* RIGHT FLANK: 45% WIDTH — MINIMALIST APPLE AUTHENTICATION COCKPIT           */}
      {/* ========================================================================= */}
      <section
        className={`w-full lg:w-[45%] h-full flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16 bg-white/70 backdrop-blur-3xl lg:shadow-[-25px_0_50px_-15px_rgba(15,23,42,0.04)] relative z-20 overflow-hidden no-scrollbar`}
      >
        {/* Soft Feathered Blur Overlay along the seam to melt border line */}
        <div className="hidden lg:block absolute inset-y-0 -left-16 w-16 bg-gradient-to-r from-transparent via-white/40 to-white/70 pointer-events-none backdrop-blur-md" />

        {/* Subtle Top Status */}
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-500">Secure Station Gateway</span>
          </div>
          <span>TLS 1.3</span>
        </div>

        {/* Authentication Interactive Stage (Vertically Centered & Clean) */}
        <div className="my-auto max-w-sm w-full mx-auto space-y-6">
          {isQuickMode && savedProfile ? (
            /* Mode A: 1-Click Authorized Device Unlock */
            <div className="space-y-6">
              <div>
                <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
                  Device Authorized
                </span>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                  Welcome back
                </h2>
                <p className="text-xs text-slate-500 font-normal mt-1">
                  Saved station profile ready for instant unlock.
                </p>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              {/* Apple ID Profile Card */}
              <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/70 flex items-center gap-3.5 shadow-2xs">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 font-bold text-lg shrink-0">
                  {savedProfile.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 text-sm truncate">
                    {savedProfile.username}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Credentials Active</span>
                  </div>
                </div>
              </div>

              {/* 1-Click Sign In Button */}
              <button
                type="button"
                onClick={handleQuickLogin}
                disabled={isLoading}
                className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-sm tracking-tight transition duration-150 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Unlocking Station...</span>
                  </>
                ) : (
                  <>
                    <span>1-Click Sign In</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition" />
                  </>
                )}
              </button>

              {/* Secondary Actions */}
              <div className="pt-1 flex items-center justify-between text-xs text-slate-500">
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
            /* Mode B: Manual Credentials Form */
            <div className="space-y-5">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Authentication
                </span>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                  Sign In
                </h2>
                <p className="text-xs text-slate-500 font-normal mt-1">
                  Enter your Waaree Cloud or Local Station details.
                </p>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Phone or Username
                  </label>
                  <div className="relative">
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. solartrack_admin"
                      required
                      autoFocus
                      autoComplete="username"
                      spellCheck={false}
                      autoCapitalize="none"
                      className="w-full bg-white/80 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      autoComplete="current-password"
                      className="w-full bg-white/80 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                  className="w-full mt-2 py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-sm tracking-tight transition duration-150 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 group"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Clean Cockpit Footer */}
        <footer className="flex items-center justify-between text-xs text-slate-400">
          <span>Encrypted Session • ISO/IEC 27001</span>
          <span>Waaree Energies Limited</span>
        </footer>
      </section>
    </div>
  );
};
