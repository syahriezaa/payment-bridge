export interface Tenant {
  id: string;
  name: string;
  order_prefix: string;
  prefix: string; // Alias for order_prefix for compatibility
  target_url: string;
  webhook_secret: string;
  server_key: string;
  api_key: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

export interface TenantInput {
  id?: string;
  name: string;
  order_prefix?: string;
  prefix?: string;
  target_url: string;
  webhook_secret?: string;
  server_key: string;
  api_key?: string;
}

export interface WebhookAuditLog {
  id: string;
  tenant_id: string | null;
  order_id: string;
  prefix: string | null;
  payload: string;
  target_url: string | null;
  status: 'PENDING' | 'DISPATCHED' | 'FAILED' | 'UNMAPPED_PREFIX' | 'INVALID_SIGNATURE' | string;
  attempt_count: number;
  attempts: number; // Alias for attempt_count
  last_http_status: number | null;
  response_code: number | null; // Alias for last_http_status
  execution_latency_ms: number | null;
  latency_ms: number | null; // Alias for execution_latency_ms
  error: string | null;
  created_at: string;
  updated_at: string;
  timestamp: string; // Alias for created_at
}

export interface CreateAuditLogInput {
  id?: string;
  tenant_id?: string | null;
  order_id: string;
  prefix?: string | null;
  payload: string;
  target_url?: string | null;
  status: string;
  attempt_count?: number;
  last_http_status?: number | null;
  execution_latency_ms?: number | null;
  error?: string | null;
}
