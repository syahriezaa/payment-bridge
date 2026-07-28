import React, { useState, useEffect } from 'react';
import { WebhookAuditLog, Tenant, WebhookStatus } from '../types';
import { api } from '../services/api';
import { 
  FileText, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Search, 
  Filter, 
  Eye, 
  Copy, 
  Check, 
  X, 
  RefreshCw,
  Terminal,
  Zap
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            SUCCESS
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      case 'RETRYING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
            RETRYING
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock className="w-3.5 h-3.5" />
            PENDING
          </span>
        );
    }
  };

  const filteredLogs = searchOrderId 
    ? logs.filter(l => l.order_id.toLowerCase().includes(searchOrderId.toLowerCase()))
    : logs;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden mb-8">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/60">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Real-Time Webhook Audit Logs
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track incoming Midtrans notifications, delivery HTTP statuses, execution latencies, and trigger manual re-sends.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Order ID Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Order ID..."
              value={searchOrderId}
              onChange={(e) => setSearchOrderId(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
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
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 max-w-[160px]"
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
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-x-auto">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center">
            <Terminal className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No webhook audit logs found</p>
            <p className="text-xs text-slate-500 mt-1">Audit logs will appear here in real-time when Midtrans sends webhooks.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Order ID</th>
                <th className="px-5 py-3.5">Tenant Target</th>
                <th className="px-5 py-3.5">Dispatch Status</th>
                <th className="px-5 py-3.5">HTTP Status</th>
                <th className="px-5 py-3.5">Latency</th>
                <th className="px-5 py-3.5">Attempts</th>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {filteredLogs.map((log) => {
                const httpCode = log.response_code ?? log.response_status ?? log.http_status;
                const tenantName = log.tenant_name || tenants.find(t => t.id === log.tenant_id)?.name || 'Unknown / Unmapped';
                const tenantPrefix = log.tenant_prefix || tenants.find(t => t.id === log.tenant_id)?.order_prefix;
                const formattedTime = new Date(log.timestamp || log.created_at || Date.now()).toLocaleString();

                return (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-100">
                      {log.order_id}
                    </td>
                    <td className="px-5 py-3.5 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200 font-semibold">{tenantName}</span>
                        {tenantPrefix && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-indigo-400 border border-slate-700">
                            {tenantPrefix}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-sans">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-5 py-3.5">
                      {httpCode ? (
                        <span className={`font-bold ${httpCode >= 200 && httpCode < 300 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {httpCode}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {log.latency_ms !== null && log.latency_ms !== undefined ? `${log.latency_ms} ms` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-semibold text-slate-300">
                        {log.attempts || 1} / 5
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-sans text-[11px]">
                      {formattedTime}
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans space-x-2">
                      {/* Detail View Button */}
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                        title="View Full Payload & Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Inspect</span>
                      </button>

                      {/* Manual Retry Button */}
                      <button
                        onClick={(e) => handleManualRetry(log.id, e)}
                        disabled={retryingId === log.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md transition-colors disabled:opacity-50"
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
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing {filteredLogs.length} of {total} total webhook logs
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded disabled:opacity-40"
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < limit}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* Audit Log Inspect Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-100 font-mono">
                  Order ID: {selectedLog.order_id}
                </h3>
                {getStatusBadge(selectedLog.status)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Log ID: <span className="font-mono text-slate-300">{selectedLog.id}</span>
              </p>
            </div>

            {/* Notification Alert for Manual Retry */}
            {retryResult && (
              <div className={`mb-4 p-3 rounded-lg text-xs flex items-center justify-between ${
                retryResult.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}>
                <span>{retryResult.msg}</span>
                <button onClick={() => setRetryResult(null)} className="text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Log Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-xs mb-4">
              <div>
                <span className="text-slate-500 block">HTTP Response:</span>
                <span className="font-mono font-bold text-slate-200">
                  {selectedLog.response_code ?? selectedLog.response_status ?? selectedLog.http_status ?? 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Latency:</span>
                <span className="font-mono text-slate-200">
                  {selectedLog.latency_ms !== null ? `${selectedLog.latency_ms} ms` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Attempts:</span>
                <span className="font-mono text-slate-200">{selectedLog.attempts || 1} / 5</span>
              </div>
              <div>
                <span className="text-slate-500 block">Timestamp:</span>
                <span className="font-sans text-[11px] text-slate-300">
                  {new Date(selectedLog.timestamp || selectedLog.created_at || Date.now()).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Error Message Section */}
            {selectedLog.error_message && (
              <div className="mb-4 p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-xs text-rose-300">
                <span className="font-bold text-rose-400 block mb-1">Dispatch Error:</span>
                <p className="font-mono text-[11px] break-all">{selectedLog.error_message}</p>
              </div>
            )}

            {/* Payload JSON Previewer Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-indigo-400" />
                Incoming Midtrans Webhook Payload (JSON)
              </span>
              <button
                onClick={copyPayloadJson}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              >
                {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            {/* Payload JSON Tree / Code Box */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-indigo-200">
              <pre className="whitespace-pre-wrap break-all text-[11px]">
                {typeof selectedLog.payload === 'string'
                  ? selectedLog.payload
                  : JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => handleManualRetry(selectedLog.id)}
                disabled={retryingId === selectedLog.id}
                className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
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
