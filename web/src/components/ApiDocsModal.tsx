import React from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Server, ShieldCheck, Sparkles, Send, Layers } from 'lucide-react';

interface ApiDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDocsModal: React.FC<ApiDocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-modal modal-panel max-w-3xl p-8 relative animate-fade-in-up border border-white/70 flex flex-col">

        
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5 pb-4 border-b border-slate-200/80">
          <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 border border-indigo-500/20 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            Midtrans Payment Bridge REST API Specs
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Interactive API reference for Webhook Ingress, Snap Token Proxy, and Admin Management endpoints.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 text-xs text-slate-700 pr-2">
          
          {/* Webhook Ingress Endpoint */}
          <div className="glass-card p-5 bg-white/90 border border-white/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="glass-pill-badge bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-mono font-bold text-[11px] px-3 py-1">
                POST
              </span>
              <code className="font-mono text-indigo-600 font-bold text-sm bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                /api/webhooks/midtrans
              </code>
            </div>
            <p className="text-slate-600 leading-normal">
              Public webhook ingress endpoint for Midtrans notifications. Validates Midtrans SHA-512 signature (<code className="font-mono text-slate-800">SHA512(order_id + status_code + gross_amount + ServerKey)</code>), extracts order prefix, enqueues async delivery to target merchant website, and immediately returns 200 OK.
            </p>
            <div className="p-3 rounded-xl bg-slate-900 text-indigo-200 font-mono text-[11px] space-y-1">
              <div className="text-slate-400">// Sample Response:</div>
              <div>&#123; "status": "received", "audit_id": "aud_1785267730" &#125;</div>
            </div>
          </div>

          {/* Snap Token Proxy Endpoint */}
          <div className="glass-card p-5 bg-white/90 border border-white/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="glass-pill-badge bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-mono font-bold text-[11px] px-3 py-1">
                POST
              </span>
              <code className="font-mono text-indigo-600 font-bold text-sm bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                /api/v1/snap/token
              </code>
            </div>
            <p className="text-slate-600 leading-normal">
              Proxy helper endpoint allowing target merchant applications to request Snap payment tokens. Automatically prepends tenant order prefix (e.g. <code className="font-mono text-slate-800">SITEA-1001</code>) and forwards to Midtrans Snap API.
            </p>
            <div className="p-3 rounded-xl bg-slate-900 text-indigo-200 font-mono text-[11px] space-y-1">
              <div className="text-slate-400">// Request Headers & Body:</div>
              <div>Authorization: Bearer &lt;Bridge_Tenant_API_Key&gt;</div>
              <div>&#123; "order_id": "1001", "gross_amount": 50000 &#125;</div>
            </div>
          </div>

          {/* Target Website Management APIs */}
          <div className="glass-card p-5 bg-white/90 border border-white/80 space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              Target Website Management & Routing Rules
            </h4>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-sky-700 font-bold">GET /api/admin/tenants</span>
                <span className="text-slate-500 font-sans">List all configured target websites</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-emerald-700 font-bold">POST /api/admin/tenants</span>
                <span className="text-slate-500 font-sans">Create target website configuration</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-amber-700 font-bold">PUT /api/admin/tenants/:id</span>
                <span className="text-slate-500 font-sans">Update target website configuration</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-rose-700 font-bold">DELETE /api/admin/tenants/:id</span>
                <span className="text-slate-500 font-sans">Delete target website configuration</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-sky-700 font-bold">GET /api/admin/rules</span>
                <span className="text-slate-500 font-sans">List active order ID routing rules</span>
              </div>
            </div>
          </div>

          {/* Webhook Audit Logs & Manual Retry */}
          <div className="glass-card p-5 bg-white/90 border border-white/80 space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Audit Logs & Manual Re-send Trigger
            </h4>

            <div className="space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-sky-700 font-bold">GET /api/admin/audit-logs</span>
                <span className="text-slate-500 font-sans">Query logs (filters: tenant_id, status, page)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-sky-700 font-bold">GET /api/admin/audit-logs/:id</span>
                <span className="text-slate-500 font-sans">Get audit log details</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-emerald-700 font-bold">POST /api/admin/audit-logs/:id/retry</span>
                <span className="text-slate-500 font-sans">Trigger manual webhook re-send</span>
              </div>
            </div>
          </div>

        </div>

        <div className="pt-5 mt-4 border-t border-slate-200/80 flex justify-end">
          <button
            onClick={onClose}
            className="glass-button-primary px-5 py-2 text-xs"
          >
            Close Specifications
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
