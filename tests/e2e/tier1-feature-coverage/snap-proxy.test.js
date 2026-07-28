import { describe, it, expect } from '../helpers/test-framework.js';

export function registerSnapProxyTests(client, mockMidtrans) {
  describe('Tier 1: Snap Payment Proxy API (POST /api/v1/snap/token)', () => {

    let siteaApiKey;
    let shopbApiKey;

    it('Setup: Register tenants SITEA and SHOPB for Snap Proxy tests', async () => {
      const resA = await client.createTenant({
        name: 'Snap Tenant SITEA',
        prefix: 'SNAPA',
        server_key: 'SB-Mid-server-snapa-key',
        target_url: 'http://localhost:9999/webhooks/snapa',
        webhook_secret: 'secret_snapa'
      });
      siteaApiKey = resA.data.api_key;

      const resB = await client.createTenant({
        name: 'Snap Tenant SHOPB',
        prefix: 'SNAPB',
        server_key: 'SB-Mid-server-snapb-key',
        target_url: 'http://localhost:9999/webhooks/snapb',
        webhook_secret: 'secret_snapb'
      });
      shopbApiKey = resB.data.api_key;
    });

    it('TC_T1_SNAP_01: Request Snap token with valid tenant API Key', async () => {
      const payload = {
        order_id: '1001',
        gross_amount: 150000
      };

      const res = await client.createSnapToken(siteaApiKey, payload);
      expect(res.status === 200 || res.status === 201).toBeTruthy();
      expect(res.data).toBeDefined();
      expect(res.data.token).toBeTruthy();
      expect(res.data.redirect_url).toBeTruthy();
    });

    it('TC_T1_SNAP_02: Verify Bridge automatically prepends tenant prefix (SNAPA-1001) to order_id', async () => {
      mockMidtrans.clearRequests();

      const payload = {
        order_id: '1001',
        gross_amount: 200000
      };

      await client.createSnapToken(siteaApiKey, payload);

      const snapReqs = mockMidtrans.getSnapRequests();
      expect(snapReqs.length).toBeGreaterThanOrEqual(1);

      const lastReq = snapReqs[snapReqs.length - 1];
      expect(lastReq.body.order_id).toBe('SNAPA-1001');
      expect(lastReq.body.gross_amount).toBe(200000);
    });

    it('TC_T1_SNAP_03: Snap Token response returns token string and redirect_url', async () => {
      const payload = {
        order_id: '1002',
        gross_amount: 75000
      };

      const res = await client.createSnapToken(siteaApiKey, payload);
      expect(res.data.token).toStartWith('snap-token-');
      expect(res.data.redirect_url).toContain('/snap/v2/vtweb/');
    });

    it('TC_T1_SNAP_04: Request Snap token for SHOPB tenant prepends SNAPB-2002', async () => {
      mockMidtrans.clearRequests();

      const payload = {
        order_id: '2002',
        gross_amount: 350000
      };

      const res = await client.createSnapToken(shopbApiKey, payload);
      expect(res.status === 200 || res.status === 201).toBeTruthy();

      const snapReqs = mockMidtrans.getSnapRequests();
      const lastReq = snapReqs[snapReqs.length - 1];
      expect(lastReq.body.order_id).toBe('SNAPB-2002');
    });

    it('TC_T1_SNAP_05: Snap Proxy preserves item_details and customer_details', async () => {
      mockMidtrans.clearRequests();

      const payload = {
        order_id: '3003',
        gross_amount: 500000,
        item_details: [
          { id: 'item-1', name: 'Shoes', price: 500000, quantity: 1 }
        ],
        customer_details: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '08123456789'
        }
      };

      await client.createSnapToken(siteaApiKey, payload);

      const snapReqs = mockMidtrans.getSnapRequests();
      const lastReq = snapReqs[snapReqs.length - 1];
      expect(lastReq.body.item_details).toEqual(payload.item_details);
      expect(lastReq.body.customer_details).toEqual(payload.customer_details);
    });

  });
}
