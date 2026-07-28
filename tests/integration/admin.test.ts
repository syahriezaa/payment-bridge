import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { buildServer } from '../../src/server.js';
import { tenantDb, getDb, closeDb } from '../../src/db/index.js';
import { auditService } from '../../src/services/audit.js';
import { FastifyInstance } from 'fastify';

describe('Integration: Admin Management & Authentication API', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    closeDb();
    getDb(':memory:');
    app = await buildServer();

    // Perform initial admin setup to get valid Bearer token for protected tests
    const setupRes = await app.inject({
      method: 'POST',
      url: '/api/admin/setup',
      payload: {
        username: 'admin',
        password: 'AdminPassword123!'
      }
    });

    if (setupRes.statusCode === 200) {
      authToken = setupRes.json().token;
    }
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('rejects unauthenticated access to /api/admin/* endpoints with 401 Unauthorized', async () => {
    const unauthTenantsRes = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants'
    });
    assert.strictEqual(unauthTenantsRes.statusCode, 401);
    assert.strictEqual(unauthTenantsRes.json().error, 'Unauthorized');

    const unauthAuditLogsRes = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs'
    });
    assert.strictEqual(unauthAuditLogsRes.statusCode, 401);
    assert.strictEqual(unauthAuditLogsRes.json().error, 'Unauthorized');

    const invalidTokenRes = await app.inject({
      method: 'GET',
      url: '/api/admin/tenants',
      headers: { authorization: 'Bearer invalid.jwt.token' }
    });
    assert.strictEqual(invalidTokenRes.statusCode, 401);
    assert.strictEqual(invalidTokenRes.json().error, 'Unauthorized');
  });

  it('handles admin setup and login flows correctly', async () => {
    // 1. Attempt setup when admin already exists -> returns 400 Bad Request
    const duplicateSetupRes = await app.inject({
      method: 'POST',
      url: '/api/admin/setup',
      payload: {
        username: 'another_admin',
        password: 'Password123!'
      }
    });
    assert.strictEqual(duplicateSetupRes.statusCode, 400);

    // 2. Login with valid credentials -> returns 200 OK with token and user details
    const validLoginRes = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: {
        username: 'admin',
        password: 'AdminPassword123!'
      }
    });
    assert.strictEqual(validLoginRes.statusCode, 200);
    const loginBody = validLoginRes.json();
    assert.ok(loginBody.token);
    assert.strictEqual(loginBody.user.username, 'admin');

    // 3. Login with invalid password -> returns 401 Unauthorized
    const wrongPasswordRes = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: {
        username: 'admin',
        password: 'WrongPassword'
      }
    });
    assert.strictEqual(wrongPasswordRes.statusCode, 401);
    assert.strictEqual(wrongPasswordRes.json().error, 'Invalid credentials');
  });

  it('handles tenant CRUD operations with valid Bearer token', async () => {
    // 1. Create tenant
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/tenants',
      headers: { authorization: `Bearer ${authToken}` },
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
      url: '/api/admin/tenants',
      headers: { authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(listRes.statusCode, 200);
    const tenants = listRes.json();
    assert.strictEqual(Array.isArray(tenants), true);
    assert.strictEqual(tenants.length, 1);

    // 3. Get tenant by ID
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/admin/tenants/${tenant.id}`,
      headers: { authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.json().id, tenant.id);

    // 4. Update tenant
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/admin/tenants/${tenant.id}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        target_url: 'http://localhost:9999/alpha-new'
      }
    });

    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.json().target_url, 'http://localhost:9999/alpha-new');

    // 5. Delete tenant
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/tenants/${tenant.id}`,
      headers: { authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(deleteRes.statusCode, 200);

    // Confirm deleted
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/admin/tenants/${tenant.id}`,
      headers: { authorization: `Bearer ${authToken}` }
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
      headers: { authorization: `Bearer ${authToken}` },
      payload
    });
    assert.strictEqual(res1.statusCode, 201);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/admin/tenants',
      headers: { authorization: `Bearer ${authToken}` },
      payload
    });
    assert.strictEqual(res2.statusCode, 409);
  });

  it('queries and filters audit logs with valid Bearer token', async () => {
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
      url: '/api/admin/audit-logs',
      headers: { authorization: `Bearer ${authToken}` }
    });

    assert.strictEqual(listRes.statusCode, 200);
    const body = listRes.json();
    assert.strictEqual(body.total, 2);
    assert.strictEqual(body.logs.length, 2);

    const filterRes = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs?status=DISPATCHED',
      headers: { authorization: `Bearer ${authToken}` }
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
