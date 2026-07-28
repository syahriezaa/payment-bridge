import React, { useState, useEffect, useCallback } from 'react';
import { Tenant, MetricStats, WebhookAuditLog } from './types';
import { api } from './services/api';
import { DashboardHeader } from './components/DashboardHeader';
import { TenantManager } from './components/TenantManager';
import { AuditLogsViewer } from './components/AuditLogsViewer';
import { IntegrationGuide } from './components/IntegrationGuide';
import { ApiDocsModal } from './components/ApiDocsModal';
import { Globe, FileText, Code, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'tenants' | 'logs' | 'guide'>('tenants');
  const [isApiDocsOpen, setIsApiDocsOpen] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<MetricStats>({
    totalWebhooks: 0,
    successRate: 100,
    pendingRetries: 0,
    avgLatency: 0
  });

  const loadData = useCallback(async () => {
    try {
      // Check server health
      const health = await api.checkHealth();
      setIsOnline(health.status === 'ok');
    } catch {
      setIsOnline(false);
    }

    try {
      // Load Tenants
      const tenantList = await api.getTenants();
      setTenants(tenantList);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    }

    try {
      // Load Audit Logs to compute real-time metrics
      const auditResult = await api.getAuditLogs({ limit: 100 });
      const logs = auditResult.logs || [];
      const total = auditResult.total || logs.length;

      const successCount = logs.filter(l => l.status === 'SUCCESS').length;
      const pendingCount = logs.filter(l => l.status === 'PENDING' || l.status === 'RETRYING').length;
      
      const rate = logs.length > 0 ? (successCount / logs.length) * 100 : 100;
      
      const latencies = logs
        .map(l => l.latency_ms)
        .filter((l): l is number => l !== null && l !== undefined && !isNaN(l));
      
      const avgLat = latencies.length > 0 
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
        : 0;

      setMetrics({
        totalWebhooks: total,
        successRate: rate,
        pendingRetries: pendingCount,
        avgLatency: avgLat
      });
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Header Bar with Metrics */}
      <DashboardHeader
        metrics={metrics}
        isOnline={isOnline}
        onRefresh={loadData}
        onOpenApiDocs={() => setIsApiDocsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-6">
          <button
            onClick={() => setActiveTab('tenants')}
            className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'tenants'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Target Websites ({tenants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Webhook Audit Logs</span>
            {metrics.pendingRetries > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`inline-flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'guide'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Integration Guide</span>
          </button>
        </div>

        {/* Tab Views */}
        {activeTab === 'tenants' && (
          <TenantManager tenants={tenants} onRefresh={loadData} />
        )}

        {activeTab === 'logs' && (
          <AuditLogsViewer tenants={tenants} onLogsUpdated={loadData} />
        )}

        {activeTab === 'guide' && (
          <IntegrationGuide />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 bg-slate-900/50 text-center text-xs text-slate-500">
        Midtrans Multi-Tenant Payment Bridge &copy; {new Date().getFullYear()} &bull; Fastify + Vite + React Admin Dashboard
      </footer>

      {/* API Specs Modal */}
      <ApiDocsModal
        isOpen={isApiDocsOpen}
        onClose={() => setIsApiDocsOpen(false)}
      />
    </div>
  );
};

export default App;
