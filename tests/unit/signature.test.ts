import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateMidtransSignature,
  verifyMidtransSignature,
  calculateBridgeSignature,
  verifyBridgeSignature
} from '../../src/services/signature.js';

describe('Unit: Signature Service', () => {
  const SERVER_KEY = 'SB-Mid-server-test-key-123';
  const WEBHOOK_SECRET = 'secret_sitea_hmac_secret';

  it('calculates valid SHA-512 signature for Midtrans notifications', () => {
    const orderId = 'SITEA-1001';
    const statusCode = '200';
    const grossAmount = '150000.00';

    const sig = calculateMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY);
    assert.strictEqual(typeof sig, 'string');
    assert.strictEqual(sig.length, 128); // 512 bits = 128 hex chars

    const isValid = verifyMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY, sig);
    assert.strictEqual(isValid, true);
  });

  it('rejects invalid SHA-512 signature', () => {
    const orderId = 'SITEA-1001';
    const statusCode = '200';
    const grossAmount = '150000.00';
    const invalidSig = 'a'.repeat(128);

    const isValid = verifyMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY, invalidSig);
    assert.strictEqual(isValid, false);
  });

  it('handles decimal string vs integer string gross_amount correctly', () => {
    const orderId = 'SITEA-1002';
    const statusCode = '200';

    const sigDecimal = calculateMidtransSignature(orderId, statusCode, '150000.00', SERVER_KEY);
    const sigInt = calculateMidtransSignature(orderId, statusCode, '150000', SERVER_KEY);

    assert.notStrictEqual(sigDecimal, sigInt);

    assert.strictEqual(verifyMidtransSignature(orderId, statusCode, '150000.00', SERVER_KEY, sigDecimal), true);
    assert.strictEqual(verifyMidtransSignature(orderId, statusCode, '150000', SERVER_KEY, sigInt), true);
  });

  it('calculates and verifies X-Bridge-Signature (HMAC-SHA256)', () => {
    const payload = JSON.stringify({ order_id: 'SITEA-1001', status: 'settlement' });
    const hmac = calculateBridgeSignature(payload, WEBHOOK_SECRET);

    assert.strictEqual(typeof hmac, 'string');
    assert.strictEqual(hmac.length, 64); // 256 bits = 64 hex chars

    const isValid = verifyBridgeSignature(payload, WEBHOOK_SECRET, hmac);
    assert.strictEqual(isValid, true);
  });

  it('rejects tampered payload for X-Bridge-Signature', () => {
    const payload = JSON.stringify({ order_id: 'SITEA-1001', status: 'settlement' });
    const tamperedPayload = JSON.stringify({ order_id: 'SITEA-1001', status: 'settlement', tampered: true });
    const hmac = calculateBridgeSignature(payload, WEBHOOK_SECRET);

    const isValid = verifyBridgeSignature(tamperedPayload, WEBHOOK_SECRET, hmac);
    assert.strictEqual(isValid, false);
  });
});
