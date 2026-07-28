export interface Tenant {
  id: string;
  name: string;
  order_prefix: string;
  prefix?: string;
  server_key: string;
  target_url: string;
  webhook_secret: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

export interface TenantInput {
  name: string;
  order_prefix: string;
  server_key: string;
  target_url: string;
  webhook_secret?: string;
  api_key?: string;
}

export type WebhookStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'RETRYING';

export interface WebhookAuditLog {
  id: string;
  order_id: string;
  tenant_id: string | null;
  tenant_name?: string;
  tenant_prefix?: string;
  payload: any;
  status: WebhookStatus;
  response_code: number | null;
  response_status?: number | null;
  http_status?: number | null;
  latency_ms: number | null;
  attempts: number;
  error_message?: string;
  timestamp?: string;
  created_at?: string;
}

export interface AuditLogQueryResult {
  logs: WebhookAuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MetricStats {
  totalWebhooks: number;
  successRate: number;
  pendingRetries: number;
  avgLatency: number;
}

export interface Rule {
  id: string;
  name: string;
  prefix: string;
  order_prefix: string;
  target_url: string;
}
