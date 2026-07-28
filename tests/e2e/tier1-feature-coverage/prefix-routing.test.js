import { describe, it, expect } from '../helpers/test-framework.js';
import { calculateMidtransSignature, verifyBridgeSignature } from '../helpers/crypto-utils.js';

export function registerPrefixRoutingTests(client, mockTarget) {
  describe('Tier 1: Prefix Routing & Async Forwarding with X-Bridge-Signature', () => {

    const ROUTEA_KEY = 'SB-Mid-server-routea-routing';
    const ROUTEB_KEY = 'SB-Mid-server-routeb-routing';
    const ROUTEA_SECRET = 'secret_routea_hmac_123';
    const ROUTEB_SECRET = 'secret_routeb_hmac_456';

    it('Setup: Register tenants ROUTEA and ROUTEB targeting MockTargetServer', async () => {
      await client.createTenant({
        name: 'Route A Store',
        prefix: 'ROUTEA',
        server_key: ROUTEA_KEY,
        target_url: `http://localhost:${mockTarget.port}/webhooks/routea`,
        webhook_secret: ROUTEA_SECRET
      });

      await client.createTenant({
        name: 'Route B Store',
        prefix: 'ROUTEB',
        server_key: ROUTEB_KEY,
        target_url: `http://localhost:${mockTarget.port}/webhooks/routeb`,
        webhook_secret: ROUTEB_SECRET
      });
    });

    it('TC_T1_ROUTE_01: Webhook with ROUTEA-1001 is routed to Website A endpoint', async () => {
      mockTarget.clearRequests();

      const orderId = 'ROUTEA-1001';
      const sig = calculateMidtransSignature(orderId, '200', '100000.00', ROUTEA_KEY);

      const payload = {
        order_id: orderId,
        status_code: '200',
        gross_amount: '100000.00',
        transaction_status: 'settlement',
        signature_key: sig
      };

      const res = await client.postWebhook(payload);
      expect(res.status).toBe(200);

      // Wait for async dispatch
      await new Promise(r => setTimeout(r, 200));

      const reqs = mockTarget.getRequests();
      expect(reqs.length).toBeGreaterThanOrEqual(1);
      const routeaReq = reqs.find(r => r.url.includes('/webhooks/routea'));
      expect(routeaReq).toBeDefined();
      expect(routeaReq.body.order_id).toBe('ROUTEA-1001');
    });

    it('TC_T1_ROUTE_02: Webhook with ROUTEB-5541 is routed to Website B endpoint', async () => {
      mockTarget.clearRequests();

      const orderId = 'ROUTEB-5541';
      const sig = calculateMidtransSignature(orderId, '200', '250000.00', ROUTEB_KEY);

      const payload = {
        order_id: orderId,
        status_code: '200',
        gross_amount: '250000.00',
        transaction_status: 'settlement',
        signature_key: sig
      };

      const res = await client.postWebhook(payload);
      expect(res.status).toBe(200);

      await new Promise(r => setTimeout(r, 200));

      const reqs = mockTarget.getRequests();
      const routebReq = reqs.find(r => r.url.includes('/webhooks/routeb'));
      expect(routebReq).toBeDefined();
      expect(routebReq.body.order_id).toBe('ROUTEB-5541');
    });

    it('TC_T1_ROUTE_03: Routing accepts underscore delimiter (ROUTEA_9999)', async () => {
      mockTarget.clearRequests();

      const orderId = 'ROUTEA_9999';
      const sig = calculateMidtransSignature(orderId, '200', '50000.00', ROUTEA_KEY);

      const payload = {
        order_id: orderId,
        status_code: '200',
        gross_amount: '50000.00',
        transaction_status: 'settlement',
        signature_key: sig
      };

      const res = await client.postWebhook(payload);
      expect(res.status).toBe(200);

      await new Promise(r => setTimeout(r, 200));

      const reqs = mockTarget.getRequests();
      const routeaReq = reqs.find(r => r.body && r.body.order_id === 'ROUTEA_9999');
      expect(routeaReq).toBeDefined();
    });

    it('TC_T1_ROUTE_04: Forwarded request contains valid X-Bridge-Signature HMAC-SHA256 header', async () => {
      mockTarget.clearRequests();

      const orderId = 'ROUTEA-7777';
      const sig = calculateMidtransSignature(orderId, '200', '75000.00', ROUTEA_KEY);

      const payload = {
        order_id: orderId,
        status_code: '200',
        gross_amount: '75000.00',
        transaction_status: 'settlement',
        signature_key: sig,
        item_details: [{ id: 'item-1', name: 'Widget', price: 75000, quantity: 1 }]
      };

      await client.postWebhook(payload);
      await new Promise(r => setTimeout(r, 200));

      const reqs = mockTarget.getRequests();
      const targetReq = reqs.find(r => r.body && r.body.order_id === 'ROUTEA-7777');
      expect(targetReq).toBeDefined();
      expect(targetReq.signatureHeader).toBeTruthy();

      const isValidHmac = verifyBridgeSignature(targetReq.rawBody, ROUTEA_SECRET, targetReq.signatureHeader);
      expect(isValidHmac).toBeTruthy();
    });

    it('TC_T1_ROUTE_05: Target receives exact Midtrans notification JSON payload verbatim', async () => {
      mockTarget.clearRequests();

      const orderId = 'ROUTEB-1234';
      const sig = calculateMidtransSignature(orderId, '200', '120000.00', ROUTEB_KEY);

      const payload = {
        order_id: orderId,
        status_code: '200',
        gross_amount: '120000.00',
        transaction_status: 'settlement',
        signature_key: sig,
        custom_field1: 'e-commerce-store-b',
        payment_type: 'gopay'
      };

      await client.postWebhook(payload);
      await new Promise(r => setTimeout(r, 200));

      const reqs = mockTarget.getRequests();
      const targetReq = reqs.find(r => r.body && r.body.order_id === 'ROUTEB-1234');
      expect(targetReq).toBeDefined();
      expect(targetReq.body.custom_field1).toBe('e-commerce-store-b');
      expect(targetReq.body.payment_type).toBe('gopay');
    });

  });
}
