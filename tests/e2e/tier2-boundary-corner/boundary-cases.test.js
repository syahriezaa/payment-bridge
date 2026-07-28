import { describe, it, expect } from '../helpers/test-framework.js';

export function registerBoundaryCasesTests(client, mockTarget) {
  describe('Tier 2: Boundary & Corner Cases', () => {

    let tenantKey;

    it('Setup: Register tenant for boundary tests', async () => {
      const res = await client.createTenant({
        name: 'Boundary Test Tenant',
        prefix: 'BNDR',
        server_key: 'SB-Mid-server-bndr-key',
        target_url: `http://localhost:${mockTarget.port}/webhooks/bndr`,
        webhook_secret: 'sec_bndr'
      });
      tenantKey = res.data.api_key;
    });

    it('TC_T2_BND_01: Reject Midtrans webhook with invalid SHA-512 signature', async () => {
      const payload = {
        order_id: 'BNDR-1001',
        status_code: '200',
        gross_amount: '100000.00',
        transaction_status: 'settlement',
        signature_key: 'invalid_sha512_hash_0000000000000000000000000000000000000000'
      };

      const res = await client.postWebhook(payload);
      expect(res.status === 401 || res.status === 400).toBeTruthy();
    });

    it('TC_T2_BND_02: Reject webhook with unmapped Order ID prefix (UNKNOWN-9999)', async () => {
      const payload = {
        order_id: 'UNKNOWN-9999',
        status_code: '200',
        gross_amount: '50000.00',
        transaction_status: 'settlement',
        signature_key: 'dummy_sig'
      };

      const res = await client.postWebhook(payload);
      expect(res.status === 400 || res.status === 404).toBeTruthy();
    });

    it('TC_T2_BND_03: Return non-blocking 200 OK to Midtrans when target website is 500/offline', async () => {
      mockTarget.setResponseCode(500);

      // Create valid SHA512 signature for BNDR-500
      const crypto = await import('../helpers/crypto-utils.js');
      const sig = crypto.calculateMidtransSignature('BNDR-500', '200', '100000.00', 'SB-Mid-server-bndr-key');

      const payload = {
        order_id: 'BNDR-500',
        status_code: '200',
        gross_amount: '100000.00',
        transaction_status: 'settlement',
        signature_key: sig
      };

      const res = await client.postWebhook(payload);
      expect(res.status).toBe(200); // Immediate 200 OK to Midtrans!

      await new Promise(r => setTimeout(r, 200));

      // Reset mock target status
      mockTarget.setResponseCode(200);
    });

    it('TC_T2_BND_04: Reject empty or malformed JSON payload on webhook ingress', async () => {
      const res = await client.postWebhook('{ malformed json }', { 'Content-Type': 'application/json' });
      expect(res.status === 400).toBeTruthy();
    });

    it('TC_T2_BND_05: Reject webhook missing required parameters (missing status_code & signature_key)', async () => {
      const payload = {
        order_id: 'BNDR-888',
        gross_amount: '100000.00'
      };

      const res = await client.postWebhook(payload);
      expect(res.status === 400).toBeTruthy();
    });

    it('TC_T2_BND_06: Reject Snap token request with zero gross_amount', async () => {
      const payload = {
        order_id: '9001',
        gross_amount: 0
      };

      const res = await client.createSnapToken(tenantKey, payload);
      expect(res.status === 400).toBeTruthy();
    });

    it('TC_T2_BND_07: Reject Snap token request with negative gross_amount', async () => {
      const payload = {
        order_id: '9002',
        gross_amount: -50000
      };

      const res = await client.createSnapToken(tenantKey, payload);
      expect(res.status === 400).toBeTruthy();
    });

    it('TC_T2_BND_08: Reject Snap token request missing Authorization header', async () => {
      const payload = {
        order_id: '9003',
        gross_amount: 100000
      };

      const res = await client.createSnapToken(null, payload);
      expect(res.status === 401).toBeTruthy();
    });

    it('TC_T2_BND_09: Reject Snap token request with invalid / non-existent API Key', async () => {
      const payload = {
        order_id: '9004',
        gross_amount: 100000
      };

      const res = await client.createSnapToken('bk_invalid_key_999999', payload);
      expect(res.status === 401).toBeTruthy();
    });

  });
}
