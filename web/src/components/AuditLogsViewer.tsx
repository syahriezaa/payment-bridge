import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Terminal,
  AlertTriangle,
  Zap,
  Filter
} from 'lucide-react';

interface AuditLogsViewerProps {
  tenants: Tenant[];
  onLogsUpdated: () => void;
  defaultTab?: 'all' | 'errors';
}

export const AuditLogsViewer: React.FC<AuditLogsViewerProps> = ({ tenants, onLogsUpdated, defaultTab = 'all' }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'errors'>(defaultTab);
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

  // Derive effective status filter from active tab
  const effectiveStatus = activeTab === 'errors' ? 'FAILED' : selectedStatus;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getAuditLogs({
        tenant_id: selectedTenant || undefined,
        status: effectiveStatus || undefined,
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
  }, [page, effectiveStatus, selectedTenant]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const handleManualRetry = async (logId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRetryingId(logId);
    setRetryResult(null);
    try {
      const result = await api.retryAuditLog(logId);
      setRetryResult({ success: result.success, msg: result.message || 'Retry initiated successfully' });
      fetchLogs();
      onLogsUpdated();
      if (selectedLog && selectedLog.id === logId) {
        const updatedLog = await api.getAuditLogById(logId);
        setSelectedLog(updatedLog);
      }
    } catch (err: any) {
      setRetryResult({ success: false, msg: err.message || 'Failed to trigger retry' });
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

  const errorCount = activeTab === 'all'
    ? filteredLogs.filter(l => l.status === 'FAILED').length
    : filteredLogs.length;

  return (
    <div className="glass-container p-6 mb-8 relative overflow-hidden">

      {/* Background Soft Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-200/30 via-indigo-200/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      {activeTab === 'errors' && (
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-rose-200/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-5 border-b border-slate-200/80 mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 border border-indigo-500/20 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            Webhook Audit Logs
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Real-time delivery tracking · Full payload inspection · Manual re-send
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Order ID..."
              value={searchOrderId}
              onChange={(e) => setSearchOrderId(e.target.value)}
              className="glass-input text-xs pl-9 py-2"
              style={{ maxWidth: 160 }}
            />
          </div>

          {/* Status Filter — only shown on "All" tab */}
          {activeTab === 'all' && (
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
          )}

          {/* Tenant Filter */}
          <select
            value={selectedTenant}
            onChange={(e) => { setSelectedTenant(e.target.value); setPage(1); }}
            className="glass-input text-xs py-2"
            style={{ maxWidth: 160 }}
          >
            <option value="">All Tenants</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.order_prefix || t.prefix})</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="glass-button-secondary p-2 text-slate-600"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub-tabs: All Logs / Error Logs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 w-fit mb-5">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeTab === 'all'
              ? 'bg-white text-indigo-700 shadow border border-white/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          All Logs
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
          }`}>
            {total}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeTab === 'errors'
              ? 'bg-white text-rose-700 shadow border border-white/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          Error Logs
          {total > 0 && activeTab === 'errors' && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
              {total}
            </span>
          )}
        </button>
      </div>

      {/* Error Banner — shown on errors tab when there are results */}
      {activeTab === 'errors' && total > 0 && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-rose-50/90 border border-rose-200/80 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-800">{total} failed webhook{total !== 1 ? 's' : ''} found</p>
            <p className="text-xs text-rose-600 mt-0.5">
              These webhooks failed to deliver. Use the <strong>Re-send</strong> button to retry delivery manually.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/80 bg-white/60 backdrop-blur-md shadow-sm">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center p-8">
            <div className={`w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-3 border ${
              activeTab === 'errors'
                ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
            }`}>
              {activeTab === 'errors' ? <XCircle className="w-7 h-7" /> : <Terminal className="w-7 h-7" />}
            </div>
            <p className="text-slate-800 font-bold text-base">
              {activeTab === 'errors' ? 'No failed webhooks 🎉' : 'No webhook logs found'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeTab === 'errors'
                ? 'All webhook deliveries succeeded. No errors to show.'
                : 'Audit logs will populate here when Midtrans sends webhooks.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100/80 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-3.5">Order ID</th>
                <th className="px-5 py-3.5">Target Website</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">HTTP</th>
                <th className="px-5 py-3.5">
                  {activeTab === 'errors' ? 'Error Reason' : 'Latency'}
                </th>
                <th className="px-5 py-3.5">Attempts</th>
                <th className="px-5 py-3.5">Time</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 text-xs">
              {filteredLogs.map((log) => {
                const httpCode = log.response_code ?? log.response_status ?? log.http_status;
                const tenantName = log.tenant_name || tenants.find(t => t.id === log.tenant_id)?.name || 'Unmapped';
                const tenantPrefix = log.tenant_prefix || tenants.find(t => t.id === log.tenant_id)?.order_prefix;
                const formattedTime = new Date(log.timestamp || log.created_at || Date.now()).toLocaleString();
                const isFailed = log.status === 'FAILED';

                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-white/90 transition-colors ${isFailed ? 'bg-rose-50/40' : ''}`}
                  >
                    <td className="px-5 py-4 font-extrabold text-slate-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {log.order_id}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-800 font-bold">{tenantName}</span>
                        {tenantPrefix && (
                          <span className="glass-pill-badge bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 text-[10px] py-0.5 px-2">
                            {tenantPrefix}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-5 py-4 font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {httpCode ? (
                        <span className={httpCode >= 200 && httpCode < 300 ? 'text-emerald-600' : 'text-rose-600'}>
                          {httpCode}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 max-w-[200px]">
                      {activeTab === 'errors' && isFailed ? (
                        log.error_message ? (
                          <span
                            className="text-rose-700 font-medium truncate block max-w-[180px]"
                            title={log.error_message}
                          >
                            {log.error_message.length > 40
                              ? log.error_message.slice(0, 40) + '…'
                              : log.error_message}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No error detail</span>
                        )
                      ) : (
                        <span className="text-slate-600" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          {log.latency_ms !== null && log.latency_ms !== undefined
                            ? <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" />{log.latency_ms} ms</span>
                            : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className={`px-2.5 py-1 rounded-full border font-bold text-[11px] ${
                        (log.attempts || 1) >= 5
                          ? 'bg-rose-100 border-rose-200 text-rose-700'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        {log.attempts || 1} / 5
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-[11px]">
                      {formattedTime}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="glass-button-secondary px-3 py-1 text-xs inline-flex items-center gap-1"
                        title="Inspect full payload"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Inspect</span>
                      </button>
                      {(isFailed || log.status === 'PENDING' || log.status === 'RETRYING') && (
                        <button
                          onClick={(e) => handleManualRetry(log.id, e)}
                          disabled={retryingId === log.id}
                          className="glass-button-secondary px-3 py-1 text-xs text-amber-700 hover:bg-amber-50 border-amber-200 inline-flex items-center gap-1 disabled:opacity-50"
                          title="Retry delivery"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                          <span>{retryingId === log.id ? '...' : 'Re-send'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="pt-4 mt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
        <div>
          Showing <strong className="text-slate-700">{filteredLogs.length}</strong> of <strong className="text-slate-700">{total}</strong> logs
          {activeTab === 'errors' && <span className="ml-2 text-rose-600 font-semibold">(failed only)</span>}
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

      {/* Inspector Modal — via React Portal */}
      {selectedLog && createPortal(
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedLog(null); }}>
          <div className="glass-modal modal-panel max-w-2xl p-8 relative animate-fade-in-up border border-white/70 flex flex-col">

            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100/60 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="mb-5">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-extrabold text-slate-900" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {selectedLog.order_id}
                </h3>
                {getStatusBadge(selectedLog.status)}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Log ID: <span className="font-mono text-slate-600">{selectedLog.id}</span>
              </p>
            </div>

            {/* Retry notification */}
            {retryResult && (
              <div className={`mb-4 p-3 rounded-2xl text-xs font-medium flex items-center justify-between ${
                retryResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                <span>{retryResult.msg}</span>
                <button onClick={() => setRetryResult(null)} className="text-slate-400 hover:text-slate-700 ml-3">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/80 rounded-2xl border border-slate-200/80 text-xs mb-4">
              <div>
                <span className="text-slate-500 font-medium block mb-0.5">HTTP Code</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {selectedLog.response_code ?? selectedLog.response_status ?? selectedLog.http_status ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block mb-0.5">Latency</span>
                <span className="font-mono text-slate-900 text-sm font-semibold">
                  {selectedLog.latency_ms !== null ? `${selectedLog.latency_ms} ms` : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block mb-0.5">Attempts</span>
                <span className="font-mono text-slate-900 text-sm font-semibold">
                  {selectedLog.attempts || 1} / 5
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block mb-0.5">Time</span>
                <span className="text-[11px] text-slate-700 font-semibold">
                  {new Date(selectedLog.timestamp || selectedLog.created_at || Date.now()).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Error Detail Box */}
            {selectedLog.error_message && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200/80 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold text-rose-800">Delivery Error</span>
                </div>
                <p className="font-mono text-[11px] text-rose-700 break-all leading-relaxed bg-rose-100/60 p-3 rounded-xl">
                  {selectedLog.error_message}
                </p>
              </div>
            )}

            {/* Target URL */}
            {selectedLog.target_url && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200/70 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Target URL</span>
                <p className="font-mono text-xs text-slate-700 break-all">{selectedLog.target_url}</p>
              </div>
            )}

            {/* Payload */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-indigo-600" />
                Midtrans Webhook Payload
              </span>
              <button
                onClick={copyPayloadJson}
                className="glass-button-secondary px-3 py-1 text-xs inline-flex items-center gap-1"
              >
                {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedPayload ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 overflow-y-auto" style={{ maxHeight: 260 }}>
              <pre className="font-mono text-[11px] text-indigo-300 whitespace-pre-wrap break-all leading-relaxed">
                {typeof selectedLog.payload === 'string'
                  ? selectedLog.payload
                  : JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-5 mt-4 border-t border-slate-200/80">
              <button
                onClick={() => setSelectedLog(null)}
                className="glass-button-secondary px-4 py-2 text-sm"
              >
                Close
              </button>
              <button
                onClick={() => handleManualRetry(selectedLog.id)}
                disabled={retryingId === selectedLog.id}
                className="glass-button-primary px-5 py-2 text-sm inline-flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                <RotateCw className={`w-4 h-4 ${retryingId === selectedLog.id ? 'animate-spin' : ''}`} />
                <span>{retryingId === selectedLog.id ? 'Retrying...' : 'Re-send Webhook'}</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
