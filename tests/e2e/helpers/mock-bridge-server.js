import http from 'node:http';
import { verifyMidtransSignature, calculateBridgeSignature } from './crypto-utils.js';

export class MockBridgeServer {
  constructor(port = 3000, midtransUrl = 'http://localhost:9998') {
    this.port = port;
    this.midtransUrl = midtransUrl;
    this.server = null;
    this.tenants = new Map(); // id -> tenant
    this.prefixIndex = new Map(); // prefix -> tenant
    this.apiKeyIndex = new Map(); // api_key -> tenant
    this.auditLogs = []; // array of audit log entries
    this.idCounter = 1;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;
        const method = req.method;

        let bodyStr = '';
        req.on('data', chunk => { bodyStr += chunk; });
        req.on('end', async () => {
          let bodyJson = null;
          try {
            if (bodyStr) bodyJson = JSON.parse(bodyStr);
          } catch {
            bodyJson = null;
          }

          // Routes Router
          try {
            // 1. Webhook Ingress: POST /api/webhooks/midtrans
            if (pathname === '/api/webhooks/midtrans' && method === 'POST') {
              return await this.handleWebhook(req, res, bodyStr, bodyJson);
            }

            // 2. Tenant Admin CRUD: /api/admin/tenants
            if (pathname === '/api/admin/tenants') {
              if (method === 'POST') return this.handleCreateTenant(res, bodyJson);
              if (method === 'GET') return this.handleGetTenants(res);
            }

            const tenantMatch = pathname.match(/^\/api\/admin\/tenants\/([^/]+)$/);
            if (tenantMatch) {
              const id = tenantMatch[1];
              if (method === 'GET') return this.handleGetTenant(res, id);
              if (method === 'PUT') return this.handleUpdateTenant(res, id, bodyJson);
              if (method === 'DELETE') return this.handleDeleteTenant(res, id);
            }

            // 3. Snap Token Proxy: POST /api/v1/snap/token
            if (pathname === '/api/v1/snap/token' && method === 'POST') {
              return await this.handleSnapToken(req, res, bodyStr, bodyJson);
            }

            // 4. Audit Logs API: /api/admin/audit-logs
            if (pathname === '/api/admin/audit-logs' && method === 'GET') {
              return this.handleGetAuditLogs(res, url.searchParams);
            }

            const auditMatch = pathname.match(/^\/api\/admin\/tenants\/logs\/([^/]+)$/) || pathname.match(/^\/api\/admin\/audit-logs\/([^/]+)$/);
            if (auditMatch && method === 'GET') {
              const id = auditMatch[1];
              return this.handleGetAuditLog(res, id);
            }

            const retryMatch = pathname.match(/^\/api\/admin\/audit-logs\/([^/]+)\/retry$/);
            if (retryMatch && method === 'POST') {
              const id = retryMatch[1];
              return await this.handleRetryAuditLog(res, id);
            }

            // 404 Not Found
            this.sendJson(res, 404, { error: 'Not Found' });
          } catch (err) {
            this.sendJson(res, 500, { error: err.message });
          }
        });
      });

      this.server.on('error', err => reject(err));
      this.server.listen(this.port, () => resolve());
    });
  }

  stop() {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  reset() {
    this.tenants.clear();
    this.prefixIndex.clear();
    this.apiKeyIndex.clear();
    this.auditLogs = [];
    this.idCounter = 1;
  }

  sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // --- Handlers ---
  handleCreateTenant(res, body) {
    if (!body || !body.name || !body.prefix || !body.server_key || !body.target_url) {
      return this.sendJson(res, 400, { error: 'Missing required tenant fields' });
    }

    const prefix = body.prefix.toUpperCase();
    if (this.prefixIndex.has(prefix)) {
      return this.sendJson(res, 409, { error: `Tenant prefix ${prefix} already registered` });
    }

    const id = `tenant-${this.idCounter++}`;
    const apiKey = `bk_${prefix.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tenant = {
      id,
      name: body.name,
      prefix,
      server_key: body.server_key,
      target_url: body.target_url,
      webhook_secret: body.webhook_secret || `secret_${prefix.toLowerCase()}`,
      api_key: apiKey,
      created_at: new Date().toISOString()
    };

    this.tenants.set(id, tenant);
    this.prefixIndex.set(prefix, tenant);
    this.apiKeyIndex.set(apiKey, tenant);

    return this.sendJson(res, 201, tenant);
  }

  handleGetTenants(res) {
    return this.sendJson(res, 200, Array.from(this.tenants.values()));
  }

  handleGetTenant(res, id) {
    const tenant = this.tenants.get(id);
    if (!tenant) return this.sendJson(res, 404, { error: 'Tenant not found' });
    return this.sendJson(res, 200, tenant);
  }

  handleUpdateTenant(res, id, body) {
    const tenant = this.tenants.get(id);
    if (!tenant) return this.sendJson(res, 404, { error: 'Tenant not found' });

    if (body.target_url) tenant.target_url = body.target_url;
    if (body.webhook_secret) tenant.webhook_secret = body.webhook_secret;
    if (body.server_key) tenant.server_key = body.server_key;
    if (body.name) tenant.name = body.name;

    return this.sendJson(res, 200, tenant);
  }

  handleDeleteTenant(res, id) {
    const tenant = this.tenants.get(id);
    if (!tenant) return this.sendJson(res, 404, { error: 'Tenant not found' });

    this.tenants.delete(id);
    this.prefixIndex.delete(tenant.prefix);
    this.apiKeyIndex.delete(tenant.api_key);

    return this.sendJson(res, 200, { success: true, message: 'Tenant deleted' });
  }

  async handleWebhook(req, res, rawBody, payload) {
    if (!payload || typeof payload !== 'object') {
      return this.sendJson(res, 400, { error: 'Invalid JSON payload' });
    }

    const { order_id, status_code, gross_amount, signature_key } = payload;

    if (!order_id || !signature_key || !status_code || gross_amount === undefined) {
      return this.sendJson(res, 400, { error: 'Missing required Midtrans webhook parameters' });
    }

    // Extract prefix
    const match = String(order_id).match(/^([A-Z0-9]+)[-_#]/i);
    const prefix = match ? match[1].toUpperCase() : null;

    if (!prefix || !this.prefixIndex.has(prefix)) {
      const auditId = `audit-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      const log = {
        id: auditId,
        order_id,
        prefix: prefix || 'UNKNOWN',
        tenant_id: null,
        status: 'UNMAPPED_PREFIX',
        response_code: 404,
        attempts: 0,
        payload: rawBody,
        timestamp: new Date().toISOString()
      };
      this.auditLogs.push(log);
      return this.sendJson(res, 400, { error: 'Unmapped Order ID prefix', audit_id: auditId });
    }

    const tenant = this.prefixIndex.get(prefix);

    // Verify SHA-512 signature
    const isValid = verifyMidtransSignature(orderId(order_id), status_code, gross_amount, tenant.server_key, signature_key);
    if (!isValid) {
      const auditId = `audit-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      const log = {
        id: auditId,
        order_id,
        prefix,
        tenant_id: tenant.id,
        status: 'INVALID_SIGNATURE',
        response_code: 401,
        attempts: 0,
        payload: rawBody,
        timestamp: new Date().toISOString()
      };
      this.auditLogs.push(log);
      return this.sendJson(res, 401, { error: 'Invalid Midtrans signature key', audit_id: auditId });
    }

    // Valid signature and tenant mapped!
    const auditId = `audit-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const log = {
      id: auditId,
      order_id,
      prefix,
      tenant_id: tenant.id,
      status: 'PENDING',
      response_code: null,
      attempts: 0,
      payload: rawBody,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.push(log);

    // Respond immediately to Midtrans
    this.sendJson(res, 200, { status: 'received', audit_id: auditId });

    // Asynchronous dispatch
    setImmediate(async () => {
      await this.dispatchTargetWebhook(log, tenant, rawBody);
    });
  }

  async dispatchTargetWebhook(log, tenant, rawBody) {
    log.attempts++;
    const signature = calculateBridgeSignature(rawBody, tenant.webhook_secret);
    const startMs = Date.now();

    try {
      const targetRes = await fetch(tenant.target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Signature': signature
        },
        body: rawBody
      });

      log.response_code = targetRes.status;
      log.latency_ms = Date.now() - startMs;

      if (targetRes.status >= 200 && targetRes.status < 300) {
        log.status = 'DISPATCHED';
      } else {
        log.status = 'FAILED';
      }
    } catch (err) {
      log.response_code = 503;
      log.latency_ms = Date.now() - startMs;
      log.status = 'FAILED';
      log.error = err.message;
    }
  }

  async handleSnapToken(req, res, rawBody, body) {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) {
      return this.sendJson(res, 401, { error: 'Missing or invalid Authorization header' });
    }

    const apiKey = authHeader.replace('Bearer ', '').trim();
    const tenant = this.apiKeyIndex.get(apiKey);
    if (!tenant) {
      return this.sendJson(res, 401, { error: 'Invalid Tenant API key' });
    }

    if (!body || !body.order_id || body.gross_amount === undefined) {
      return this.sendJson(res, 400, { error: 'Missing order_id or gross_amount' });
    }

    if (typeof body.gross_amount !== 'number' || body.gross_amount <= 0) {
      return this.sendJson(res, 400, { error: 'gross_amount must be a positive number' });
    }

    // Prepend tenant prefix if not already present
    const rawOrderId = String(body.order_id);
    const prependedOrderId = rawOrderId.startsWith(`${tenant.prefix}-`)
      ? rawOrderId
      : `${tenant.prefix}-${rawOrderId}`;

    const snapPayload = {
      ...body,
      order_id: prependedOrderId
    };

    // Forward to Midtrans Mock Snap API
    try {
      const snapRes = await fetch(`${this.midtransUrl}/snap/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(tenant.server_key + ':').toString('base64')}`
        },
        body: JSON.stringify(snapPayload)
      });

      const snapData = await snapRes.json();
      return this.sendJson(res, snapRes.status, snapData);
    } catch (err) {
      return this.sendJson(res, 502, { error: 'Failed to communicate with Midtrans Snap API', details: err.message });
    }
  }

  handleGetAuditLogs(res, searchParams) {
    let logs = [...this.auditLogs];

    const tenantId = searchParams.get('tenant_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (tenantId) logs = logs.filter(l => l.tenant_id === tenantId);
    if (status) logs = logs.filter(l => l.status === status);

    const startIndex = (page - 1) * limit;
    const paginated = logs.slice(startIndex, startIndex + limit);

    return this.sendJson(res, 200, {
      total: logs.length,
      page,
      limit,
      logs: paginated
    });
  }

  handleGetAuditLog(res, id) {
    const log = this.auditLogs.find(l => l.id === id);
    if (!log) return this.sendJson(res, 404, { error: 'Audit log not found' });
    return this.sendJson(res, 200, log);
  }

  async handleRetryAuditLog(res, id) {
    const log = this.auditLogs.find(l => l.id === id);
    if (!log) return this.sendJson(res, 404, { error: 'Audit log not found' });

    const tenant = this.tenants.get(log.tenant_id);
    if (!tenant) return this.sendJson(res, 400, { error: 'Associated tenant no longer exists' });

    await this.dispatchTargetWebhook(log, tenant, log.payload);
    return this.sendJson(res, 200, { success: true, message: 'Retry triggered', log });
  }
}

function orderId(val) {
  return String(val);
}
