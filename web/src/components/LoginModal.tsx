import React, { useState } from 'react';
import { api } from '../services/api';
import { Shield, Lock, User, Eye, EyeOff, AlertCircle, Sparkles, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: (token: string, user: { id: string; username: string }) => void;
  onClose?: () => void;
  canClose?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
  canClose = false
}) => {
  const [tab, setTab] = useState<'login' | 'setup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please fill in both username and password.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setLoading(true);

    try {
      if (tab === 'setup') {
        const res = await api.setup({ username: username.trim(), password });
        onSuccess(res.token, res.user);
      } else {
        const res = await api.login({ username: username.trim(), password });
        onSuccess(res.token, res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
      <div className="glass-modal max-w-md w-full p-8 relative shadow-2xl border border-white/70 overflow-hidden">
        
        {/* Ambient Top Highlight Blob */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-indigo-300/40 to-sky-300/40 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-emerald-300/30 to-indigo-300/30 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button if closeable */}
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100/60 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header Branding */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 mb-3 border border-white/40">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Bridge Admin Console
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Midtrans Multi-Tenant Payment Bridge Access
          </p>
        </div>

        {/* Setup vs Login Pill Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/80 backdrop-blur-md rounded-2xl border border-slate-200/80 mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            className={`py-2 text-xs font-bold rounded-xl transition-all ${
              tab === 'login'
                ? 'bg-white text-indigo-600 shadow-md border border-white/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setTab('setup'); setError(null); }}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
              tab === 'setup'
                ? 'bg-white text-indigo-600 shadow-md border border-white/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Setup Admin</span>
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200/90 text-rose-700 text-xs font-medium flex items-start gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="Admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="glass-input w-full pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="glass-button-primary w-full py-3 text-sm mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : tab === 'login' ? (
              'Sign In to Dashboard'
            ) : (
              'Create Admin Account'
            )}
          </button>
        </form>

        <p className="text-[11px] text-slate-400 text-center mt-6">
          Protected by Midtrans Payment Bridge Auth Token Interceptor
        </p>

      </div>
    </div>
  );
};
