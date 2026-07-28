import React, { useState, useEffect } from 'react';
import { WebhookAuditLog, Tenant, WebhookStatus } from '../types';
import { api } from '../services/api';
import { 
  FileText, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Eye, 
  Copy, 
  Check, 
  X, 
  RefreshCw,
  Terminal
} from 'lucide-react';

interface AuditLogsViewerProps {
  tenants: Tenant[];
  onLogsUpdated: () => void;
}

export const AuditLogsViewer: React.FC<AuditLogsViewerProps> = ({ tenants, onLogsUpdated }) => {
  const [logs, setLogs] = useState<WebhookAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [searchOrderId, setSearchOrderId] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookAuditLog | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAuditLogs({
        tenant_id: selectedTenant || undefined,
        status: selectedStatus || undefined,
        page,
        limit
      });
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, selectedStatus, selectedTenant]);

  const handleManualRetry = async (logId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRetryingId(logId);
    setRetryResult(null);

    try {
      const result = await api.retryAuditLog(logId);
      setRetryResult({
        success: result.success,
        msg: result.message || 'Retry initiated successfully'
      });
      
      // Update local state and trigger refresh
      fetchLogs();
      onLogsUpdated();

      // If viewing detail modal, refresh selected log
      if (selectedLog && selectedLog.id === logId) {
        const updatedLog = await api.getAuditLogById(logId);
        setSelectedLog(updatedLog);
      }
    } catch (err: any) {
      setRetryResult({
        success: false,
        msg: err.message || 'Failed to trigger retry'
      });
    } finally {
      setRetryingId(null);
    }
  };

  const copyPayloadJson = () => {
    if (!selectedLog) return;
    const jsonStr = typeof selectedLog.payload === 'string'
      ? selectedLog.payload
      : JSON.stringify(selectedLog.payload, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const getStatusBadge = (status: WebhookStatus) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="glass-pill-badge bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>SUCCESS</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="glass-pill-badge bg-rose-500/15 text-rose-700 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>FAILED</span>
          </span>
        );
      case 'RETRYING':
        return (
          <span className="glass-pill-badge bg-amber-500/15 text-amber-700 border border-amber-500/30 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>RETRYING</span>
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="glass-pill-badge bg-amber-500/15 text-amber-700 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>PENDING</span>
          </span>
        );
    }
  };

  const filteredLogs = searchOrderId 
    ? logs.filter(l => l.order_id.toLowerCase().includes(searchOrderId.toLowerCase()))
    : logs;

  return (
    <div className="glass-container p-6 mb-8 relative overflow-hidden">
      
      {/* Background Soft Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-200/30 via-indigo-200/20 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Bar & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-200/80 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 border border-indigo-500/20 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            Real-Time Webhook Audit Logs
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Translucent liquid glass log viewer with real-time status indicators and manual re-send actions.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Order ID Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search Order ID..."
              value={searchOrderId}
              onChange={(e) => setSearchOrderId(e.target.value)}
              className="glass-input text-xs pl-9 py-2 max-w-[170px]"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="glass-input text-xs py-2"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="PENDING">PENDING</option>
            <option value="RETRYING">RETRYING</option>
          </select>

          {/* Tenant Filter */}
          <select
            value={selectedTenant}
            onChange={(e) => { setSelectedTenant(e.target.value); setPage(1); }}
            className="glass-input text-xs py-2 max-w-[160px]"
          >
            <option value="">All Tenants</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.order_prefix || t.prefix})</option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="glass-button-secondary p-2 text-slate-600"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Translucent Glass Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/80 bg-white/60 backdrop-blur-md shadow-sm">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center p-8">
            <div className="w-14 h-14 rounded-3xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
              <Terminal className="w-7 h-7" />
            </div>
            <p className="text-slate-800 font-bold text-base">No webhook audit logs found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Audit log entries will populate here in real-time when Midtrans sends webhooks.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100/80 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-3.5">Order ID</th>
                <th className="px-5 py-3.5">Target Website</th>
                <th className="px-5 py-3.5">Dispatch Status</th>
                <th className="px-5 py-3.5">HTTP Code</th>
                <th className="px-5 py-3.5">Latency</th>
                <th className="px-5 py-3.5">Attempts</th>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 font-mono text-xs">
              {filteredLogs.map((log) => {
                const httpCode = log.response_code ?? log.response_status ?? log.http_status;
                const tenantName = log.tenant_name || tenants.find(t => t.id === log.tenant_id)?.name || 'Unmapped Target';
                const tenantPrefix = log.tenant_prefix || tenants.find(t => t.id === log.tenant_id)?.order_prefix;
                const formattedTime = new Date(log.timestamp || log.created_at || Date.now()).toLocaleString();

                return (
                  <tr key={log.id} className="hover:bg-white/90 transition-colors">
                    <td className="px-5 py-4 font-extrabold text-slate-900">
                      {log.order_id}
                    </td>
                    <td className="px-5 py-4 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-800 font-bold">{tenantName}</span>
                        {tenantPrefix && (
                          <span className="glass-pill-badge bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 text-[10px] py-0.5 px-2">
                            {tenantPrefix}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-sans">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-5 py-4 font-bold">
                      {httpCode ? (
                        <span className={httpCode >= 200 && httpCode < 300 ? 'text-emerald-600' : 'text-rose-600'}>
                          {httpCode}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {log.latency_ms !== null && log.latency_ms !== undefined ? `${log.latency_ms} ms` : '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 font-bold text-[11px] text-slate-700">
                        {log.attempts || 1} / 5
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 font-sans text-[11px]">
                      {formattedTime}
                    </td>
                    <td className="px-5 py-4 text-right font-sans space-x-2">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="glass-button-secondary px-3 py-1 text-xs inline-flex items-center gap-1"
                        title="View Full Payload & Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={(e) => handleManualRetry(log.id, e)}
                        disabled={retryingId === log.id}
                        className="glass-button-secondary px-3 py-1 text-xs text-amber-700 hover:bg-amber-50 border-amber-200 inline-flex items-center gap-1 disabled:opacity-50"
                        title="Trigger Manual Webhook Re-send"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                        <span>{retryingId === log.id ? 'Retrying...' : 'Re-send'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Bar */}
      <div className="pt-4 mt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
        <div>
          Showing {filteredLogs.length} of {total} total webhook logs
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="glass-button-secondary px-3 py-1 text-xs disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 font-bold text-slate-700">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < limit}
            className="glass-button-secondary px-3 py-1 text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Audit Log Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
          <div className="glass-modal max-w-2xl w-full p-8 relative shadow-2xl border border-white/70 max-h-[90vh] flex flex-col">
            
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100/60"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">
                  Order ID: {selectedLog.order_id}
                </h3>
                {getStatusBadge(selectedLog.status)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Log ID: <span className="font-mono text-slate-700 font-bold">{selectedLog.id}</span>
              </p>
            </div>

            {/* Notification Alert for Manual Retry */}
            {retryResult && (
              <div className={`mb-4 p-3 rounded-2xl text-xs font-medium flex items-center justify-between ${
                retryResult.success 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                <span>{retryResult.msg}</span>
                <button onClick={() => setRetryResult(null)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Log Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 text-xs mb-5">
              <div>
                <span className="text-slate-500 font-medium block">HTTP Code:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {selectedLog.response_code ?? selectedLog.response_status ?? selectedLog.http_status ?? 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Latency:</span>
                <span className="font-mono text-slate-900 text-sm font-semibold">
                  {selectedLog.latency_ms !== null ? `${selectedLog.latency_ms} ms` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Attempts:</span>
                <span className="font-mono text-slate-900 text-sm font-semibold">{selectedLog.attempts || 1} / 5</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Timestamp:</span>
                <span className="font-sans text-[11px] text-slate-700 font-semibold">
                  {new Date(selectedLog.timestamp || selectedLog.created_at || Date.now()).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Error Message Section */}
            {selectedLog.error_message && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800">
                <span className="font-bold block mb-1">Dispatch Error Detail:</span>
                <p className="font-mono text-[11px] break-all">{selectedLog.error_message}</p>
              </div>
            )}

            {/* Payload JSON Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-indigo-600" />
                Incoming Midtrans Webhook Payload (JSON)
              </span>
              <button
                onClick={copyPayloadJson}
                className="glass-button-secondary px-3 py-1 text-xs inline-flex items-center gap-1"
              >
                {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            {/* Payload JSON Code View */}
            <div className="flex-1 overflow-y-auto bg-slate-900 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-indigo-300 shadow-inner">
              <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                {typeof selectedLog.payload === 'string'
                  ? selectedLog.payload
                  : JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-200/80">
              <button
                onClick={() => setSelectedLog(null)}
                className="glass-button-secondary px-4 py-2 text-xs"
              >
                Close Inspector
              </button>
              <button
                onClick={() => handleManualRetry(selectedLog.id)}
                disabled={retryingId === selectedLog.id}
                className="glass-button-primary px-5 py-2 text-xs inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/25"
              >
                <RotateCw className={`w-4 h-4 ${retryingId === selectedLog.id ? 'animate-spin' : ''}`} />
                <span>{retryingId === selectedLog.id ? 'Retrying...' : 'Re-send Webhook Now'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
