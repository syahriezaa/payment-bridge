# End-to-End (E2E) Test Infrastructure & Suite Specification

## System Overview
The **Midtrans Multi-Tenant Payment Bridge** is a multi-tenant payment routing gateway designed to ingest payment notification webhooks from Midtrans, validate SHA-512 cryptographic signatures, resolve tenant routing based on Order ID prefixes (e.g., `SITEA-*`, `SHOPB-*`), forward notifications asynchronously to target website endpoints with an added `X-Bridge-Signature` (HMAC-SHA256) header, handle target downtime via exponential backoff retries, and proxy Snap payment token requests.

---

## 1. Feature Inventory

| Feature ID | Feature Name | Core Responsibility | Primary API / Interface |
|------------|--------------|----------------------|--------------------------|
| **F-01** | Tenant Management CRUD | Manage target websites, Order ID prefix mapping rules, Midtrans server keys, and HMAC webhook secrets | `POST`, `GET`, `PUT`, `DELETE /api/admin/tenants` |
| **F-02** | Webhook Ingress & SHA-512 Validator | Ingest Midtrans webhooks, validate SHA-512 signature `SHA512(order_id + status_code + gross_amount + ServerKey)`, respond with non-blocking 200 OK | `POST /api/webhooks/midtrans` |
| **F-03** | Order ID Prefix Router | Parse Order ID prefixes (`SITEA-*`, `SHOPB-*`) and resolve destination target website URL | Internal Routing Engine |
| **F-04** | Async Dispatcher & HMAC Signer | Forward notification payload asynchronously to target URL with `X-Bridge-Signature: HMAC-SHA256(raw_body, secret)` | Outbound HTTP Dispatcher |
| **F-05** | Exponential Backoff Retry Engine | Automatically retry failed target dispatches (e.g. 500/timeout) up to 5 times without blocking Midtrans ingress | Asynchronous Retry Worker |
| **F-06** | Snap Payment Proxy | Proxy Snap token creation requests, prepending tenant designated prefix to `order_id` | `POST /api/v1/snap/token` |
| **F-07** | Audit Log Viewer & Manual Retry | Query webhook execution history, filter logs, inspect raw payloads, and manually trigger re-delivery | `GET /api/admin/audit-logs`, `POST /api/admin/audit-logs/:id/retry` |

---

## 2. Test Methodology & 4-Tier Breakdown

The E2E Test Suite adopts an **opaque-box, requirement-driven 4-tier testing methodology**:

### Tier 1: Feature Coverage (26 Test Cases)
Validates all core happy-path requirements with >=5 distinct test cases per feature module:
- **Tenant Management CRUD (6 Test Cases)**: Create tenant, list tenants, get tenant details, update tenant configuration, delete tenant, prevent duplicate prefix registration.
- **Midtrans SHA-512 Verification (5 Test Cases)**: Valid signature for `settlement`, `pending`, `expire`, `cancel`, decimal `gross_amount` (`150000.00`), and integer `gross_amount` (`150000`).
- **Prefix Routing & Async Forwarding (5 Test Cases)**: Route `ROUTEA-*` to Target A, route `ROUTEB-*` to Target B, support hyphen/underscore delimiters (`ROUTEA_9999`), verify `X-Bridge-Signature` HMAC-SHA256 header, verify raw payload verbatim delivery.
- **Snap Token Proxy (5 Test Cases)**: Snap token request with valid API key, automatic prefix prepending (`SNAPA-1001`), token & redirect URL response, multi-tenant prefix prepending (`SNAPB-2002`), preserving `item_details` and `customer_details`.
- **Audit Log Queries (5 Test Cases)**: Create log entry on webhook ingress, filter by `tenant_id`, filter by status (`DISPATCHED`), pagination (`page` & `limit`), detailed log inspection by ID.

### Tier 2: Boundary & Corner Cases (9 Test Cases)
Tests edge cases, bad inputs, signature mismatches, and target failures:
- Reject webhooks with invalid SHA-512 signatures (`401 Unauthorized`).
- Handle unmapped Order ID prefixes (`UNKNOWN-9999` -> `400 Bad Request`).
- Ensure target website 500 errors / offline status return immediate non-blocking `200 OK` to Midtrans.
- Reject empty or malformed JSON payloads (`400 Bad Request`).
- Reject webhooks missing required signature parameters.
- Reject Snap token requests with zero or negative `gross_amount`.
- Reject Snap token requests missing Authorization headers or using invalid/revoked API keys (`401 Unauthorized`).

### Tier 3: Cross-Feature Combinations (3 Test Cases)
Tests multi-system interactions, concurrent operations, and state machine transitions:
- **Concurrent Multi-Tenant Webhooks**: Process 10 simultaneous webhook dispatches for `CONCA` and `CONCB` in parallel without cross-tenant data leakage or signature corruption.
- **Manual Retry API & State Updates**: Trigger `POST /api/admin/audit-logs/:id/retry` for a previously failed audit log, verifying re-delivery to target server and state transition from `FAILED` to `DISPATCHED`.
- **Webhook Secret Key Rotation**: Rotate tenant `webhook_secret` via Admin API and verify subsequent dispatches use the updated secret for `X-Bridge-Signature` calculation.

### Tier 4: Real-World Application Workflows (4 Test Cases)
Simulates end-to-end e-commerce store operations:
- **T4_E2E_01: Complete Happy-Path E2E Workflow**: Full lifecycle from Tenant Setup -> Snap Token Request -> Webhook Settlement -> SHA-512 Verification -> Target Forwarding with `X-Bridge-Signature` -> Audit Log Confirmation.
- **T4_E2E_02: Target Downtime & Manual Recovery Workflow**: Simulates store outage, failed webhook dispatch, target recovery, manual retry API execution, and audit log status updating to `DISPATCHED`.
- **T4_E2E_03: Multi-Tenant Interleaved Traffic & Security Isolation**: Interleaved stream of webhooks across multiple tenants, verifying strict URL routing isolation, secret key isolation, and audit log search isolation.
- **T4_E2E_04: Snap Token to Settlement End-to-End Audit Trail**: Complete verification of transaction consistency from token generation through payment settlement.

---

## 3. Test Runner Architecture

The test suite is built with zero external runtime dependencies using Node.js native standard libraries (`node:http`, `node:crypto`, `node:assert`, `fetch`):

```
tests/
├── run-e2e.js                    # Master CLI test runner
└── e2e/
    ├── helpers/
    │   ├── crypto-utils.js       # SHA-512 & HMAC-SHA256 signature helpers
    │   ├── mock-target.js        # Standalone HTTP Mock Target Website server (Port 9999)
    │   ├── mock-midtrans.js      # Standalone HTTP Mock Midtrans Snap API server (Port 9998)
    │   ├── mock-bridge-server.js # Standalone Embedded Mock Bridge server (Port 3000)
    │   ├── test-client.js        # HTTP API client for Bridge endpoints
    │   └── test-framework.js     # Lightweight test runner & assertion framework
    ├── tier1-feature-coverage/
    │   ├── tenant-crud.test.js
    │   ├── signature-validation.test.js
    │   ├── prefix-routing.test.js
    │   ├── snap-proxy.test.js
    │   └── audit-logs.test.js
    ├── tier2-boundary-corner/
    │   └── boundary-cases.test.js
    ├── tier3-cross-feature/
    │   └── cross-feature.test.js
    └── tier4-real-world/
        └── real-world-workflows.test.js
```

### Execution Modes
1. **Embedded Mock Mode (Default)**: Automatically spins up mock target website server, mock Midtrans Snap server, and embedded mock Bridge server. Ideal for zero-dependency standalone validation.
   ```bash
   node tests/run-e2e.js
   # or
   npm test
   ```

2. **Live Backend Testing Mode**: Executes the test suite against a running production/dev Fastify backend server.
   ```bash
   BRIDGE_URL=http://localhost:3000 node tests/run-e2e.js
   ```

---

## 4. Coverage & Verification Goals

- **Total Test Cases**: 48 Test Cases
- **Feature Coverage Target**: 100% of functional requirements (R1, R2, R3)
- **Assertion Strictness**: Real HTTP status checks, raw cryptographic signature verification, JSON payload structure validation, timing/latency assertions, and audit log state checks.
