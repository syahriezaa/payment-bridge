import { Tenant, TenantInput, WebhookAuditLog, AuditLogQueryResult, Rule } from '../types';

const API_BASE = '';

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage = typeof data === 'object' && data.error 
      ? data.error 
      : (typeof data === 'string' ? data : `HTTP Error ${response.status}`);
    throw new Error(errorMessage);
  }

  return data as T;
}

export const api = {
  // Health
  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },

  // Tenants CRUD
  async getTenants(): Promise<Tenant[]> {
    const res = await fetch(`${API_BASE}/api/admin/tenants`);
    return handleResponse<Tenant[]>(res);
  },

  async getTenant(id: string): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${id}`);
    return handleResponse<Tenant>(res);
  },

  async createTenant(data: TenantInput): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/api/admin/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<Tenant>(res);
  },

  async updateTenant(id: string, data: Partial<TenantInput>): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<Tenant>(res);
  },

  async deleteTenant(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${id}`, {
      method: 'DELETE'
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Rules
  async getRules(): Promise<Rule[]> {
    const res = await fetch(`${API_BASE}/api/admin/rules`);
    return handleResponse<Rule[]>(res);
  },

  // Webhook Audit Logs
  async getAuditLogs(params?: { tenant_id?: string; status?: string; page?: number; limit?: number }): Promise<AuditLogQueryResult> {
    const query = new URLSearchParams();
    if (params?.tenant_id) query.append('tenant_id', params.tenant_id);
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const url = `${API_BASE}/api/admin/audit-logs${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url);
    return handleResponse<AuditLogQueryResult>(res);
  },

  async getAuditLogById(id: string): Promise<WebhookAuditLog> {
    const res = await fetch(`${API_BASE}/api/admin/audit-logs/${id}`);
    return handleResponse<WebhookAuditLog>(res);
  },

  async retryAuditLog(id: string): Promise<{ success: boolean; message: string; log: WebhookAuditLog }> {
    const res = await fetch(`${API_BASE}/api/admin/audit-logs/${id}/retry`, {
      method: 'POST'
    });
    return handleResponse<{ success: boolean; message: string; log: WebhookAuditLog }>(res);
  }
};
