import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { Tenant, TenantInput, WebhookAuditLog, CreateAuditLogInput } from './types.js';

let dbInstance: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (dbInstance) return dbInstance;

  const targetPath = dbPath || config.databasePath;
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new Database(targetPath);
  dbInstance.pragma('journal_mode = WAL');
  initTables(dbInstance);
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      order_prefix TEXT NOT NULL UNIQUE,
      target_url TEXT NOT NULL,
      webhook_secret TEXT NOT NULL,
      server_key TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_audit_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      order_id TEXT NOT NULL,
      prefix TEXT,
      payload TEXT NOT NULL,
      target_url TEXT,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_http_status INTEGER,
      execution_latency_ms INTEGER,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tenants_prefix ON tenants(order_prefix);
    CREATE INDEX IF NOT EXISTS idx_tenants_api_key ON tenants(api_key);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON webhook_audit_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON webhook_audit_logs(status);
  `);
}

function formatTenant(row: any): Tenant {
  return {
    id: row.id,
    name: row.name,
    order_prefix: row.order_prefix,
    prefix: row.order_prefix,
    target_url: row.target_url,
    webhook_secret: row.webhook_secret,
    server_key: row.server_key,
    api_key: row.api_key,
    created_at: row.created_at
  };
}

function formatAuditLog(row: any): WebhookAuditLog {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    order_id: row.order_id,
    prefix: row.prefix,
    payload: row.payload,
    target_url: row.target_url,
    status: row.status,
    attempt_count: row.attempt_count,
    attempts: row.attempt_count,
    last_http_status: row.last_http_status,
    response_code: row.last_http_status,
    execution_latency_ms: row.execution_latency_ms,
    latency_ms: row.execution_latency_ms,
    error: row.error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    timestamp: row.created_at
  };
}

// Tenant DAO functions
export const tenantDb = {
  create(input: TenantInput): Tenant {
    const db = getDb();
    const prefix = (input.order_prefix || input.prefix || '').toUpperCase();
    if (!prefix) {
      throw new Error('Order prefix is required');
    }

    const existing = db.prepare('SELECT id FROM tenants WHERE order_prefix = ?').get(prefix);
    if (existing) {
      const err: any = new Error(`Tenant prefix ${prefix} already registered`);
      err.code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw err;
    }

    const id = input.id || `tenant-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const apiKey = input.api_key || `bk_${prefix.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const webhookSecret = input.webhook_secret || `secret_${prefix.toLowerCase()}`;
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO tenants (id, name, order_prefix, target_url, webhook_secret, server_key, api_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, input.name, prefix, input.target_url, webhookSecret, input.server_key, apiKey, createdAt);

    return tenantDb.getById(id)!;
  },

  getAll(): Tenant[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all();
    return rows.map(formatTenant);
  },

  getById(id: string): Tenant | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    return row ? formatTenant(row) : null;
  },

  getByPrefix(prefix: string): Tenant | null {
    const db = getDb();
    const normalizedPrefix = prefix.toUpperCase();
    const row = db.prepare('SELECT * FROM tenants WHERE order_prefix = ?').get(normalizedPrefix);
    return row ? formatTenant(row) : null;
  },

  getByApiKey(apiKey: string): Tenant | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tenants WHERE api_key = ?').get(apiKey);
    return row ? formatTenant(row) : null;
  },

  update(id: string, updates: Partial<TenantInput>): Tenant | null {
    const db = getDb();
    const tenant = tenantDb.getById(id);
    if (!tenant) return null;

    const name = updates.name !== undefined ? updates.name : tenant.name;
    const prefix = updates.order_prefix || updates.prefix ? (updates.order_prefix || updates.prefix)!.toUpperCase() : tenant.order_prefix;
    const targetUrl = updates.target_url !== undefined ? updates.target_url : tenant.target_url;
    const webhookSecret = updates.webhook_secret !== undefined ? updates.webhook_secret : tenant.webhook_secret;
    const serverKey = updates.server_key !== undefined ? updates.server_key : tenant.server_key;
    const apiKey = updates.api_key !== undefined ? updates.api_key : tenant.api_key;

    const stmt = db.prepare(`
      UPDATE tenants
      SET name = ?, order_prefix = ?, target_url = ?, webhook_secret = ?, server_key = ?, api_key = ?
      WHERE id = ?
    `);

    stmt.run(name, prefix, targetUrl, webhookSecret, serverKey, apiKey, id);
    return tenantDb.getById(id);
  },

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM tenants WHERE id = ?').run(id);
    return result.changes > 0;
  },

  clearAll(): void {
    const db = getDb();
    db.prepare('DELETE FROM webhook_audit_logs').run();
    db.prepare('DELETE FROM tenants').run();
  }
};

// Audit Log DAO functions
export const auditDb = {
  create(input: CreateAuditLogInput): WebhookAuditLog {
    const db = getDb();
    const id = input.id || `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO webhook_audit_logs (
        id, tenant_id, order_id, prefix, payload, target_url, status,
        attempt_count, last_http_status, execution_latency_ms, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.tenant_id || null,
      input.order_id,
      input.prefix || null,
      input.payload,
      input.target_url || null,
      input.status,
      input.attempt_count ?? 0,
      input.last_http_status ?? null,
      input.execution_latency_ms ?? null,
      input.error || null,
      now,
      now
    );

    return auditDb.getById(id)!;
  },

  getById(id: string): WebhookAuditLog | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM webhook_audit_logs WHERE id = ?').get(id);
    return row ? formatAuditLog(row) : null;
  },

  updateStatus(
    id: string,
    status: string,
    attemptCount: number,
    lastHttpStatus: number | null,
    latencyMs: number | null,
    error: string | null = null
  ): WebhookAuditLog | null {
    const db = getDb();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE webhook_audit_logs
      SET status = ?, attempt_count = ?, last_http_status = ?, execution_latency_ms = ?, error = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(status, attemptCount, lastHttpStatus, latencyMs, error, now, id);
    return auditDb.getById(id);
  },

  query(params: { tenant_id?: string; status?: string; page?: number; limit?: number }): { total: number; page: number; limit: number; logs: WebhookAuditLog[] } {
    const db = getDb();
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];

    if (params.tenant_id) {
      conditions.push('tenant_id = ?');
      values.push(params.tenant_id);
    }
    if (params.status) {
      conditions.push('status = ?');
      values.push(params.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow: any = db.prepare(`SELECT COUNT(*) as count FROM webhook_audit_logs ${whereClause}`).get(...values);
    const total = countRow ? countRow.count : 0;

    const rows = db.prepare(`
      SELECT * FROM webhook_audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...values, limit, offset);

    return {
      total,
      page,
      limit,
      logs: rows.map(formatAuditLog)
    };
  }
};
