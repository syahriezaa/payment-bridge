import { describe, it, expect } from '../helpers/test-framework.js';
import { calculateMidtransSignature } from '../helpers/crypto-utils.js';

export function registerSignatureValidationTests(client) {
  describe('Tier 1: Midtrans Webhook SHA-512 Signature Verification', () => {

    const SERVER_KEY = 'SB-Mid-server-sig-test-key';
    let tenantId;

    it('Setup: Create tenant for signature testing', async () => {
      const res = await client.createTenant({
        name: 'Sig Test Tenant',
        prefix: 'SIGA',
        server_key: SERVER_KEY,
        target_url: 'http://localhost:9999/webhooks/siga',
        webhook_secret: 'secret_siga'
      });
      expect(res.status === 201 || res.status === 200).toBeTruthy();
      tenantId = res.data.id;
    });

    it('TC_T1_SIG_01: Valid SHA-512 signature for settlement transaction status', async () => {
      const orderId = 'SIGA-1001';
      const statusCode = '200';
      const grossAmount = '150000.00';
      const sig = calculateMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY);

      const payload = {
        transaction_time: '2026-07-28 18:00:00',
        transaction_status: 'settlement',
        transaction_id: 'tx-sig-1001',
        status_message: 'midtrans payment notification',
        status_code: statusCode,
        signature_key: sig,
        payment_type: 'bank_transfer',
        order_id: orderId,
        gross_amount: grossAmount,
        currency: 'IDR'
      };

      const res = await client.postWebhook(payload);
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('received');
      expect(res.data.audit_id).toBeTruthy();
    });

    it('TC_T1_SIG_02: Valid SHA-512 signature for pending transaction status', async () => {
      const orderId = 'SIGA-1002';
      const statusCode = '201';
      const grossAmount = '200000.00';
      const sig = calculateMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY);

      const payload = {
        transaction_time: '2026-07-28 18:05:00',
        transaction_status: 'pending',
        transaction_id: 'tx-sig-1002',
        status_code: statusCode,
        signature_key: sig,
        order_id: orderId,
        gross_amount: grossAmount
      };

      const res = await client.postWebhook(payload);
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('received');
    });

    it('TC_T1_SIG_03: Valid SHA-512 signature for expire / cancel transaction status', async () => {
      const orderId = 'SIGA-1003';
      const statusCode = '202';
      const grossAmount = '50000.00';
      const sig = calculateMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY);

      const payload = {
        transaction_time: '2026-07-28 18:10:00',
        transaction_status: 'expire',
        transaction_id: 'tx-sig-1003',
        status_code: statusCode,
        signature_key: sig,
        order_id: orderId,
        gross_amount: grossAmount
      };

      const res = await client.postWebhook(payload);
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('received');
    });

    it('TC_T1_SIG_04: Signature verification with decimal string gross_amount (150000.00)', async () => {
      const orderId = 'SIGA-1004';
      const statusCode = '200';
      const grossAmount = '150000.00';
      const sig = calculateMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY);

      const payload = {
        transaction_status: 'settlement',
        status_code: statusCode,
        signature_key: sig,
        order_id: orderId,
        gross_amount: grossAmount
      };

      const res = await client.postWebhook(payload);
      expect(res.status).toBe(200);
    });

    it('TC_T1_SIG_05: Signature verification with integer string gross_amount (150000)', async () => {
      const orderId = 'SIGA-1005';
      const statusCode = '200';
      const grossAmount = '150000';
      const sig = calculateMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY);

      const payload = {
        transaction_status: 'settlement',
        status_code: statusCode,
        signature_key: sig,
        order_id: orderId,
        gross_amount: grossAmount
      };

      const res = await client.postWebhook(payload);
      expect(res.status).toBe(200);
    });

  });
}
