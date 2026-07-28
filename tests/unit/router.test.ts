import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractOrderIdPrefix, resolveTenantByOrderId } from '../../src/services/router.js';
import { Tenant } from '../../src/db/types.js';

describe('Unit: Router Service', () => {
  const mockTenants: Tenant[] = [
    {
      id: 'tenant-1',
      name: 'Site A Store',
      order_prefix: 'SITEA',
      prefix: 'SITEA',
      target_url: 'http://localhost:9999/sitea',
      webhook_secret: 'sec1',
      server_key: 'key1',
      api_key: 'api1',
      created_at: new Date().toISOString()
    },
    {
      id: 'tenant-2',
      name: 'Shop B Store',
      order_prefix: 'SHOPB',
      prefix: 'SHOPB',
      target_url: 'http://localhost:9999/shopb',
      webhook_secret: 'sec2',
      server_key: 'key2',
      api_key: 'api2',
      created_at: new Date().toISOString()
    },
    {
      id: 'tenant-3',
      name: 'Wildcard Store',
      order_prefix: 'WILD_*',
      prefix: 'WILD_*',
      target_url: 'http://localhost:9999/wild',
      webhook_secret: 'sec3',
      server_key: 'key3',
      api_key: 'api3',
      created_at: new Date().toISOString()
    }
  ];

  it('extracts Order ID prefix correctly', () => {
    assert.strictEqual(extractOrderIdPrefix('SITEA-1001'), 'SITEA');
    assert.strictEqual(extractOrderIdPrefix('SHOPB_5541'), 'SHOPB');
    assert.strictEqual(extractOrderIdPrefix('SITEA#9999'), 'SITEA');
    assert.strictEqual(extractOrderIdPrefix('SITEA1001'), 'SITEA1001');
  });

  it('resolves tenant for hyphenated prefix (SITEA-1001)', () => {
    const res = resolveTenantByOrderId('SITEA-1001', mockTenants);
    assert.notStrictEqual(res.tenant, null);
    assert.strictEqual(res.tenant?.id, 'tenant-1');
    assert.strictEqual(res.tenant?.order_prefix, 'SITEA');
  });

  it('resolves tenant for underscore prefix (SHOPB_5541)', () => {
    const res = resolveTenantByOrderId('SHOPB_5541', mockTenants);
    assert.notStrictEqual(res.tenant, null);
    assert.strictEqual(res.tenant?.id, 'tenant-2');
  });

  it('resolves tenant for wildcard pattern (WILD_9999)', () => {
    const res = resolveTenantByOrderId('WILD_9999', mockTenants);
    assert.notStrictEqual(res.tenant, null);
    assert.strictEqual(res.tenant?.id, 'tenant-3');
  });

  it('returns null tenant for unmapped order prefix', () => {
    const res = resolveTenantByOrderId('UNKNOWN-9999', mockTenants);
    assert.strictEqual(res.tenant, null);
    assert.strictEqual(res.prefix, 'UNKNOWN');
  });
});
