import { auditDb } from '../db/index.js';
import { WebhookAuditLog, CreateAuditLogInput } from '../db/types.js';

export const auditService = {
  createLog(input: CreateAuditLogInput): WebhookAuditLog {
    return auditDb.create(input);
  },

  getLogById(id: string): WebhookAuditLog | null {
    return auditDb.getById(id);
  },

  updateLogStatus(
    id: string,
    status: string,
    attemptCount: number,
    lastHttpStatus: number | null,
    latencyMs: number | null,
    error: string | null = null
  ): WebhookAuditLog | null {
    return auditDb.updateStatus(id, status, attemptCount, lastHttpStatus, latencyMs, error);
  },

  queryLogs(params: { tenant_id?: string; status?: string; page?: number; limit?: number }) {
    return auditDb.query(params);
  }
};
