import { describe, it, expect } from '../helpers/test-framework.js';
import { calculateMidtransSignature } from '../helpers/crypto-utils.js';

export function registerAuditLogsTests(client) {
  describe('Tier 1: Webhook Audit Log Queries & Management API', () => {

    let tenantA;
    let tenantB;

    it('Setup: Register tenants and trigger webhook traffic to populate audit logs', async () => {
      const resA = await client.createTenant({
        name: 'Audit Store Alpha',
        prefix: 'AUDITA',
        server_key: 'SB-Mid-server-audita',
        target_url: 'http://localhost:9999/webhooks/audita',
        webhook_secret: 'sec_audita'
      });
      tenantA = resA.data;

      const resB = await client.createTenant({
        name: 'Audit Store Beta',
        prefix: 'AUDITB',
        server_key: 'SB-Mid-server-auditb',
        target_url: 'http://localhost:9999/webhooks/auditb',
        webhook_secret: 'sec_auditb'
      });
      tenantB = resB.data;

      // Send webhooks for AUDITA
      const sigA = calculateMidtransSignature('AUDITA-101', '200', '10000.00', tenantA.server_key);
      await client.postWebhook({
        order_id: 'AUDITA-101',
        status_code: '200',
        gross_amount: '10000.00',
        transaction_status: 'settlement',
        signature_key: sigA
      });

      // Send webhooks for AUDITB
      const sigB = calculateMidtransSignature('AUDITB-201', '200', '20000.00', tenantB.server_key);
      await client.postWebhook({
        order_id: 'AUDITB-201',
        status_code: '200',
        gross_amount: '20000.00',
        transaction_status: 'settlement',
        signature_key: sigB
      });

      await new Promise(r => setTimeout(r, 200));
    });

    it('TC_T1_AUDIT_01: Webhook execution creates audit log entry', async () => {
      const res = await client.getAuditLogs();
      expect(res.status).toBe(200);
      expect(res.data.logs).toBeDefined();
      expect(Array.isArray(res.data.logs)).toBeTruthy();
      expect(res.data.logs.length).toBeGreaterThanOrEqual(2);
    });

    it('TC_T1_AUDIT_02: Filter audit logs by tenant_id', async () => {
      const res = await client.getAuditLogs({ tenant_id: tenantA.id });
      expect(res.status).toBe(200);
      expect(res.data.logs.every(log => log.tenant_id === tenantA.id)).toBeTruthy();
    });

    it('TC_T1_AUDIT_03: Filter audit logs by status (DISPATCHED)', async () => {
      const res = await client.getAuditLogs({ status: 'DISPATCHED' });
      expect(res.status).toBe(200);
      expect(res.data.logs.every(log => log.status === 'DISPATCHED')).toBeTruthy();
    });

    it('TC_T1_AUDIT_04: Audit log pagination (page=1, limit=1)', async () => {
      const res = await client.getAuditLogs({ page: 1, limit: 1 });
      expect(res.status).toBe(200);
      expect(res.data.limit).toBe(1);
      expect(res.data.logs.length).toBe(1);
    });

    it('TC_T1_AUDIT_05: Detailed audit log inspection by ID returns raw payload & execution metadata', async () => {
      const listRes = await client.getAuditLogs();
      const firstLog = listRes.data.logs[0];

      const getRes = await client.getAuditLog(firstLog.id);
      expect(getRes.status).toBe(200);
      expect(getRes.data.id).toBe(firstLog.id);
      expect(getRes.data.order_id).toBeTruthy();
      expect(getRes.data.payload).toBeTruthy();
    });

  });
}
