import React, { useState } from 'react';
import { X, Link2, ShieldCheck } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import { ApiService } from '../../shared/api/solarApi';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountAdded,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAlert({ type: 'info', message: 'Authenticating with digital.waaree.com...' });

    try {
      const res = await ApiService.addAccount(username, password);
      if (res.errno === 0) {
        setAlert({ type: 'success', message: 'Account and inverters linked successfully!' });
        setTimeout(() => {
          setIsLoading(false);
          setAlert(null);
          setUsername('');
          setPassword('');
          onClose();
          onAccountAdded();
        }, 1200);
      } else {
        setAlert({
          type: 'error',
          message: res.error || 'Authentication failed. Please verify credentials.',
        });
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setAlert({ type: 'error', message: (err as Error).message || 'Network error' });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogBackdrop className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-2xs animate-in fade-in duration-200" />
      <DialogContent className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 border border-gray-200 shadow-xl relative animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-bold">
                <Link2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">Link Waaree Account</DialogTitle>
                <p className="text-xs text-gray-400">Combine multiple inverters into one fleet</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        {alert && (
          <div
            className={`my-4 p-3 rounded-xl text-xs font-semibold border ${
              alert.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : alert.type === 'error'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {alert.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Waaree Username or Email
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. user_two_pv"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-[11px] text-gray-500 space-y-1">
            <p className="font-medium text-gray-700 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
              <span>Multi-Account Aggregation Protocol</span>
            </p>
            <p>
              Your credentials handshake directly with{' '}
              <span className="num text-gray-700">digital.waaree.com</span>. The backend
              synchronizes live wattage and generation curves across all your accounts.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Authenticate & Link'}
            </button>
          </div>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
