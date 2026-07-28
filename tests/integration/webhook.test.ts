import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { buildServer } from '../../src/server.js';
import { tenantDb, getDb, closeDb } from '../../src/db/index.js';
import { calculateMidtransSignature } from '../../src/services/signature.js';
import { FastifyInstance } from 'fastify';

describe('Integration: Webhook Ingress API (POST /api/webhooks/midtrans)', () => {
  let app: FastifyInstance;
  const SERVER_KEY = 'SB-Mid-server-int-test';

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    closeDb();
    getDb(':memory:');

    app = await buildServer();

    // Create test tenant
    tenantDb.create({
      name: 'Integration Tenant A',
      order_prefix: 'INTA',
      server_key: SERVER_KEY,
      target_url: 'http://localhost:9999/webhook/inta',
      webhook_secret: 'sec_inta'
    });
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('accepts valid Midtrans notification and returns 200 OK with audit_id', async () => {
    const orderId = 'INTA-1001';
    const statusCode = '200';
    const grossAmount = '150000.00';
    const sig = calculateMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY);

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      transaction_status: 'settlement',
      signature_key: sig
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/midtrans',
      headers: { 'content-type': 'application/json' },
      payload
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.status, 'received');
    assert.ok(body.audit_id);
  });

  it('rejects notification with invalid signature (401 Unauthorized)', async () => {
    const orderId = 'INTA-1002';
    const payload = {
      order_id: orderId,
      status_code: '200',
      gross_amount: '100000.00',
      transaction_status: 'settlement',
      signature_key: 'invalid-signature-key'
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/midtrans',
      headers: { 'content-type': 'application/json' },
      payload
    });

    assert.strictEqual(res.statusCode, 401);
    const body = res.json();
    assert.strictEqual(body.error, 'Invalid Midtrans signature key');
    assert.ok(body.audit_id);
  });

  it('rejects notification with unmapped order prefix (400 Bad Request)', async () => {
    const payload = {
      order_id: 'UNKNOWN-9999',
      status_code: '200',
      gross_amount: '50000.00',
      transaction_status: 'settlement',
      signature_key: 'some-key'
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/midtrans',
      headers: { 'content-type': 'application/json' },
      payload
    });

    assert.strictEqual(res.statusCode, 400);
    const body = res.json();
    assert.strictEqual(body.error, 'Unmapped Order ID prefix');
    assert.ok(body.audit_id);
  });
});
