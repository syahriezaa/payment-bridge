import { Tenant, TenantInput, WebhookAuditLog, AuditLogQueryResult, Rule } from '../types';

const API_BASE = '';

const TOKEN_KEY = 'bridge_admin_token';
const LEGACY_TOKEN_KEY = 'admin_token';
const USER_KEY = 'bridge_admin_user';

type UnauthorizedCallback = () => void;
const unauthorizedListeners: Set<UnauthorizedCallback> = new Set();

export function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || null;
}

export function setStoredToken(token: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LEGACY_TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): { id: string; username: string } | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: { id: string; username: string }): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    clearStoredToken();
    unauthorizedListeners.forEach(listener => listener());
    const errData = await response.json().catch(() => ({ error: 'Unauthorized access' }));
    throw new Error(errData.error || 'Unauthorized: Please log in to continue.');
  }

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
  // Auth Callback System
  onUnauthorized(cb: UnauthorizedCallback): () => void {
    unauthorizedListeners.add(cb);
    return () => {
      unauthorizedListeners.delete(cb);
    };
  },

  getToken(): string | null {
    return getStoredToken();
  },

  setToken(token: string): void {
    setStoredToken(token);
  },

  logout(): void {
    clearStoredToken();
    unauthorizedListeners.forEach(cb => cb());
  },

  getCurrentUser(): { id: string; username: string } | null {
    return getStoredUser();
  },

  // Auth Endpoints
  async setup(data: { username: string; password: string }): Promise<{ token: string; user: { id: string; username: string } }> {
    const res = await fetch(`${API_BASE}/api/admin/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await handleResponse<{ token: string; user: { id: string; username: string } }>(res);
    if (result.token) {
      setStoredToken(result.token);
      if (result.user) setStoredUser(result.user);
    }
    return result;
  },

  async login(data: { username: string; password: string }): Promise<{ token: string; user: { id: string; username: string } }> {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await handleResponse<{ token: string; user: { id: string; username: string } }>(res);
    if (result.token) {
      setStoredToken(result.token);
      if (result.user) setStoredUser(result.user);
    }
    return result;
  },

  // Health Check
  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },

  // Tenants CRUD
  async getTenants(): Promise<Tenant[]> {
    const res = await fetch(`${API_BASE}/api/admin/tenants`, {
      headers: { ...getAuthHeaders() }
    });
    return handleResponse<Tenant[]>(res);
  },

  async getTenant(id: string): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${id}`, {
      headers: { ...getAuthHeaders() }
    });
    return handleResponse<Tenant>(res);
  },

  async createTenant(data: TenantInput): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/api/admin/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    return handleResponse<Tenant>(res);
  },

  async updateTenant(id: string, data: Partial<TenantInput>): Promise<Tenant> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    return handleResponse<Tenant>(res);
  },

  async deleteTenant(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/admin/tenants/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  // Rules
  async getRules(): Promise<Rule[]> {
    const res = await fetch(`${API_BASE}/api/admin/rules`, {
      headers: { ...getAuthHeaders() }
    });
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
    const res = await fetch(url, {
      headers: { ...getAuthHeaders() }
    });
    return handleResponse<AuditLogQueryResult>(res);
  },

  async getAuditLogById(id: string): Promise<WebhookAuditLog> {
    const res = await fetch(`${API_BASE}/api/admin/audit-logs/${id}`, {
      headers: { ...getAuthHeaders() }
    });
    return handleResponse<WebhookAuditLog>(res);
  },

  async retryAuditLog(id: string): Promise<{ success: boolean; message: string; log: WebhookAuditLog }> {
    const res = await fetch(`${API_BASE}/api/admin/audit-logs/${id}/retry`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    return handleResponse<{ success: boolean; message: string; log: WebhookAuditLog }>(res);
  }
};
