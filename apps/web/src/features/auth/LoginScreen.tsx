import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  ShieldAlert,
  ShieldCheck,
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
          res?.error || 'Authentication failed. Please verify your digital.waaree.com username and password.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error communicating with authentication service.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-slate-50 via-slate-50/90 to-slate-100 text-slate-900 select-none relative font-sans">
      {/* Subtle Warm Solar Ambience */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[540px] h-[360px] bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/90 border border-slate-200/80 shadow-2xs mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
            <span className="text-[11px] font-black text-slate-900 tracking-[0.22em] uppercase font-sans">
              SOLARTRACK
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 uppercase">
              Secure
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Solar Cockpit Login
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Sign in with your Waaree Portal ID to load telemetry
          </p>
        </div>

        {/* Master Glass Card */}
        <div
          className="bg-white/95 rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xl space-y-5"
          style={{
            backdropFilter: 'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 1), 0 16px 40px -12px rgba(15, 23, 42, 0.08)',
          }}
        >
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-150">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                Waaree Username / Phone
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. 9876543210 or user@example.com"
                  required
                  autoFocus
                  className="w-full bg-slate-50/80 border border-slate-200/90 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                Waaree Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter digital.waaree.com password"
                  required
                  className="w-full bg-slate-50/80 border border-slate-200/90 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs tracking-wide transition shadow-xs hover:shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating with Waaree Cloud...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Connect &amp; Unlock Cockpit</span>
                </>
              )}
            </button>
          </form>

          {/* Security Status Box */}
          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1.5 text-[11px] text-slate-500">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Waaree Direct Cloud Authentication
              </span>
              <span className="text-[10px] font-bold text-emerald-700 num">AES-256</span>
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed">
              Cryptographic session tokens with SameSite=Strict cookies &amp; adaptive brute-force rate guards.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-5 text-[11px] text-slate-400 font-medium">
          SolarTrack Telemetry Gateway · Rooftop Hardware Station
        </div>
      </div>
    </div>
  );
};
