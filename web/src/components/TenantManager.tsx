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
  Layers,
  Eye,
  EyeOff,
  Sparkles
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
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

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
    if (!text) return;
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

  const maskString = (str: string | undefined, length = 8) => {
    if (!str) return '••••••••';
    return `${str.substring(0, length)}••••••••`;
  };

  return (
    <div className="glass-container p-6 mb-8 relative overflow-hidden">
      
      {/* Background Soft Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-200/30 via-sky-200/20 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 border border-indigo-500/20 shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            Target Websites & Prefix Routing
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage order ID prefix rules and downstream merchant webhook targets with Apple Liquid Glass styling.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="glass-button-primary px-5 py-2.5 text-xs inline-flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Target Website</span>
        </button>
      </div>

      {/* Tenants Grid of Glass Cards */}
      {tenants.length === 0 ? (
        <div className="py-16 text-center glass-card bg-white/50 border border-white/80 p-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
            <Layers className="w-8 h-8" />
          </div>
          <p className="text-slate-800 font-bold text-base">No target websites configured yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Click "Add Target Website" to map an order ID prefix (e.g. SITEA) to a merchant URL and Midtrans Server Key.
          </p>
          <button
            onClick={openCreateModal}
            className="glass-button-primary px-5 py-2.5 text-xs inline-flex items-center gap-2 mt-5"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Tenant</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tenants.map((t) => {
            const prefix = t.order_prefix || t.prefix || 'N/A';
            const serverKeyId = `sk-${t.id}`;
            const secretId = `sec-${t.id}`;
            const apiKeyId = `key-${t.id}`;

            return (
              <div 
                key={t.id} 
                className="glass-card p-6 bg-white/75 border border-white/70 shadow-lg hover:shadow-2xl hover:bg-white/90 transition-all duration-300 rounded-3xl flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Name & Order Prefix Badge */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        {t.name}
                      </h3>
                      <a 
                        href={t.target_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-slate-500 hover:text-indigo-600 font-mono inline-flex items-center gap-1 mt-0.5"
                      >
                        <span className="truncate max-w-xs">{t.target_url}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                      </a>
                    </div>
                    <span className="glass-pill-badge bg-indigo-500/15 text-indigo-700 border border-indigo-500/30 font-mono font-bold text-xs shrink-0">
                      Prefix: {prefix}
                    </span>
                  </div>

                  {/* Keys & Credentials Box */}
                  <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 font-mono text-xs mb-5">
                    
                    {/* Midtrans Server Key */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px] font-sans font-medium flex items-center gap-1">
                        <Key className="w-3.5 h-3.5 text-indigo-500" />
                        Server Key:
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-800 font-semibold">
                          {visibleKeys[serverKeyId] ? t.server_key : maskString(t.server_key, 6)}
                        </span>
                        <button
                          onClick={() => toggleKeyVisibility(serverKeyId)}
                          className="p-1 text-slate-400 hover:text-slate-700"
                          title={visibleKeys[serverKeyId] ? 'Hide Server Key' : 'Reveal Server Key'}
                        >
                          {visibleKeys[serverKeyId] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopy(t.server_key, serverKeyId)}
                          className="p-1 text-slate-400 hover:text-indigo-600"
                          title="Copy Server Key"
                        >
                          {copiedField === serverKeyId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Bridge Webhook Secret */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 text-[11px] font-sans font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        Webhook Secret:
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-800 font-semibold">
                          {t.webhook_secret 
                            ? (visibleKeys[secretId] ? t.webhook_secret : maskString(t.webhook_secret, 6))
                            : 'Auto-generated'}
                        </span>
                        {t.webhook_secret && (
                          <>
                            <button
                              onClick={() => toggleKeyVisibility(secretId)}
                              className="p-1 text-slate-400 hover:text-slate-700"
                              title={visibleKeys[secretId] ? 'Hide Secret' : 'Reveal Secret'}
                            >
                              {visibleKeys[secretId] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopy(t.webhook_secret, secretId)}
                              className="p-1 text-slate-400 hover:text-indigo-600"
                              title="Copy Webhook Secret"
                            >
                              {copiedField === secretId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Tenant API Key */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 text-[11px] font-sans font-medium flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                        Snap API Key:
                      </span>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-800 font-semibold">
                          {t.api_key 
                            ? (visibleKeys[apiKeyId] ? t.api_key : maskString(t.api_key, 6))
                            : 'Auto-generated'}
                        </span>
                        {t.api_key && (
                          <>
                            <button
                              onClick={() => toggleKeyVisibility(apiKeyId)}
                              className="p-1 text-slate-400 hover:text-slate-700"
                              title={visibleKeys[apiKeyId] ? 'Hide API Key' : 'Reveal API Key'}
                            >
                              {visibleKeys[apiKeyId] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopy(t.api_key, apiKeyId)}
                              className="p-1 text-slate-400 hover:text-indigo-600"
                              title="Copy Tenant API Key"
                            >
                              {copiedField === apiKeyId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Created: {new Date(t.created_at || Date.now()).toLocaleDateString()}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openEditModal(t)}
                      className="glass-button-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1 text-slate-700 hover:text-indigo-600"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      className="glass-button-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 border-rose-200/80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog for Add / Edit Tenant */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="glass-modal modal-panel max-w-lg p-8 relative overflow-hidden animate-fade-in-up shadow-2xl border border-white/70">

            
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100/60"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold text-slate-900 mb-1 flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 border border-indigo-500/20">
                <Globe className="w-5 h-5" />
              </div>
              {editingTenant ? 'Edit Target Website' : 'Add Target Website'}
            </h3>
            <p className="text-xs text-slate-500 mb-6 font-medium">
              Configure merchant routing prefix and Midtrans secret keys.
            </p>

            {/* Error Alert Box */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200/90 text-rose-700 text-xs font-medium flex items-start gap-2.5 shadow-sm">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1 font-sans">{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Website Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Site A Ecommerce"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Order ID Prefix (Uppercase) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SITEA (Matches SITEA-1001, SITEA_5541)"
                  value={orderPrefix}
                  onChange={(e) => setOrderPrefix(e.target.value.toUpperCase())}
                  className="glass-input w-full font-mono text-indigo-700 font-bold"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Order prefixes must be unique (e.g. SITEA, SHOPB). Prefixes collide if duplicated.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Target Webhook URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://sitea.example.com/api/webhooks/midtrans"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="glass-input w-full font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Midtrans Server Key *
                </label>
                <input
                  type="text"
                  required
                  placeholder="SB-Mid-server-xxxxxxxxxxxx"
                  value={serverKey}
                  onChange={(e) => setServerKey(e.target.value)}
                  className="glass-input w-full font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Webhook Secret (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="glass-input w-full font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tenant API Key (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="glass-input w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-5 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="glass-button-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="glass-button-primary px-5 py-2 text-xs"
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
