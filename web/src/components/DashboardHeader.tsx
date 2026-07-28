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
  Server
} from 'lucide-react';

interface DashboardHeaderProps {
  metrics: MetricStats;
  isOnline: boolean;
  onRefresh: () => void;
  onOpenApiDocs: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  metrics,
  isOnline,
  onRefresh,
  onOpenApiDocs,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand & System Status */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                  Midtrans Payment Bridge
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Multi-Tenant Webhook Ingress & Dispatch Router</p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-3">
            {/* Server Status Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300 font-medium">Backend:</span>
              {isOnline ? (
                <span className="inline-flex items-center text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span>
                  Operational
                </span>
              ) : (
                <span className="inline-flex items-center text-rose-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span>
                  Offline
                </span>
              )}
            </div>

            {/* API Docs Button */}
            <button
              onClick={onOpenApiDocs}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-all duration-150 shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>API Specs</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-all"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics Grid Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          {/* Total Webhooks */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Webhooks</p>
              <p className="text-lg font-bold text-slate-100">{metrics.totalWebhooks.toLocaleString()}</p>
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Success Rate</p>
              <p className="text-lg font-bold text-emerald-400">
                {isNaN(metrics.successRate) ? '100%' : `${metrics.successRate.toFixed(1)}%`}
              </p>
            </div>
          </div>

          {/* Pending Retries */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Pending Retries</p>
              <p className={`text-lg font-bold ${metrics.pendingRetries > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                {metrics.pendingRetries}
              </p>
            </div>
          </div>

          {/* Avg Latency */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Avg Latency</p>
              <p className="text-lg font-bold text-slate-100">{metrics.avgLatency.toFixed(0)} ms</p>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};
