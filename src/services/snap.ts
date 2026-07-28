import { tenantDb } from '../db/index.js';
import { Tenant } from '../db/types.js';
import { config } from '../config.js';

export interface SnapTokenRequest {
  order_id: string | number;
  gross_amount: number;
  [key: string]: any;
}

export interface SnapProxyResult {
  statusCode: number;
  data: any;
}

export function formatPrependedOrderId(orderId: string | number, tenantPrefix: string): string {
  const rawId = String(orderId).trim();
  const cleanPrefix = tenantPrefix.toUpperCase();

  // If already prepended with PREFIX- or PREFIX_, return as is
  if (rawId.toUpperCase().startsWith(`${cleanPrefix}-`) || rawId.toUpperCase().startsWith(`${cleanPrefix}_`)) {
    return rawId;
  }

  return `${cleanPrefix}-${rawId}`;
}

export async function createSnapTokenProxy(
  apiKey: string,
  body: SnapTokenRequest,
  snapUrl?: string
): Promise<SnapProxyResult> {
  if (!apiKey) {
    return {
      statusCode: 401,
      data: { error: 'Missing or invalid Authorization header' }
    };
  }

  // Find tenant by API Key
  const tenant = tenantDb.getByApiKey(apiKey);
  if (!tenant) {
    return {
      statusCode: 401,
      data: { error: 'Invalid Tenant API key' }
    };
  }

  if (!body || !body.order_id || body.gross_amount === undefined || body.gross_amount === null) {
    return {
      statusCode: 400,
      data: { error: 'Missing order_id or gross_amount' }
    };
  }

  const grossAmount = Number(body.gross_amount);
  if (isNaN(grossAmount) || grossAmount <= 0) {
    return {
      statusCode: 400,
      data: { error: 'gross_amount must be a positive number' }
    };
  }

  const prependedOrderId = formatPrependedOrderId(body.order_id, tenant.order_prefix);

  const snapPayload = {
    ...body,
    order_id: prependedOrderId,
    gross_amount: grossAmount
  };

  const targetSnapUrl = snapUrl || process.env.MIDTRANS_SNAP_URL || config.midtransSnapUrl;
  const authHeader = `Basic ${Buffer.from(tenant.server_key + ':').toString('base64')}`;

  try {
    const res = await fetch(targetSnapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(snapPayload)
    });

    let resData: any;
    try {
      resData = await res.json();
    } catch {
      resData = { message: await res.text() };
    }

    return {
      statusCode: res.status,
      data: resData
    };
  } catch (err: any) {
    return {
      statusCode: 502,
      data: {
        error: 'Failed to communicate with Midtrans Snap API',
        details: err.message
      }
    };
  }
}
