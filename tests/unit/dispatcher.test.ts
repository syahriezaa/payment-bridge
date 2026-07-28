import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { tenantDb, getDb, closeDb } from '../../src/db/index.js';
import { auditService } from '../../src/services/audit.js';
import { processDispatch, retryDispatchManually } from '../../src/services/dispatcher.js';

describe('Unit: Queue Dispatcher & Exponential Backoff Retries', () => {
  let mockServer: http.Server;
  let serverPort = 9876;
  let receivedRequests: any[] = [];
  let serverResponseCode = 200;

  beforeEach(() => {
    // Set in-memory db
    process.env.DATABASE_PATH = ':memory:';
    closeDb();
    getDb(':memory:');
    receivedRequests = [];
    serverResponseCode = 200;
  });

  afterEach(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });

  function startMockServer(port: number): Promise<void> {
    return new Promise((resolve) => {
      mockServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          receivedRequests.push({
            url: req.url,
            headers: req.headers,
            body
          });
          res.writeHead(serverResponseCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        });
      });
      mockServer.listen(port, () => resolve());
    });
  }

  it('dispatches webhook payload successfully to target server', async () => {
    await startMockServer(serverPort);

    const tenant = tenantDb.create({
      name: 'Dispatch Test Tenant',
      order_prefix: 'DISPATCH',
      server_key: 'server-key',
      target_url: `http://localhost:${serverPort}/webhook`,
      webhook_secret: 'sec-secret'
    });

    const log = auditService.createLog({
      order_id: 'DISPATCH-101',
      tenant_id: tenant.id,
      target_url: tenant.target_url,
      status: 'PENDING',
      payload: JSON.stringify({ order_id: 'DISPATCH-101' })
    });

    const success = await processDispatch(log.id, { maxRetries: 1, timeoutMs: 1000 });
    assert.strictEqual(success, true);

    const updatedLog = auditService.getLogById(log.id);
    assert.strictEqual(updatedLog?.status, 'DISPATCHED');
    assert.strictEqual(updatedLog?.last_http_status, 200);
    assert.strictEqual(updatedLog?.attempt_count, 1);
    assert.strictEqual(receivedRequests.length, 1);
  });

  it('retries with exponential backoff on server failure', async () => {
    await startMockServer(serverPort + 1);
    serverResponseCode = 500;

    const tenant = tenantDb.create({
      name: 'Retry Test Tenant',
      order_prefix: 'RETRY',
      server_key: 'server-key',
      target_url: `http://localhost:${serverPort + 1}/webhook`,
      webhook_secret: 'sec-secret'
    });

    const log = auditService.createLog({
      order_id: 'RETRY-101',
      tenant_id: tenant.id,
      target_url: tenant.target_url,
      status: 'PENDING',
      payload: JSON.stringify({ order_id: 'RETRY-101' })
    });

    // Test with 3 retries with 5ms delays
    const success = await processDispatch(log.id, {
      maxRetries: 3,
      retryDelaysMs: [5, 10, 15],
      timeoutMs: 1000
    });

    assert.strictEqual(success, false);

    const updatedLog = auditService.getLogById(log.id);
    assert.strictEqual(updatedLog?.status, 'FAILED');
    assert.strictEqual(updatedLog?.attempt_count, 3);
    assert.strictEqual(receivedRequests.length, 3);
  });

  it('supports manual retry trigger for failed audit log', async () => {
    await startMockServer(serverPort + 2);
    serverResponseCode = 200;

    const tenant = tenantDb.create({
      name: 'Manual Retry Tenant',
      order_prefix: 'MANUAL',
      server_key: 'server-key',
      target_url: `http://localhost:${serverPort + 2}/webhook`,
      webhook_secret: 'sec-secret'
    });

    const log = auditService.createLog({
      order_id: 'MANUAL-101',
      tenant_id: tenant.id,
      target_url: tenant.target_url,
      status: 'FAILED',
      payload: JSON.stringify({ order_id: 'MANUAL-101' })
    });

    const res = await retryDispatchManually(log.id);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.log.status, 'DISPATCHED');
    assert.strictEqual(res.log.attempt_count, 1);
  });
});
