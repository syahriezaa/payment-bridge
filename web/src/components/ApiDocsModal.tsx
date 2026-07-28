import React from 'react';
import { X, FileText, Server, Key, ArrowRight, ShieldCheck } from 'lucide-react';

interface ApiDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDocsModal: React.FC<ApiDocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full p-6 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4 pb-3 border-b border-slate-800">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Midtrans Payment Bridge API Specifications
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Complete specification of backend REST endpoints for webhook ingress, target management, and snap proxy.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 text-xs text-slate-300 pr-1">
          {/* Webhook Ingress Endpoint */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                POST
              </span>
              <code className="font-mono text-indigo-300 font-bold text-sm">/api/webhooks/midtrans</code>
            </div>
            <p className="text-slate-400">
              Ingress endpoint for Midtrans webhook notifications. Verifies Midtrans SHA-512 signature (<code className="text-slate-200">SHA512(order_id + status_code + gross_amount + ServerKey)</code>), extracts order prefix, enqueues async delivery to matching website, and immediately returns 200 OK.
            </p>
            <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-slate-300">
              Response: &#123; "status": "received", "audit_id": "aud_12345" &#125;
            </div>
          </div>

          {/* Snap Proxy Endpoint */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                POST
              </span>
              <code className="font-mono text-indigo-300 font-bold text-sm">/api/v1/snap/token</code>
            </div>
            <p className="text-slate-400">
              Proxy helper endpoint allowing target websites to generate Snap tokens. Automatically prepends tenant order prefix to <code className="text-slate-200">order_id</code>.
            </p>
            <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-slate-300 space-y-1">
              <div>Header: Authorization: Bearer &lt;Bridge_Tenant_API_Key&gt;</div>
              <div>Body: &#123; "order_id": "1001", "gross_amount": 50000 &#125;</div>
            </div>
          </div>

          {/* Target Website Management APIs */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
              <Server className="w-4 h-4 text-indigo-400" />
              Target Website Management & Prefix Rules
            </h4>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                <span className="text-blue-400 font-bold">GET /api/admin/tenants</span>
                <span className="text-slate-400">List all target websites</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                <span className="text-emerald-400 font-bold">POST /api/admin/tenants</span>
                <span className="text-slate-400">Create new target website config</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                <span className="text-amber-400 font-bold">PUT /api/admin/tenants/:id</span>
                <span className="text-slate-400">Update target website config</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                <span className="text-rose-400 font-bold">DELETE /api/admin/tenants/:id</span>
                <span className="text-slate-400">Delete target website config</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                <span className="text-blue-400 font-bold">GET /api/admin/rules</span>
                <span className="text-slate-400">List order ID routing rules</span>
              </div>
            </div>
          </div>

          {/* Webhook Audit Logs & Manual Retry */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Audit Logs & Manual Re-send Trigger
            </h4>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                <span className="text-blue-400 font-bold">GET /api/admin/audit-logs</span>
                <span className="text-slate-400">Query logs (filters: tenant_id, status, page)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                <span className="text-blue-400 font-bold">GET /api/admin/audit-logs/:id</span>
                <span className="text-slate-400">Get audit log details</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900">
                <span className="text-emerald-400 font-bold">POST /api/admin/audit-logs/:id/retry</span>
                <span className="text-slate-400">Trigger manual webhook re-send</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            Close Specifications
          </button>
        </div>
      </div>
    </div>
  );
};
