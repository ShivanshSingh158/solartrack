import React, { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Sun,
  User,
} from 'lucide-react';
import { ApiService } from '../../shared/api/solarApi';

interface LoginScreenProps {
  onLoginSuccess: (user?: any) => void;
}

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
          res?.error || 'Incorrect username or password. Please try again.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error connecting to the service.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* Left Column: Immersive Visual Solar Canvas */}
      <div className="relative flex-1 flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/30 border-b lg:border-b-0 lg:border-r border-slate-800/60">
        {/* Ambient Sun Glow Background Elements */}
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 -right-32 -translate-y-1/2 w-[450px] h-[450px] bg-sky-500/[0.06] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[250px] bg-orange-600/[0.08] rounded-full blur-[100px] pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Sun className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            SolarTrack
          </span>
        </div>

        {/* Centerpiece Solar Art & Headline */}
        <div className="relative z-10 my-auto py-12 lg:py-0 max-w-xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
            Real-time solar generation &amp; rooftop intelligence.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-400 font-normal leading-relaxed">
            Track high-precision daily generation curves, microclimate irradiance, and hardware telemetry in one seamless view.
          </p>

          {/* Minimalist Solar Arc Graphic Card */}
          <div className="mt-8 sm:mt-10 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md shadow-2xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-semibold text-slate-400">Station Reference</div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">Kanpur Rooftop</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-400">Array Capacity</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">3.27 kWp DC</div>
              </div>
            </div>

            {/* Glowing Golden Solar Arc */}
            <svg viewBox="0 0 400 120" className="w-full h-24 overflow-visible" fill="none">
              <defs>
                <linearGradient id="arcGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="curveFill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 20 105 Q 200 10 380 105"
                stroke="url(#arcGlow)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M 20 105 Q 200 10 380 105 L 380 115 L 20 115 Z"
                fill="url(#curveFill)"
              />
              {/* Solar Noon Sun Position */}
              <circle cx="200" cy="57" r="6" fill="#fbbf24" className="animate-pulse" />
              <circle cx="200" cy="57" r="14" fill="#fbbf24" fillOpacity="0.25" />
              {/* Baseline */}
              <line x1="10" y1="110" x2="390" y2="110" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
            </svg>

            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mt-1">
              <span>06:27 AM Sunrise</span>
              <span className="text-amber-300 font-semibold">Solar Noon 11:53 AM</span>
              <span>05:19 PM Sunset</span>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="relative z-10 text-xs text-slate-500 font-medium">
          Kanpur, Uttar Pradesh · Coordinates 26.50° N, 80.24° E
        </div>
      </div>

      {/* Right Column: Clean, Focused Authentication Pane */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex items-center justify-center p-8 sm:p-12 lg:p-16 bg-white text-slate-900 shrink-0">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Sign in with your Waaree Portal credentials to access your station.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
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
                  className="w-full bg-slate-50/70 border border-slate-300/80 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition duration-150 pr-10"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-slate-50/70 border border-slate-300/80 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition duration-150 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-sm tracking-tight transition duration-150 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition duration-150" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Secure Waaree Cloud Link
            </span>
            <span>v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
