import { auditService } from './audit.js';
import { tenantDb } from '../db/index.js';
import { calculateBridgeSignature } from './signature.js';
import { config } from '../config.js';

export interface DispatchOptions {
  maxRetries?: number;
  retryDelaysMs?: number[];
  timeoutMs?: number;
}

const DEFAULT_RETRY_DELAYS = config.isTest
  ? [10, 20, 40, 80, 160]
  : [1000, 2000, 4000, 8000, 16000];

const DEFAULT_TIMEOUT_MS = 10000;

export async function executeSingleAttempt(
  targetUrl: string,
  rawPayload: string,
  webhookSecret: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ status: number; latencyMs: number; error: string | null }> {
  const startMs = Date.now();
  const signature = calculateBridgeSignature(rawPayload, webhookSecret);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Signature': signature
      },
      body: rawPayload,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startMs;

    return {
      status: res.status,
      latencyMs,
      error: res.ok ? null : `HTTP ${res.status} ${res.statusText}`
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startMs;
    const errorMsg = err.name === 'AbortError' ? 'Request timeout' : err.message || 'Network error';
    return {
      status: 503,
      latencyMs,
      error: errorMsg
    };
  }
}

export async function processDispatch(
  auditId: string,
  options: DispatchOptions = {}
): Promise<boolean> {
  const log = auditService.getLogById(auditId);
  if (!log) {
    console.error(`[Dispatcher] Audit log not found: ${auditId}`);
    return false;
  }

  if (!log.tenant_id) {
    console.error(`[Dispatcher] Audit log ${auditId} has no tenant_id`);
    return false;
  }

  const tenant = tenantDb.getById(log.tenant_id);
  if (!tenant) {
    auditService.updateLogStatus(auditId, 'FAILED', log.attempt_count, null, null, 'Tenant no longer exists');
    return false;
  }

  const targetUrl = log.target_url || tenant.target_url;
  const maxRetries = options.maxRetries ?? 5;
  const retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let currentAttempt = log.attempt_count;

  for (let retryIdx = 0; retryIdx < maxRetries; retryIdx++) {
    currentAttempt++;

    const result = await executeSingleAttempt(targetUrl, log.payload, tenant.webhook_secret, timeoutMs);

    if (result.status >= 200 && result.status < 300) {
      auditService.updateLogStatus(auditId, 'DISPATCHED', currentAttempt, result.status, result.latencyMs, null);
      return true;
    }

    // Failed attempt
    auditService.updateLogStatus(
      auditId,
      'FAILED',
      currentAttempt,
      result.status,
      result.latencyMs,
      result.error
    );

    // If there are remaining retries, wait with backoff
    if (retryIdx < maxRetries - 1) {
      const delay = retryDelays[retryIdx] || retryDelays[retryDelays.length - 1];
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return false;
}

export function enqueueDispatch(auditId: string, options?: DispatchOptions): void {
  setImmediate(() => {
    processDispatch(auditId, options).catch(err => {
      console.error(`[Dispatcher] Background dispatch error for ${auditId}:`, err);
    });
  });
}

export async function retryDispatchManually(auditId: string, options?: DispatchOptions): Promise<{ success: boolean; log: any }> {
  const log = auditService.getLogById(auditId);
  if (!log) {
    throw new Error('Audit log not found');
  }

  if (!log.tenant_id) {
    throw new Error('Associated tenant no longer exists');
  }

  const tenant = tenantDb.getById(log.tenant_id);
  if (!tenant) {
    throw new Error('Associated tenant no longer exists');
  }

  // Execute single dispatch attempt for manual retry
  const result = await executeSingleAttempt(log.target_url || tenant.target_url, log.payload, tenant.webhook_secret);
  const newAttemptCount = log.attempt_count + 1;
  const status = (result.status >= 200 && result.status < 300) ? 'DISPATCHED' : 'FAILED';

  const updatedLog = auditService.updateLogStatus(
    auditId,
    status,
    newAttemptCount,
    result.status,
    result.latencyMs,
    result.error
  );

  return {
    success: status === 'DISPATCHED',
    log: updatedLog
  };
}
