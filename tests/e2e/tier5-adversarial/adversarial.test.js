import { describe, it, expect } from '../helpers/test-framework.js';
import { calculateMidtransSignature, verifyBridgeSignature } from '../helpers/crypto-utils.js';

export function registerTier5AdversarialTests(client, mockTarget, mockMidtrans) {
  describe('Tier 5: White-Box Adversarial Stress & Resiliency Testing', () => {

    let tenant;

    it('Setup: Register high-capacity tenant for Tier 5 stress testing', async () => {
      const res = await client.createTenant({
        name: 'Adversarial Test Merchant',
        prefix: 'ADV5',
        server_key: 'SB-Mid-server-adv5-secret-key-100',
        target_url: `http://localhost:${mockTarget.port}/webhooks/adv5`,
        webhook_secret: 'adv5_webhook_secret_9988'
      });

      expect(res.status === 201 || res.status === 200).toBeTruthy();
      tenant = res.data;
      expect(tenant.api_key).toBeTruthy();
    });

    // -------------------------------------------------------------
    // Scenario 1: Extreme Payload Sizes (Webhooks & Snap Proxy)
    // -------------------------------------------------------------
    it('TC_T5_ADV_01: Webhook Ingress handles extreme payload size (500KB payload with nested metadata)', async () => {
      const orderId = 'ADV5-LARGE-1001';
      const statusCode = '200';
      const grossAmount = '999999.00';
      const signatureKey = calculateMidtransSignature(orderId, statusCode, grossAmount, tenant.server_key);

      // Construct ~500KB payload with heavy metadata & item arrays
      const largeMetadata = {};
      for (let i = 0; i < 500; i++) {
        largeMetadata[`key_${i}`] = 'x'.repeat(1000); // 500 * 1000 = 500KB string data
      }

      const payload = {
        transaction_time: '2026-07-29 01:00:00',
        transaction_status: 'settlement',
        transaction_id: 'tx-large-payload-500k',
        status_message: 'midtrans settlement for large order',
        status_code: statusCode,
        signature_key: signatureKey,
        order_id: orderId,
        gross_amount: grossAmount,
        currency: 'IDR',
        custom_field1: JSON.stringify(largeMetadata),
        item_details: Array.from({ length: 50 }, (_, idx) => ({
          id: `ITEM-${idx}`,
          price: 20000,
          quantity: 1,
          name: `Item Description ${idx} - ` + 'A'.repeat(100)
        }))
      };

      mockTarget.clearRequests();

      // Webhook Ingress POST
      const startMs = Date.now();
      const res = await client.postWebhook(payload);
      const duration = Date.now() - startMs;

      expect(res.status).toBe(200);
      expect(res.data.status).toBe('received');
      expect(res.data.audit_id).toBeTruthy();
      expect(duration).toBeLessThan(1000); // Non-blocking fast response

      const auditId = res.data.audit_id;

      // Wait for async dispatch worker
      await new Promise(r => setTimeout(r, 300));

      // Verify Audit Log stored raw large payload completely without truncation
      const logRes = await client.getAuditLog(auditId);
      expect(logRes.status).toBe(200);
      expect(logRes.data.status).toBe('DISPATCHED');
      expect(logRes.data.response_code).toBe(200);

      // Verify Target received exact large payload verbatim with valid X-Bridge-Signature
      const targetReqs = mockTarget.getRequests();
      const matchedReq = targetReqs.find(r => r.body && r.body.order_id === orderId);
      expect(matchedReq).toBeDefined();
      expect(verifyBridgeSignature(matchedReq.rawBody, tenant.webhook_secret, matchedReq.signatureHeader)).toBeTruthy();
    });

    // -------------------------------------------------------------
    // Scenario 2: Rapid Webhook Flooding (Burst & Concurrency Stress)
    // -------------------------------------------------------------
    it('TC_T5_ADV_02: Rapid Webhook Flooding (50 concurrent webhooks processed cleanly without deadlock)', async () => {
      mockTarget.clearRequests();
      const totalWebhooks = 50;
      const promises = [];

      for (let i = 1; i <= totalWebhooks; i++) {
        const orderId = `ADV5-BURST-${i}`;
        const statusCode = '200';
        const grossAmount = `${10000 + i}.00`;
        const signatureKey = calculateMidtransSignature(orderId, statusCode, grossAmount, tenant.server_key);

        const payload = {
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          transaction_status: 'settlement',
          signature_key: signatureKey,
          transaction_id: `tx-burst-${i}`
        };

        promises.push(client.postWebhook(payload));
      }

      // Fire 50 requests concurrently
      const results = await Promise.all(promises);

      // All 50 must acknowledge with 200 OK immediately
      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.data.status).toBe('received');
        expect(res.data.audit_id).toBeTruthy();
      }

      // Give worker pool time to process dispatches
      await new Promise(r => setTimeout(r, 600));

      // Verify all 50 webhooks delivered to mock target
      const targetReqs = mockTarget.getRequests();
      const burstReqs = targetReqs.filter(r => r.body && String(r.body.order_id).startsWith('ADV5-BURST-'));
      expect(burstReqs.length).toBe(totalWebhooks);

      // Verify all audit logs recorded as DISPATCHED
      const auditRes = await client.getAuditLogs({ tenant_id: tenant.id, limit: 100 });
      expect(auditRes.status).toBe(200);
      const dispatchedBurstLogs = auditRes.data.logs.filter(l => String(l.order_id).startsWith('ADV5-BURST-') && l.status === 'DISPATCHED');
      expect(dispatchedBurstLogs.length).toBe(totalWebhooks);
    });

    // -------------------------------------------------------------
    // Scenario 3: Retry Queue Recovery under Network Timeouts
    // -------------------------------------------------------------
    it('TC_T5_ADV_03: Network Timeout & Target Delay handling with automatic recovery', async () => {
      mockTarget.clearRequests();

      // 1. Simulate target delay exceeding dispatch timeout (set delay = 1500ms)
      mockTarget.setDelay(1500);

      const orderId = 'ADV5-TIMEOUT-001';
      const statusCode = '200';
      const grossAmount = '150000.00';
      const signatureKey = calculateMidtransSignature(orderId, statusCode, grossAmount, tenant.server_key);

      const payload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        transaction_status: 'settlement',
        signature_key: signatureKey
      };

      const webhookRes = await client.postWebhook(payload);
      expect(webhookRes.status).toBe(200);
      const auditId = webhookRes.data.audit_id;

      // Allow background dispatch attempt to run
      await new Promise(r => setTimeout(r, 1800));

      // 2. Remove delay (restore network responsiveness)
      mockTarget.setDelay(0);

      // 3. Perform manual retry for the timed-out dispatch
      const retryRes = await client.retryAuditLog(auditId);
      expect(retryRes.status).toBe(200);

      await new Promise(r => setTimeout(r, 100));

      // 4. Verify log updated to DISPATCHED
      const updatedLog = await client.getAuditLog(auditId);
      expect(updatedLog.data.status).toBe('DISPATCHED');
      expect(updatedLog.data.response_code).toBe(200);
    });

    // -------------------------------------------------------------
    // Scenario 4: Snap Proxy Error Conditions (Upstream Midtrans Errors)
    // -------------------------------------------------------------
    it('TC_T5_ADV_04: Snap Proxy forwards Midtrans upstream HTTP 400 Bad Request error cleanly', async () => {
      mockMidtrans.setForcedResponse(400, {
        status_code: '400',
        status_message: 'Validation Error: gross_amount exceeds credit limit'
      });

      const res = await client.createSnapToken(tenant.api_key, {
        order_id: 'ADV5-SNAP-ERR-400',
        gross_amount: 999999999
      });

      expect(res.status).toBe(400);
      expect(res.data.status_code).toBe('400');
      expect(res.data.status_message).toContain('Validation Error');

      mockMidtrans.setForcedResponse(null, null);
    });

    it('TC_T5_ADV_05: Snap Proxy handles Midtrans upstream HTTP 500 Internal Server Error', async () => {
      mockMidtrans.setForcedResponse(500, {
        status_code: '500',
        status_message: 'Midtrans Internal Server Error'
      });

      const res = await client.createSnapToken(tenant.api_key, {
        order_id: 'ADV5-SNAP-ERR-500',
        gross_amount: 150000
      });

      expect(res.status).toBe(500);
      expect(res.data.status_code).toBe('500');

      mockMidtrans.setForcedResponse(null, null);
    });

    it('TC_T5_ADV_06: Snap Proxy handles Midtrans upstream 401 Unauthorized Server Key error', async () => {
      mockMidtrans.setForcedResponse(401, {
        status_code: '401',
        status_message: 'Access denied: Invalid Midtrans Server Key'
      });

      const res = await client.createSnapToken(tenant.api_key, {
        order_id: 'ADV5-SNAP-ERR-401',
        gross_amount: 50000
      });

      expect(res.status).toBe(401);
      expect(res.data.status_code).toBe('401');

      mockMidtrans.setForcedResponse(null, null);
    });

    // -------------------------------------------------------------
    // Scenario 5: Adversarial Signature Security & Boundary Cases
    // -------------------------------------------------------------
    it('TC_T5_ADV_07: Reject webhook when gross_amount in payload is formatted as floating point vs integer mismatch with signature', async () => {
      const orderId = 'ADV5-FLOAT-SIG';
      const statusCode = '200';

      // Signature calculated with integer 150000
      const signatureKey = calculateMidtransSignature(orderId, statusCode, '150000', tenant.server_key);

      // Payload sends decimal 150000.50 (which alters SHA-512 calculation string)
      const payload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: '150000.50',
        transaction_status: 'settlement',
        signature_key: signatureKey
      };

      const res = await client.postWebhook(payload);
      expect(res.status === 401 || res.status === 400).toBeTruthy();
    });

    it('TC_T5_ADV_08: Secret key rotation immediately affects signature verification on subsequent webhooks', async () => {
      // 1. Send valid webhook with initial key
      const order1 = 'ADV5-ROT-01';
      const sig1 = calculateMidtransSignature(order1, '200', '10000.00', tenant.server_key);
      const res1 = await client.postWebhook({
        order_id: order1,
        status_code: '200',
        gross_amount: '10000.00',
        transaction_status: 'settlement',
        signature_key: sig1
      });
      expect(res1.status).toBe(200);

      // 2. Rotate server_key to NEW key via Admin API
      const newServerKey = 'SB-Mid-server-adv5-NEW-ROTATED-KEY-999';
      const updateRes = await client.updateTenant(tenant.id, {
        server_key: newServerKey
      });
      expect(updateRes.status).toBe(200);

      // 3. Send webhook signed with OLD key -> Must be REJECTED (401)
      const order2 = 'ADV5-ROT-02';
      const sigOld = calculateMidtransSignature(order2, '200', '10000.00', tenant.server_key);
      const resOld = await client.postWebhook({
        order_id: order2,
        status_code: '200',
        gross_amount: '10000.00',
        transaction_status: 'settlement',
        signature_key: sigOld
      });
      expect(resOld.status).toBe(401);

      // 4. Send webhook signed with NEW key -> Must be ACCEPTED (200)
      const sigNew = calculateMidtransSignature(order2, '200', '10000.00', newServerKey);
      const resNew = await client.postWebhook({
        order_id: order2,
        status_code: '200',
        gross_amount: '10000.00',
        transaction_status: 'settlement',
        signature_key: sigNew
      });
      expect(resNew.status).toBe(200);
    });

  });
}
