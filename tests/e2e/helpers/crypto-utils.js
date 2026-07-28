import crypto from 'node:crypto';

/**
 * Calculates Midtrans SHA-512 notification signature key.
 * SHA512(order_id + status_code + gross_amount + server_key)
 */
export function calculateMidtransSignature(orderId, statusCode, grossAmount, serverKey) {
  const input = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return crypto.createHash('sha512').update(input, 'utf8').digest('hex');
}

/**
 * Verifies Midtrans SHA-512 notification signature key.
 */
export function verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, signatureKey) {
  const expected = calculateMidtransSignature(orderId, statusCode, grossAmount, serverKey);
  return expected.toLowerCase() === signatureKey.toLowerCase();
}

/**
 * Calculates X-Bridge-Signature (HMAC-SHA256) header for target forwarding.
 * HMAC-SHA256(payloadString, targetWebhookSecret)
 */
export function calculateBridgeSignature(payloadString, secret) {
  return crypto.createHmac('sha256', secret).update(payloadString, 'utf8').digest('hex');
}

/**
 * Verifies X-Bridge-Signature header received by target website.
 */
export function verifyBridgeSignature(payloadString, secret, headerSignature) {
  if (!headerSignature || !secret) return false;
  const expected = calculateBridgeSignature(payloadString, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(headerSignature, 'hex')
    );
  } catch {
    return false;
  }
}
