import { describe, it, expect, beforeEach } from '../helpers/test-framework.js';

export function registerTenantCrudTests(client) {
  describe('Tier 1: Tenant Management CRUD API', () => {

    it('TC_T1_TENANT_01: Create new tenant with valid configuration', async () => {
      const payload = {
        name: 'Website A E-Commerce',
        prefix: 'SITEA',
        server_key: 'SB-Mid-server-sitea-key-12345',
        target_url: 'http://localhost:9999/webhooks/sitea',
        webhook_secret: 'secret_sitea_key_xyz'
      };

      const res = await client.createTenant(payload);
      expect(res.status === 201 || res.status === 200).toBeTruthy();
      expect(res.data).toBeDefined();
      expect(res.data.id).toBeTruthy();
      expect(res.data.prefix).toBe('SITEA');
      expect(res.data.api_key).toBeTruthy();
      expect(res.data.server_key).toBe('SB-Mid-server-sitea-key-12345');
    });

    it('TC_T1_TENANT_02: List all registered tenants', async () => {
      const res = await client.getTenants();
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBeTruthy();
      expect(res.data.length).toBeGreaterThanOrEqual(1);
    });

    it('TC_T1_TENANT_03: Retrieve tenant by ID', async () => {
      const createRes = await client.createTenant({
        name: 'Website B E-Commerce',
        prefix: 'SHOPB',
        server_key: 'SB-Mid-server-shopb-key-67890',
        target_url: 'http://localhost:9999/webhooks/shopb',
        webhook_secret: 'secret_shopb_key_abc'
      });

      const tenantId = createRes.data.id;
      const getRes = await client.getTenant(tenantId);
      expect(getRes.status).toBe(200);
      expect(getRes.data.id).toBe(tenantId);
      expect(getRes.data.name).toBe('Website B E-Commerce');
      expect(getRes.data.prefix).toBe('SHOPB');
    });

    it('TC_T1_TENANT_04: Update tenant details (target_url and webhook_secret)', async () => {
      const createRes = await client.createTenant({
        name: 'Website C E-Commerce',
        prefix: 'STOREC',
        server_key: 'SB-Mid-server-storec-key-11111',
        target_url: 'http://localhost:9999/webhooks/storec-old',
        webhook_secret: 'secret_storec_old'
      });

      const tenantId = createRes.data.id;
      const updateRes = await client.updateTenant(tenantId, {
        target_url: 'http://localhost:9999/webhooks/storec-new',
        webhook_secret: 'secret_storec_updated'
      });

      expect(updateRes.status).toBe(200);
      expect(updateRes.data.target_url).toBe('http://localhost:9999/webhooks/storec-new');
      expect(updateRes.data.webhook_secret).toBe('secret_storec_updated');
    });

    it('TC_T1_TENANT_05: Delete tenant and confirm non-existence', async () => {
      const createRes = await client.createTenant({
        name: 'Website D Temporary',
        prefix: 'TEMPD',
        server_key: 'SB-Mid-server-tempd',
        target_url: 'http://localhost:9999/webhooks/tempd',
        webhook_secret: 'secret_tempd'
      });

      const tenantId = createRes.data.id;
      const delRes = await client.deleteTenant(tenantId);
      expect(delRes.status === 200 || delRes.status === 204).toBeTruthy();

      const getRes = await client.getTenant(tenantId);
      expect(getRes.status).toBe(404);
    });

    it('TC_T1_TENANT_06: Prevent duplicate prefix registration', async () => {
      const payload1 = {
        name: 'Tenant Original',
        prefix: 'UNIQUE1',
        server_key: 'SB-Mid-server-u1',
        target_url: 'http://localhost:9999/webhooks/u1',
        webhook_secret: 'sec_u1'
      };

      const payload2 = {
        name: 'Tenant Duplicate Prefix',
        prefix: 'UNIQUE1',
        server_key: 'SB-Mid-server-u1-dup',
        target_url: 'http://localhost:9999/webhooks/u1-dup',
        webhook_secret: 'sec_u1_dup'
      };

      const res1 = await client.createTenant(payload1);
      expect(res1.status === 201 || res1.status === 200).toBeTruthy();

      const res2 = await client.createTenant(payload2);
      expect(res2.status === 409 || res2.status === 400).toBeTruthy();
    });

  });
}
