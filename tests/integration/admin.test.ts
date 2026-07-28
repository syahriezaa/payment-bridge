import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { buildServer } from '../../src/server.js';
import { tenantDb, getDb, closeDb } from '../../src/db/index.js';
import { auditService } from '../../src/services/audit.js';
import { FastifyInstance } from 'fastify';

describe('Integration: Admin Management API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    closeDb();
    getDb(':memory:');
    app = await buildServer();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('handles tenant CRUD operations', async () => {
    // 1. Create tenant
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/tenants',
      payload: {
        name: 'Store Alpha',
        prefix: 'ALPHA',
        server_key: 'server-alpha-key',
        target_url: 'http://localhost:9999/alpha',
        webhook_secret: 'sec-alpha'
      }
    });

    assert.strictEqual(createRes.statusCode, 201);
    const tenant = createRes.json();
    assert.strictEqual(tenant.name, 'Store Alpha');
    assert.strictEqual(tenant.prefix, 'ALPHA');
    assert.ok(tenant.id);
    assert.ok(tenant.api_key);

    // 2. Get list of tenants
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants'
    });

    assert.strictEqual(listRes.statusCode, 200);
    const tenants = listRes.json();
    assert.strictEqual(Array.isArray(tenants), true);
    assert.strictEqual(tenants.length, 1);

    // 3. Get tenant by ID
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/admin/tenants/${tenant.id}`
    });

    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.json().id, tenant.id);

    // 4. Update tenant
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/admin/tenants/${tenant.id}`,
      payload: {
        target_url: 'http://localhost:9999/alpha-new'
      }
    });

    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.json().target_url, 'http://localhost:9999/alpha-new');

    // 5. Delete tenant
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/tenants/${tenant.id}`
    });

    assert.strictEqual(deleteRes.statusCode, 200);

    // Confirm deleted
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/admin/tenants/${tenant.id}`
    });

    assert.strictEqual(checkRes.statusCode, 404);
  });

  it('prevents duplicate prefix registration with 409 Conflict', async () => {
    const payload = {
      name: 'Store Dup',
      prefix: 'DUP1',
      server_key: 'server-dup-key',
      target_url: 'http://localhost:9999/dup'
    };

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/admin/tenants',
      payload
    });
    assert.strictEqual(res1.statusCode, 201);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/admin/tenants',
      payload
    });
    assert.strictEqual(res2.statusCode, 409);
  });

  it('queries and filters audit logs', async () => {
    const tenant = tenantDb.create({
      name: 'Audit Store',
      order_prefix: 'AUDSTORE',
      server_key: 'key',
      target_url: 'http://localhost:9999',
      webhook_secret: 'sec'
    });

    auditService.createLog({
      order_id: 'AUDSTORE-1',
      tenant_id: tenant.id,
      status: 'DISPATCHED',
      payload: '{}'
    });

    auditService.createLog({
      order_id: 'AUDSTORE-2',
      tenant_id: tenant.id,
      status: 'FAILED',
      payload: '{}'
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs'
    });

    assert.strictEqual(listRes.statusCode, 200);
    const body = listRes.json();
    assert.strictEqual(body.total, 2);
    assert.strictEqual(body.logs.length, 2);

    const filterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs?status=DISPATCHED'
    });

    assert.strictEqual(filterRes.statusCode, 200);
    assert.strictEqual(filterRes.json().total, 1);
    assert.strictEqual(filterRes.json().logs[0].status, 'DISPATCHED');
  });

  it('serves static frontend dashboard index.html on root and SPA routes without route collisions', async () => {
    const rootRes = await app.inject({
      method: 'GET',
      url: '/'
    });
    assert.strictEqual(rootRes.statusCode, 200);
    assert.strictEqual(rootRes.headers['content-type']?.includes('text/html'), true);
    assert.ok(rootRes.payload.includes('<html') || rootRes.payload.includes('<!DOCTYPE html>'));

    const spaRes = await app.inject({
      method: 'GET',
      url: '/tenants'
    });
    assert.strictEqual(spaRes.statusCode, 200);
    assert.strictEqual(spaRes.headers['content-type']?.includes('text/html'), true);

    const apiNotFoundRes = await app.inject({
      method: 'GET',
      url: '/api/nonexistent'
    });
    assert.strictEqual(apiNotFoundRes.statusCode, 404);
  });
});
