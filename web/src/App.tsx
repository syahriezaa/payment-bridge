import React, { useState, useEffect, useCallback } from 'react';
import { Tenant, MetricStats } from './types';
import { api } from './services/api';
import { DashboardHeader } from './components/DashboardHeader';
import { TenantManager } from './components/TenantManager';
import { AuditLogsViewer } from './components/AuditLogsViewer';
import { IntegrationGuide } from './components/IntegrationGuide';
import { ApiDocsModal } from './components/ApiDocsModal';
import { LoginModal } from './components/LoginModal';
import { Globe, FileText, Code, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'tenants' | 'logs' | 'guide'>('tenants');
  const [isApiDocsOpen, setIsApiDocsOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(() => {
    return api.getCurrentUser();
  });

  const [metrics, setMetrics] = useState<MetricStats>({
    totalWebhooks: 0,
    successRate: 100,
    pendingRetries: 0,
    avgLatency: 0
  });

  // Listen for 401 Unauthorized responses from api service
  useEffect(() => {
    const unsubscribe = api.onUnauthorized(() => {
      setCurrentUser(null);
      setIsLoginModalOpen(true);
    });
    return unsubscribe;
  }, []);

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

  const handleLoginSuccess = (token: string, user: { id: string; username: string }) => {
    setCurrentUser(user);
    setIsLoginModalOpen(false);
    loadData();
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased" style={{color: '#1e293b'}}>
      
      {/* Header Bar with Apple Liquid Glass Metrics */}
      <DashboardHeader
        metrics={metrics}
        isOnline={isOnline}
        user={currentUser}
        onRefresh={loadData}
        onOpenApiDocs={() => setIsApiDocsOpen(true)}
        onLogout={handleLogout}
        onLoginClick={() => setIsLoginModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Floating Apple Liquid Glass Pill Tab Switcher */}
        <div className="flex items-center justify-center sm:justify-start mb-8">
          <div className="inline-flex items-center gap-1.5 p-1.5 bg-white/70 backdrop-blur-xl border border-white/60 shadow-lg shadow-slate-200/50 rounded-full">
            
            <button
              onClick={() => setActiveTab('tenants')}
              className={`inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-extrabold rounded-full transition-all duration-200 ${
                activeTab === 'tenants'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Target Websites ({tenants.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-extrabold rounded-full transition-all duration-200 relative ${
                activeTab === 'logs'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Webhook Audit Logs</span>
              {metrics.pendingRetries > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-extrabold rounded-full transition-all duration-200 ${
                activeTab === 'guide'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>Integration Guide</span>
            </button>

          </div>
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

      {/* Apple Light Liquid Glass Footer */}
      <footer className="glass-header border-t border-white/60 py-5 text-center text-xs font-medium text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Apple Light Liquid Glass UI Theme</span>
          </div>
          <div>
            Midtrans Multi-Tenant Payment Bridge &copy; {new Date().getFullYear()} &bull; Fastify + Vite + React Admin Dashboard
          </div>
        </div>
      </footer>

      {/* API Specs Modal */}
      <ApiDocsModal
        isOpen={isApiDocsOpen}
        onClose={() => setIsApiDocsOpen(false)}
      />

      {/* Login & Auth Setup Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onSuccess={handleLoginSuccess}
        onClose={() => setIsLoginModalOpen(false)}
        canClose={!!api.getToken()}
      />

    </div>
  );
};

export default App;
