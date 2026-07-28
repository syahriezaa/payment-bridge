import crypto from 'node:crypto';

/**
 * Calculates Midtrans SHA-512 notification signature key.
 * Formula: SHA512(order_id + status_code + gross_amount + server_key)
 */
export function calculateMidtransSignature(
  orderId: string | number,
  statusCode: string | number,
  grossAmount: string | number,
  serverKey: string
): string {
  const input = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return crypto.createHash('sha512').update(input, 'utf8').digest('hex');
}

/**
 * Verifies Midtrans SHA-512 notification signature key against expected hash.
 */
export function verifyMidtransSignature(
  orderId: string | number,
  statusCode: string | number,
  grossAmount: string | number,
  serverKey: string,
  signatureKey: string
): boolean {
  if (!signatureKey || !serverKey) return false;
  const expected = calculateMidtransSignature(orderId, statusCode, grossAmount, serverKey);
  return expected.toLowerCase() === signatureKey.toLowerCase();
}

/**
 * Calculates X-Bridge-Signature (HMAC-SHA256) header for forwarding notifications to target website.
 * Formula: HMAC-SHA256(payloadBodyString, webhookSecret)
 */
export function calculateBridgeSignature(payloadString: string, webhookSecret: string): string {
  return crypto.createHmac('sha256', webhookSecret).update(payloadString, 'utf8').digest('hex');
}

/**
 * Verifies X-Bridge-Signature header received by target website using timing-safe comparison.
 */
export function verifyBridgeSignature(
  payloadString: string,
  webhookSecret: string,
  headerSignature: string
): boolean {
  if (!headerSignature || !webhookSecret) return false;
  const expected = calculateBridgeSignature(payloadString, webhookSecret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(headerSignature, 'hex')
    );
  } catch {
    return false;
  }
}
