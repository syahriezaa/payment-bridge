import React, { useState } from 'react';
import { Tenant, TenantInput } from '../types';
import { api } from '../services/api';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Globe, 
  Key, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertCircle, 
  X, 
  ExternalLink,
  Layers
} from 'lucide-react';

interface TenantManagerProps {
  tenants: Tenant[];
  onRefresh: () => void;
}

export const TenantManager: React.FC<TenantManagerProps> = ({ tenants, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [orderPrefix, setOrderPrefix] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [apiKey, setApiKey] = useState('');

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingTenant(null);
    setName('');
    setOrderPrefix('');
    setTargetUrl('');
    setServerKey('');
    setWebhookSecret('');
    setApiKey('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (t: Tenant) => {
    setEditingTenant(t);
    setName(t.name);
    setOrderPrefix(t.order_prefix || t.prefix || '');
    setTargetUrl(t.target_url);
    setServerKey(t.server_key);
    setWebhookSecret(t.webhook_secret || '');
    setApiKey(t.api_key || '');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Basic Validation
    if (!name.trim()) return setErrorMsg('Website name is required');
    if (!orderPrefix.trim()) return setErrorMsg('Order ID prefix is required (e.g. SITEA)');
    if (!targetUrl.trim()) return setErrorMsg('Target webhook URL is required');
    if (!serverKey.trim()) return setErrorMsg('Midtrans Server Key is required');

    setIsSubmitting(true);

    try {
      const payload: TenantInput = {
        name: name.trim(),
        order_prefix: orderPrefix.trim().toUpperCase(),
        target_url: targetUrl.trim(),
        server_key: serverKey.trim(),
        webhook_secret: webhookSecret.trim() || undefined,
        api_key: apiKey.trim() || undefined,
      };

      if (editingTenant) {
        await api.updateTenant(editingTenant.id, payload);
      } else {
        await api.createTenant(payload);
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error('Save Tenant Error:', err);
      // Handle prefix collision error specifically
      setErrorMsg(err.message || 'Failed to save target website configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteTenant(id);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to delete tenant: ${err.message}`);
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden mb-8">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            Target Websites & Prefix Routing
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure order ID prefix mappings and webhook signing secrets for downstream merchant websites.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/20 transition-all duration-150"
        >
          <Plus className="w-4 h-4" />
          <span>Add Target Website</span>
        </button>
      </div>

      {/* Tenants Table */}
      <div className="overflow-x-auto">
        {tenants.length === 0 ? (
          <div className="py-12 text-center">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No target websites configured yet</p>
            <p className="text-xs text-slate-500 mt-1">Click "Add Target Website" to add your first tenant routing rule.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Website Name</th>
                <th className="px-5 py-3.5">Order Prefix</th>
                <th className="px-5 py-3.5">Target Webhook URL</th>
                <th className="px-5 py-3.5">Midtrans Key</th>
                <th className="px-5 py-3.5">Bridge Secrets</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tenants.map((t) => {
                const prefix = t.order_prefix || t.prefix || 'N/A';
                return (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-100">
                      {t.name}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {prefix}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-400 max-w-xs truncate">
                      <a 
                        href={t.target_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="hover:text-indigo-400 inline-flex items-center gap-1"
                      >
                        {t.target_url}
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </a>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-400">
                      <span title={t.server_key}>
                        {t.server_key.substring(0, 10)}...
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-500">Secret:</span>
                        <span className="font-mono text-slate-300">
                          {t.webhook_secret ? `${t.webhook_secret.substring(0, 8)}...` : 'Auto'}
                        </span>
                        <button
                          onClick={() => handleCopy(t.webhook_secret, `sec-${t.id}`)}
                          className="p-1 hover:text-indigo-400 text-slate-500 transition-colors"
                          title="Copy Webhook Secret"
                        >
                          {copiedField === `sec-${t.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-500">API Key:</span>
                        <span className="font-mono text-slate-300">
                          {t.api_key ? `${t.api_key.substring(0, 8)}...` : 'Auto'}
                        </span>
                        <button
                          onClick={() => handleCopy(t.api_key, `key-${t.id}`)}
                          className="p-1 hover:text-indigo-400 text-slate-500 transition-colors"
                          title="Copy Tenant API Key"
                        >
                          {copiedField === `key-${t.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(t)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                        title="Edit Target Configuration"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                        title="Delete Target Configuration"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" />
              {editingTenant ? 'Edit Target Website' : 'Add Target Website'}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Specify the merchant details and order prefix rule for routing webhooks.
            </p>

            {/* Prefix Collision / Error Alert */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Error: </span>
                  {errorMsg}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Website Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Site A Ecommerce"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Order ID Prefix (Uppercase) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SITEA (Matches SITEA-1001, SITEA_5541)"
                  value={orderPrefix}
                  onChange={(e) => setOrderPrefix(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Must be unique across all tenants. Prefixes collide if duplicate.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Webhook URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://sitea.example.com/api/webhooks/midtrans"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Midtrans Server Key *
                </label>
                <input
                  type="text"
                  required
                  placeholder="SB-Mid-server-xxxxxxxxxxxx"
                  value={serverKey}
                  onChange={(e) => setServerKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Webhook Secret (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tenant API Key (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingTenant ? 'Update Configuration' : 'Create Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
