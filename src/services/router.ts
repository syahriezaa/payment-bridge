import { Tenant } from '../db/types.js';
import { tenantDb } from '../db/index.js';

export interface RouteResolution {
  tenant: Tenant | null;
  prefix: string | null;
}

/**
 * Extracts the prefix portion from an order ID string.
 * Examples:
 * - SITEA-1001 => SITEA
 * - SHOPB_5541 => SHOPB
 * - SITEA#9999 => SITEA
 * - SITEA1001 => SITEA
 */
export function extractOrderIdPrefix(orderId: string): string | null {
  if (!orderId || typeof orderId !== 'string') return null;

  // Try delimiter match first (e.g. SITEA-1001, SHOPB_5541, AUDIT#123)
  const delimiterMatch = orderId.match(/^([A-Za-z0-9]+)[-_#]/);
  if (delimiterMatch) {
    return delimiterMatch[1].toUpperCase();
  }

  // Fallback: match leading uppercase letters or alphanumeric prefix
  const alphaMatch = orderId.match(/^([A-Za-z0-9]+)/);
  if (alphaMatch) {
    return alphaMatch[1].toUpperCase();
  }

  return null;
}

/**
 * Resolves target Tenant from an incoming Midtrans order_id.
 */
export function resolveTenantByOrderId(orderId: string, customTenants?: Tenant[]): RouteResolution {
  if (!orderId || typeof orderId !== 'string') {
    return { tenant: null, prefix: null };
  }

  const tenants = customTenants || tenantDb.getAll();
  const extractedPrefix = extractOrderIdPrefix(orderId);

  // 1. Direct match on extracted prefix (e.g. SITEA)
  if (extractedPrefix) {
    const directMatch = tenants.find(t => {
      const cleanPrefix = t.order_prefix.replace(/[\_\-\*]/g, '').toUpperCase();
      return cleanPrefix === extractedPrefix || t.order_prefix.toUpperCase() === extractedPrefix;
    });
    if (directMatch) {
      return { tenant: directMatch, prefix: extractedPrefix };
    }
  }

  // 2. Sort tenants by prefix length descending to match longest prefix first
  const sortedTenants = [...tenants].sort((a, b) => b.order_prefix.length - a.order_prefix.length);

  for (const tenant of sortedTenants) {
    const pattern = tenant.order_prefix.toUpperCase();

    // Check wildcard pattern (e.g. SITEA_*)
    if (pattern.includes('*')) {
      const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
      try {
        const regex = new RegExp(regexStr, 'i');
        if (regex.test(orderId)) {
          return { tenant, prefix: tenant.order_prefix };
        }
      } catch {
        // Fallback if invalid regex
      }
    }

    // Check prefix match (e.g. orderId starts with pattern, or pattern without trailing punctuation)
    const basePattern = pattern.replace(/[^A-Z0-9]$/i, '');
    const cleanOrderId = orderId.toUpperCase();
    if (cleanOrderId.startsWith(basePattern) || cleanOrderId.startsWith(pattern)) {
      return { tenant, prefix: tenant.order_prefix };
    }
  }

  return { tenant: null, prefix: extractedPrefix };
}
