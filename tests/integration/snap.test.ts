import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { buildServer } from '../../src/server.js';
import { tenantDb, getDb, closeDb } from '../../src/db/index.js';
import { FastifyInstance } from 'fastify';

describe('Integration: Snap Payment Proxy API (POST /api/v1/snap/token)', () => {
  let app: FastifyInstance;
  let mockSnapServer: http.Server;
  let mockPort = 9877;
  let receivedSnapPayload: any = null;

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    closeDb();
    getDb(':memory:');
    receivedSnapPayload = null;

    // Start mock Midtrans Snap server
    await new Promise<void>((resolve) => {
      mockSnapServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          receivedSnapPayload = JSON.parse(body);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            token: 'snap-token-mock-12345',
            redirect_url: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-mock-12345'
          }));
        });
      });
      mockSnapServer.listen(mockPort, () => resolve());
    });

    process.env.MIDTRANS_SNAP_URL = `http://localhost:${mockPort}/snap/v1/transactions`;
    app = await buildServer();
  });

  afterEach(async () => {
    if (app) await app.close();
    if (mockSnapServer) {
      await new Promise<void>((resolve) => mockSnapServer.close(() => resolve()));
    }
  });

  it('prepends tenant prefix to order_id and proxies request to Midtrans Snap API', async () => {
    const tenant = tenantDb.create({
      name: 'Snap Proxy Tenant',
      order_prefix: 'SNAPA',
      server_key: 'SB-Mid-server-snapa',
      target_url: 'http://localhost:9999/snap',
      webhook_secret: 'sec'
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/snap/token',
      headers: {
        'authorization': `Bearer ${tenant.api_key}`,
        'content-type': 'application/json'
      },
      payload: {
        order_id: '1001',
        gross_amount: 150000,
        customer_details: {
          first_name: 'John',
          email: 'john@example.com'
        }
      }
    });

    assert.strictEqual(res.statusCode, 201);
    const body = res.json();
    assert.strictEqual(body.token, 'snap-token-mock-12345');
    assert.ok(body.redirect_url);

    assert.ok(receivedSnapPayload);
    assert.strictEqual(receivedSnapPayload.order_id, 'SNAPA-1001');
    assert.strictEqual(receivedSnapPayload.gross_amount, 150000);
    assert.strictEqual(receivedSnapPayload.customer_details.first_name, 'John');
  });

  it('rejects request with invalid API key (401 Unauthorized)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/snap/token',
      headers: {
        'authorization': 'Bearer invalid-api-key',
        'content-type': 'application/json'
      },
      payload: {
        order_id: '1001',
        gross_amount: 150000
      }
    });

    assert.strictEqual(res.statusCode, 401);
  });
});
