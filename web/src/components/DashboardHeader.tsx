import React from 'react';
import { MetricStats } from '../types';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  Zap, 
  FileText, 
  Layers, 
  RefreshCw,
  Server,
  UserCheck,
  LogOut
} from 'lucide-react';

interface DashboardHeaderProps {
  metrics: MetricStats;
  isOnline: boolean;
  user: { id: string; username: string } | null;
  onRefresh: () => void;
  onOpenApiDocs: () => void;
  onLogout: () => void;
  onLoginClick?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  metrics,
  isOnline,
  user,
  onRefresh,
  onOpenApiDocs,
  onLogout,
  onLoginClick
}) => {
  return (
    <header className="glass-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Brand & System Status */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-white/40">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Midtrans Payment Bridge
                </h1>
                <span className="glass-pill-badge bg-indigo-500/15 text-indigo-700 border border-indigo-500/25">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500">Multi-Tenant Webhook Ingress & Dispatch Router</p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Backend Operational Status Pill */}
            <div className="glass-pill-badge bg-white/80 border border-slate-200/80 text-slate-700 py-1.5 px-3">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-medium">Status:</span>
              {isOnline ? (
                <span className="inline-flex items-center text-emerald-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                  Operational
                </span>
              ) : (
                <span className="inline-flex items-center text-rose-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span>
                  Offline
                </span>
              )}
            </div>

            {/* API Specs Button */}
            <button
              onClick={onOpenApiDocs}
              className="glass-button-secondary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>API Specs</span>
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={onRefresh}
              className="glass-button-secondary p-2 text-slate-600 hover:text-slate-900"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* User Profile & Logout / Login */}
            {user ? (
              <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-300/60">
                <div className="glass-pill-badge bg-indigo-50/90 border border-indigo-200 text-indigo-800 py-1.5 px-3">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-bold">{user.username}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="glass-button-secondary px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 border-rose-200/80 inline-flex items-center gap-1"
                  title="Log out of Admin Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="glass-button-primary px-4 py-1.5 text-xs inline-flex items-center gap-1.5 ml-1"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Admin Login</span>
              </button>
            )}

          </div>
        </div>

        {/* Apple Glass Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          
          {/* Total Webhooks */}
          <div className="glass-card p-4 flex items-center space-x-3.5 hover:shadow-xl hover:bg-white/90">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-600 flex items-center justify-center border border-sky-500/20 shadow-sm shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Webhooks</p>
              <p className="text-xl font-extrabold text-slate-900">{metrics.totalWebhooks.toLocaleString()}</p>
            </div>
          </div>

          {/* Success Rate */}
          <div className="glass-card p-4 flex items-center space-x-3.5 hover:shadow-xl hover:bg-white/90">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/20 shadow-sm shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Success Rate</p>
              <p className="text-xl font-extrabold text-emerald-600">
                {isNaN(metrics.successRate) ? '100%' : `${metrics.successRate.toFixed(1)}%`}
              </p>
            </div>
          </div>

          {/* Pending Retries */}
          <div className="glass-card p-4 flex items-center space-x-3.5 hover:shadow-xl hover:bg-white/90">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center border border-amber-500/20 shadow-sm shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Pending Retries</p>
              <p className={`text-xl font-extrabold ${metrics.pendingRetries > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {metrics.pendingRetries}
              </p>
            </div>
          </div>

          {/* Avg Latency */}
          <div className="glass-card p-4 flex items-center space-x-3.5 hover:shadow-xl hover:bg-white/90">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center border border-indigo-500/20 shadow-sm shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Avg Latency</p>
              <p className="text-xl font-extrabold text-slate-900">{metrics.avgLatency.toFixed(0)} ms</p>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
};
