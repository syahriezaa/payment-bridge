# Project: Midtrans Multi-Tenant Payment Bridge

## Architecture
- **Type**: Multi-tenant Webhook Ingress, Routing Engine, and Admin Management Dashboard.
- **Backend Stack**: Node.js + TypeScript, Fastify HTTP Server, SQLite Database for tenant config, routes, and audit logs.
- **Frontend Stack**: Vite + React + Tailwind CSS + Lucide Icons for Web Admin Dashboard UI.
- **Key Modules**:
  - `Webhook Ingress & Validator`: `POST /api/webhooks/midtrans` — signature verification (`SHA512(order_id + status_code + gross_amount + ServerKey)`), order prefix parsing.
  - `Dispatch Engine & Async Queue`: Resilient HTTP client with exponential backoff retries (up to 5 retries), custom HMAC-SHA256 signature (`X-Bridge-Signature`) header generation.
  - `Snap Proxy Helper`: `POST /api/v1/snap/token` — prepends target website prefix to Order ID and proxies request to Midtrans Snap API.
  - `Admin Management API & UI`: Target website CRUD (`/api/admin/tenants`), Order ID prefix mapping rules (`/api/admin/rules`), Webhook audit log viewer (`/api/admin/audit-logs`), manual retry trigger (`POST /api/admin/audit-logs/:id/retry`), and integration guides.

## Code Layout
```
d:/bridge/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts                 # Fastify entrypoint
│   ├── config.ts                 # Env vars & configuration
│   ├── db/                       # Database schema & client (SQLite)
│   ├── services/
│   │   ├── signature.ts          # SHA512 & HMAC-SHA256 signature verification/signing
│   │   ├── router.ts             # Order ID prefix resolution engine
│   │   ├── dispatcher.ts         # Async dispatch worker & backoff retry logic
│   │   ├── snap.ts               # Snap Payment Proxy helper
│   │   └── audit.ts              # Webhook audit logger
│   └── routes/
│       ├── webhook.ts            # POST /api/webhooks/midtrans
│       ├── admin.ts              # Dashboard CRUD & audit log API endpoints
│       └── snap.ts               # POST /api/v1/snap/token
├── web/                          # Vite + React Admin Dashboard
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── TenantManager.tsx
│       │   ├── AuditLogsViewer.tsx
│       │   ├── IntegrationGuide.tsx
│       │   └── DashboardHeader.tsx
│       └── services/api.ts
└── tests/
    ├── unit/                     # Signature, Router, Retry tests
    ├── integration/              # Webhook ingress & Proxy tests
    └── e2e/                      # Opaque-box E2E test suite (Tiers 1-4)
```

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Testing Suite | Requirements-driven E2E test infra & suite (Tiers 1-4) publishing `TEST_READY.md` | none | DONE |
| 2 | Backend Core Engine | Node/TS + Fastify server, DB schema, Webhook Ingress, SHA512 verification, Order ID router, async retries, Snap Proxy | none | DONE |
| 3 | Admin Dashboard UI & API | Vite + React + Tailwind frontend & admin CRUD / audit log / manual retry / guide endpoints | M2 | DONE |
| 4 | Final E2E Pass & Hardening | Run E2E test suite until 100% pass + Tier 5 adversarial testing & Forensic Audit | M1, M2, M3 | DONE |

## Interface Contracts
### Webhook Ingress
- Endpoint: `POST /api/webhooks/midtrans`
- Header: `Content-Type: application/json`
- Signature rule: `SHA512(order_id + status_code + gross_amount + ServerKey)`
- Response: `200 OK { "status": "received", "audit_id": "<id>" }` (Immediate response to Midtrans, routing processed asynchronously)

### Target Forwarding Request
- Target URL: Resolved from Order ID prefix rule
- Header: `X-Bridge-Signature: HMAC-SHA256(payload_body, target_webhook_secret)`
- Payload: Full Midtrans webhook JSON body verbatim

### Snap Proxy API
- Endpoint: `POST /api/v1/snap/token`
- Header: `Authorization: Bearer <Bridge_Tenant_API_Key>`
- Body: `{ "order_id": "1001", "gross_amount": 50000, "customer_details": {...} }`
- Behavior: Automatically transforms `order_id` to `<TENANT_PREFIX>-1001` before requesting Snap Token from Midtrans.
