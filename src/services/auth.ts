import crypto from 'node:crypto';

/**
 * Generate a random salt string in hex format.
 */
export function generateSalt(length = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a password using PBKDF2 with SHA-512 and a secure salt.
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || generateSalt();
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

/**
 * Verify a password against a hash and salt.
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password || !hash || !salt) return false;
  const calculatedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const bufA = Buffer.from(hash, 'hex');
  const bufB = Buffer.from(calculatedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function base64urlEncode(strOrBuffer: string | Buffer): string {
  const buf = typeof strOrBuffer === 'string' ? Buffer.from(strOrBuffer, 'utf8') : strOrBuffer;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function parseExpiresIn(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') return expiresIn;
  if (/^\d+$/.test(expiresIn)) return parseInt(expiresIn, 10);
  const match = String(expiresIn).match(/^(\d+)([smhd])$/);
  if (!match) return 86400; // default 24h
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return val;
    case 'm': return val * 60;
    case 'h': return val * 3600;
    case 'd': return val * 86400;
    default: return 86400;
  }
}

/**
 * Generate a JWT token using HMAC-SHA256 signature.
 */
export function generateToken(payload: Record<string, any>, secret: string, expiresIn?: string | number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64urlEncode(JSON.stringify(header));

  const now = Math.floor(Date.now() / 1000);
  const expSeconds = expiresIn !== undefined ? parseExpiresIn(expiresIn) : 86400;
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expSeconds
  };
  const payloadB64 = base64urlEncode(JSON.stringify(fullPayload));

  const signatureInput = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest();
  const signatureB64 = base64urlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verify a JWT token and return its payload if valid.
 */
export function verifyToken(token: string, secret: string): any {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const signatureInput = `${headerB64}.${payloadB64}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(signatureInput).digest();
  const expectedSignatureB64 = base64urlEncode(expectedSignature);

  if (signatureB64 !== expectedSignatureB64) {
    throw new Error('Invalid token signature');
  }

  let payload: any;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64));
  } catch {
    throw new Error('Invalid token payload');
  }

  if (payload.exp && typeof payload.exp === 'number') {
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) {
      throw new Error('Token expired');
    }
  }

  return payload;
}
