export class TestClient {
  constructor(baseUrl = process.env.BRIDGE_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async postWebhook(payload, headers = {}) {
    const res = await fetch(`${this.baseUrl}/api/webhooks/midtrans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload)
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }

    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      data
    };
  }

  async createTenant(tenant) {
    const res = await fetch(`${this.baseUrl}/api/admin/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenant)
    });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  }

  async getTenants() {
    const res = await fetch(`${this.baseUrl}/api/admin/tenants`, {
      method: 'GET'
    });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  }

  async getTenant(id) {
    const res = await fetch(`${this.baseUrl}/api/admin/tenants/${id}`, {
      method: 'GET'
    });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  }

  async updateTenant(id, tenant) {
    const res = await fetch(`${this.baseUrl}/api/admin/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenant)
    });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  }

  async deleteTenant(id) {
    const res = await fetch(`${this.baseUrl}/api/admin/tenants/${id}`, {
      method: 'DELETE'
    });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  }

  async createSnapToken(apiKey, payload) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const res = await fetch(`${this.baseUrl}/api/v1/snap/token`, {
      method: 'POST',
      headers,
      body: typeof payload === 'string' ? payload : JSON.stringify(payload)
    });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  }

  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}/api/admin/audit-logs${query ? `?${query}` : ''}`;
    const res = await fetch(url, { method: 'GET' });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  }

  async getAuditLog(id) {
    const res = await fetch(`${this.baseUrl}/api/admin/audit-logs/${id}`, { method: 'GET' });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  }

  async retryAuditLog(id) {
    const res = await fetch(`${this.baseUrl}/api/admin/audit-logs/${id}/retry`, {
      method: 'POST'
    });
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  }
}
