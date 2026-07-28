import { describe, it, expect } from '../helpers/test-framework.js';
import { calculateMidtransSignature, verifyBridgeSignature } from '../helpers/crypto-utils.js';

export function registerCrossFeatureTests(client, mockTarget) {
  describe('Tier 3: Cross-Feature Combinations & Interaction Testing', () => {

    let tenantA;
    let tenantB;

    it('Setup: Register concurrent tenants', async () => {
      const resA = await client.createTenant({
        name: 'Concurrent Tenant Alpha',
        prefix: 'CONCA',
        server_key: 'SB-Mid-server-conca',
        target_url: `http://localhost:${mockTarget.port}/webhooks/conca`,
        webhook_secret: 'sec_conca'
      });
      tenantA = resA.data;

      const resB = await client.createTenant({
        name: 'Concurrent Tenant Beta',
        prefix: 'CONCB',
        server_key: 'SB-Mid-server-concb',
        target_url: `http://localhost:${mockTarget.port}/webhooks/concb`,
        webhook_secret: 'sec_concb'
      });
      tenantB = resB.data;
    });

    it('TC_T3_COMB_01: Process concurrent multi-tenant webhooks without cross-tenant interference', async () => {
      mockTarget.clearRequests();

      // Prepare 10 requests (5 for CONCA, 5 for CONCB)
      const promises = [];

      for (let i = 1; i <= 5; i++) {
        const orderA = `CONCA-ORD-${i}`;
        const sigA = calculateMidtransSignature(orderA, '200', '10000.00', tenantA.server_key);
        promises.push(client.postWebhook({
          order_id: orderA,
          status_code: '200',
          gross_amount: '10000.00',
          transaction_status: 'settlement',
          signature_key: sigA
        }));

        const orderB = `CONCB-ORD-${i}`;
        const sigB = calculateMidtransSignature(orderB, '200', '20000.00', tenantB.server_key);
        promises.push(client.postWebhook({
          order_id: orderB,
          status_code: '200',
          gross_amount: '20000.00',
          transaction_status: 'settlement',
          signature_key: sigB
        }));
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r.status === 200)).toBeTruthy();

      await new Promise(r => setTimeout(r, 400));

      const reqs = mockTarget.getRequests();
      expect(reqs.length).toBeGreaterThanOrEqual(10);

      // Verify CONCA requests got signed with sec_conca
      const concaReqs = reqs.filter(r => r.url.includes('/webhooks/conca'));
      expect(concaReqs.length).toBe(5);
      for (const r of concaReqs) {
        expect(verifyBridgeSignature(r.rawBody, 'sec_conca', r.signatureHeader)).toBeTruthy();
      }

      // Verify CONCB requests got signed with sec_concb
      const concbReqs = reqs.filter(r => r.url.includes('/webhooks/concb'));
      expect(concbReqs.length).toBe(5);
      for (const r of concbReqs) {
        expect(verifyBridgeSignature(r.rawBody, 'sec_concb', r.signatureHeader)).toBeTruthy();
      }
    });

    it('TC_T3_COMB_02: Manual Retry API (POST /api/admin/audit-logs/:id/retry) triggers re-delivery', async () => {
      // 1. Simulate initial target failure (force 500)
      mockTarget.setResponseCode(500);

      const orderId = 'CONCA-RETRY-101';
      const sig = calculateMidtransSignature(orderId, '200', '50000.00', tenantA.server_key);

      const webhookRes = await client.postWebhook({
        order_id: orderId,
        status_code: '200',
        gross_amount: '50000.00',
        transaction_status: 'settlement',
        signature_key: sig
      });

      const auditId = webhookRes.data.audit_id;
      expect(auditId).toBeTruthy();

      await new Promise(r => setTimeout(r, 200));

      // Check log status is FAILED
      const logResInitial = await client.getAuditLog(auditId);
      expect(logResInitial.data.status).toBe('FAILED');

      // 2. Target website becomes healthy again
      mockTarget.setResponseCode(200);

      // 3. Trigger manual retry API
      const retryRes = await client.retryAuditLog(auditId);
      expect(retryRes.status).toBe(200);

      // 4. Verify log status updated to DISPATCHED
      const logResFinal = await client.getAuditLog(auditId);
      expect(logResFinal.data.status).toBe('DISPATCHED');
      expect(logResFinal.data.response_code).toBe(200);
    });

    it('TC_T3_COMB_03: Secret key rotation updates signature used on target forward', async () => {
      mockTarget.clearRequests();

      // Create tenant ROTATE
      const createRes = await client.createTenant({
        name: 'Rotate Secret Tenant',
        prefix: 'ROT',
        server_key: 'SB-Mid-server-rot',
        target_url: `http://localhost:${mockTarget.port}/webhooks/rot`,
        webhook_secret: 'old_secret_123'
      });
      const tenant = createRes.data;

      // Update tenant secret
      await client.updateTenant(tenant.id, { webhook_secret: 'new_secret_456' });

      // Send webhook
      const orderId = 'ROT-1001';
      const sig = calculateMidtransSignature(orderId, '200', '10000.00', tenant.server_key);
      await client.postWebhook({
        order_id: orderId,
        status_code: '200',
        gross_amount: '10000.00',
        transaction_status: 'settlement',
        signature_key: sig
      });

      await new Promise(r => setTimeout(r, 200));

      const reqs = mockTarget.getRequests();
      const rotReq = reqs.find(r => r.body && r.body.order_id === 'ROT-1001');
      expect(rotReq).toBeDefined();

      // Old secret should fail validation
      expect(verifyBridgeSignature(rotReq.rawBody, 'old_secret_123', rotReq.signatureHeader)).toBeFalsy();

      // New secret must pass validation!
      expect(verifyBridgeSignature(rotReq.rawBody, 'new_secret_456', rotReq.signatureHeader)).toBeTruthy();
    });

  });
}
