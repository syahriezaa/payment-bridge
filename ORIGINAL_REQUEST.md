# Original User Request

## Initial Request — 2026-07-28T18:13:48Z

Build a high-performance, resilient Midtrans Multi-Tenant Payment Bridge (Webhook Router & Admin Dashboard) in d:\bridge that routes notifications from a single (or multiple) Midtrans merchant account to multiple target websites based on Order ID prefixes.

Working directory: d:\bridge
Integrity mode: development

## Requirements

### R1. Midtrans Webhook Router & Dispatch Engine
- Provide a webhook ingress endpoint (`POST /api/webhooks/midtrans`) that accepts notifications from Midtrans.
- Verify incoming SHA-512 signatures against the configured Midtrans Server Key(s).
- Parse the `order_id` prefix (e.g., `SITEA-1001` -> Website A, `SHOPB-5541` -> Website B).
- Forward verified notifications asynchronously to the matching target website URL with an added `X-Bridge-Signature` (HMAC-SHA256) header so target websites can verify authenticity.
- Implement an automatic retry mechanism with exponential backoff (e.g. up to 5 retries) if target endpoints fail or time out, while returning an immediate `200 OK` response to Midtrans.

### R2. Web Admin Dashboard & Management API
- Provide a modern, clean web dashboard UI (Vite + React) for managing target websites, Order ID prefix mapping rules, and Midtrans Server Keys / Webhook Secrets.
- Provide a real-time Webhook Audit Log viewer showing incoming payloads, target dispatch statuses, HTTP response status codes, execution latencies, and a manual "Re-send / Retry" button.
- Include an "Integration Guide" section displaying ready-to-copy code snippets for target app integration (PHP, Node.js, Laravel, WordPress).

### R3. Snap Payment Proxy (Optional Helper API)
- Provide a proxy endpoint (`POST /api/v1/snap/token`) allowing target websites to generate Snap tokens directly through the Bridge, automatically prepending the website's designated Order ID prefix.

## Acceptance Criteria

### Webhook Verification & Routing
- [ ] Validates Midtrans SHA-512 signature correctly (`SHA512(order_id + status_code + gross_amount + ServerKey)`).
- [ ] Correctly resolves target website based on Order ID prefix rules (e.g. `SITEA_*`).
- [ ] Successfully forwards payload to target website with HMAC-SHA256 signature header.
- [ ] Handles offline target websites by queuing for automatic retry without blocking Midtrans HTTP 200 OK acknowledgment.

### Web Dashboard & Management
- [ ] Admin UI allows creating, updating, and deleting target website routing configurations.
- [ ] Audit logs display complete payload details, dispatch timestamps, and response statuses.
- [ ] Manual retry action triggers re-delivery attempt and updates log status.

### System Verification & Tests
- [ ] Includes automated test suite or mock script verifying signature validation, prefix parsing, and dispatch retries.
