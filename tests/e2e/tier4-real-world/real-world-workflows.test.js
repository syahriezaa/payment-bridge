import { describe, it, expect } from '../helpers/test-framework.js';
import { calculateMidtransSignature, verifyBridgeSignature } from '../helpers/crypto-utils.js';

export function registerRealWorldWorkflowTests(client, mockTarget, mockMidtrans) {
  describe('Tier 4: Real-World End-to-End Application Workflows', () => {

    it('T4_E2E_01: Complete Happy-Path E2E Workflow (Tenant Setup -> Snap Token -> Webhook Settlement -> Target Forwarding -> Audit Log)', async () => {
      mockTarget.clearRequests();
      mockMidtrans.clearRequests();

      // Step 1: Register Tenant STOREA via Admin API
      const tenantConfig = {
        name: 'Store A Fashion E-Commerce',
        prefix: 'STOREA',
        server_key: 'SB-Mid-server-storea-production-key',
        target_url: `http://localhost:${mockTarget.port}/webhooks/storea`,
        webhook_secret: 'storea_shared_webhook_secret_999'
      };

      const tenantRes = await client.createTenant(tenantConfig);
      expect(tenantRes.status === 201 || tenantRes.status === 200).toBeTruthy();
      const tenant = tenantRes.data;
      expect(tenant.api_key).toBeTruthy();

      // Step 2: E-Commerce Store requests Snap Token from Proxy
      const snapRes = await client.createSnapToken(tenant.api_key, {
        order_id: 'ORD-7890',
        gross_amount: 250000,
        customer_details: { first_name: 'Alice', email: 'alice@storea.com' }
      });
      expect(snapRes.status === 200 || snapRes.status === 201).toBeTruthy();
      expect(snapRes.data.token).toBeTruthy();

      // Verify prepended order ID received by Midtrans
      const snapReqs = mockMidtrans.getSnapRequests();
      const lastSnap = snapReqs[snapReqs.length - 1];
      expect(lastSnap.body.order_id).toBe('STOREA-ORD-7890');

      // Step 3: Midtrans sends webhook notification for STOREA-ORD-7890
      const orderId = 'STOREA-ORD-7890';
      const statusCode = '200';
      const grossAmount = '250000.00';
      const signatureKey = calculateMidtransSignature(orderId, statusCode, grossAmount, tenant.server_key);

      const webhookPayload = {
        transaction_time: '2026-07-28 18:30:00',
        transaction_status: 'settlement',
        transaction_id: 'midtrans-tx-998877',
        status_message: 'midtrans payment settlement',
        status_code: statusCode,
        signature_key: signatureKey,
        payment_type: 'credit_card',
        order_id: orderId,
        gross_amount: grossAmount,
        currency: 'IDR'
      };

      const startMs = Date.now();
      const webhookRes = await client.postWebhook(webhookPayload);
      const ackDuration = Date.now() - startMs;

      // Step 4 & 5: Immediate 200 OK acknowledgment to Midtrans
      expect(webhookRes.status).toBe(200);
      expect(webhookRes.data.status).toBe('received');
      expect(webhookRes.data.audit_id).toBeTruthy();
      expect(ackDuration).toBeLessThan(1000); // Immediate non-blocking response

      const auditId = webhookRes.data.audit_id;

      // Wait for async dispatch worker
      await new Promise(r => setTimeout(r, 250));

      // Step 6: Target Website received forwarded webhook
      const targetReqs = mockTarget.getRequests();
      const storeaTargetReq = targetReqs.find(r => r.body && r.body.order_id === 'STOREA-ORD-7890');
      expect(storeaTargetReq).toBeDefined();

      // Verify HMAC-SHA256 signature
      const validHmac = verifyBridgeSignature(storeaTargetReq.rawBody, tenant.webhook_secret, storeaTargetReq.signatureHeader);
      expect(validHmac).toBeTruthy();

      // Step 7: Audit Log Confirmation
      const logRes = await client.getAuditLog(auditId);
      expect(logRes.status).toBe(200);
      expect(logRes.data.status).toBe('DISPATCHED');
      expect(logRes.data.response_code).toBe(200);
      expect(logRes.data.tenant_id).toBe(tenant.id);
    });

    it('T4_E2E_02: Target Downtime & Manual Recovery E2E Workflow', async () => {
      mockTarget.clearRequests();

      // 1. Setup Tenant STOREB
      const tenantRes = await client.createTenant({
        name: 'Store B Electronics',
        prefix: 'STOREB',
        server_key: 'SB-Mid-server-storeb-key',
        target_url: `http://localhost:${mockTarget.port}/webhooks/storeb`,
        webhook_secret: 'storeb_secret_111'
      });
      const tenant = tenantRes.data;

      // 2. Simulate Target Website Offline (returns 500)
      mockTarget.setResponseCode(500);

      const orderId = 'STOREB-FAIL-5555';
      const sig = calculateMidtransSignature(orderId, '200', '150000.00', tenant.server_key);

      // 3. Webhook arrives -> Bridge returns 200 OK to Midtrans, records failure
      const webhookRes = await client.postWebhook({
        order_id: orderId,
        status_code: '200',
        gross_amount: '150000.00',
        transaction_status: 'settlement',
        signature_key: sig
      });

      expect(webhookRes.status).toBe(200);
      const auditId = webhookRes.data.audit_id;

      await new Promise(r => setTimeout(r, 250));

      const initialLog = await client.getAuditLog(auditId);
      expect(initialLog.data.status).toBe('FAILED');
      expect(initialLog.data.response_code).toBe(500);

      // 4. Target website comes back online (returns 200 OK)
      mockTarget.setResponseCode(200);

      // 5. Admin triggers Manual Retry API
      const retryRes = await client.retryAuditLog(auditId);
      expect(retryRes.status).toBe(200);

      await new Promise(r => setTimeout(r, 250));

      // 6. Audit Log updated to DISPATCHED
      const updatedLog = await client.getAuditLog(auditId);
      expect(updatedLog.data.status).toBe('DISPATCHED');
      expect(updatedLog.data.response_code).toBe(200);
    });

    it('T4_E2E_03: Multi-Tenant Interleaved Traffic & Security Isolation Workflow', async () => {
      mockTarget.clearRequests();

      // Setup 2 Tenants: ISOLATEA and ISOLATEB
      const resA = await client.createTenant({
        name: 'Isolate Store A',
        prefix: 'ISOLATEA',
        server_key: 'SB-Mid-server-iso-a',
        target_url: `http://localhost:${mockTarget.port}/webhooks/iso-a`,
        webhook_secret: 'sec_iso_a'
      });
      const tenantA = resA.data;

      const resB = await client.createTenant({
        name: 'Isolate Store B',
        prefix: 'ISOLATEB',
        server_key: 'SB-Mid-server-iso-b',
        target_url: `http://localhost:${mockTarget.port}/webhooks/iso-b`,
        webhook_secret: 'sec_iso_b'
      });
      const tenantB = resB.data;

      // Send 10 interleaved webhooks (5 for A, 5 for B)
      for (let i = 1; i <= 5; i++) {
        const orderA = `ISOLATEA-ORD-${i}`;
        const sigA = calculateMidtransSignature(orderA, '200', '10000.00', tenantA.server_key);
        await client.postWebhook({
          order_id: orderA,
          status_code: '200',
          gross_amount: '10000.00',
          transaction_status: 'settlement',
          signature_key: sigA
        });

        const orderB = `ISOLATEB-ORD-${i}`;
        const sigB = calculateMidtransSignature(orderB, '200', '20000.00', tenantB.server_key);
        await client.postWebhook({
          order_id: orderB,
          status_code: '200',
          gross_amount: '20000.00',
          transaction_status: 'settlement',
          signature_key: sigB
        });
      }

      await new Promise(r => setTimeout(r, 400));

      // Verify Target A received ONLY ISOLATEA webhooks, verified with sec_iso_a
      const reqs = mockTarget.getRequests();
      const targetAReqs = reqs.filter(r => r.url.includes('/webhooks/iso-a'));
      expect(targetAReqs.length).toBe(5);
      for (const req of targetAReqs) {
        expect(req.body.order_id).toStartWith('ISOLATEA-');
        expect(verifyBridgeSignature(req.rawBody, 'sec_iso_a', req.signatureHeader)).toBeTruthy();
      }

      // Verify Target B received ONLY ISOLATEB webhooks, verified with sec_iso_b
      const targetBReqs = reqs.filter(r => r.url.includes('/webhooks/iso-b'));
      expect(targetBReqs.length).toBe(5);
      for (const req of targetBReqs) {
        expect(req.body.order_id).toStartWith('ISOLATEB-');
        expect(verifyBridgeSignature(req.rawBody, 'sec_iso_b', req.signatureHeader)).toBeTruthy();
      }

      // Audit log isolation query
      const auditResA = await client.getAuditLogs({ tenant_id: tenantA.id });
      expect(auditResA.data.logs.length).toBe(5);
      expect(auditResA.data.logs.every(l => l.tenant_id === tenantA.id)).toBeTruthy();
    });

    it('T4_E2E_04: Snap Token Generation to Webhook Settlement End-to-End Audit Trail', async () => {
      mockMidtrans.clearRequests();

      // Create Tenant AUDITTRAIL
      const tenantRes = await client.createTenant({
        name: 'Audit Trail Store',
        prefix: 'TRAIL',
        server_key: 'SB-Mid-server-trail-key',
        target_url: `http://localhost:${mockTarget.port}/webhooks/trail`,
        webhook_secret: 'trail_secret'
      });
      const tenant = tenantRes.data;

      // 1. Request Snap Token
      const snapRes = await client.createSnapToken(tenant.api_key, {
        order_id: 'INV-9900',
        gross_amount: 99000
      });
      expect(snapRes.status === 200 || snapRes.status === 201).toBeTruthy();

      // 2. Settlement Webhook notification for TRAIL-INV-9900
      const orderId = 'TRAIL-INV-9900';
      const sig = calculateMidtransSignature(orderId, '200', '99000.00', tenant.server_key);
      const webhookRes = await client.postWebhook({
        order_id: orderId,
        status_code: '200',
        gross_amount: '99000.00',
        transaction_status: 'settlement',
        signature_key: sig
      });

      const auditId = webhookRes.data.audit_id;
      await new Promise(r => setTimeout(r, 200));

      // 3. Confirm Audit Trail consistency
      const logRes = await client.getAuditLog(auditId);
      expect(logRes.data.order_id).toBe('TRAIL-INV-9900');
      expect(logRes.data.tenant_id).toBe(tenant.id);
      expect(logRes.data.status).toBe('DISPATCHED');
    });

  });
}
