# Security Specification Document — Agiliza Platform

> **Version**: 1.0.0  
> **Status**: Approved for Implementation  
> **Author**: Security Specialist Agent  
> **Last Updated**: 2026-07-25  
> **Related**: `docs/sdd.md`, `specs/*.spec.md`

---

## Table of Contents

1. [Threat Model (STRIDE per Component)](#1-threat-model-stride-per-component)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Data Protection & LGPD Compliance](#3-data-protection--lgpd-compliance)
4. [Webhook Security](#4-webhook-security)
5. [API Security](#5-api-security)
6. [Infrastructure Security](#6-infrastructure-security)
7. [Security Test Cases (Given/When/Then)](#7-security-test-cases-givenwhenthen)
8. [Secrets Management](#8-secrets-management)
9. [Security Checklist for Deployment](#9-security-checklist-for-deployment)
10. [OWASP Top 10 Compliance Matrix](#10-owasp-top-10-compliance-matrix)
11. [Incident Response Plan](#11-incident-response-plan)
12. [Security Dependencies & Versions](#12-security-dependencies--versions)

---

## 1. Threat Model (STRIDE per Component)

### 1.1 Backend (Fastify API)

| Threat Category | Risk | Mitigation | OWASP Ref |
|---|---|---|---|
| **S**poofing | Attacker impersonates a tenant or B2B user | JWT (access + refresh tokens) for dashboard; API Key (bearer `X-API-Key` header) for B2B programmatic access; mTLS for internal service-to-service | **A07** |
| **T**ampering | Attacker modifies request payload in transit | TLS 1.3 enforced on all endpoints; Zod schema validation on every input boundary (routes, queues, webhooks); request body size limits | **A03** |
| **R**epudiation | Tenant denies having made a request | Structured audit logging of all authenticated requests (method, path, tenantId, userId, timestamp); DecisionLog immutable append-only; raw webhook payloads preserved in Payment.metadata | **A09** |
| **I**nformation Disclosure | PII leaked via error messages, logs, or API responses | Zod-stripped error messages (no internal details); Structured JSON logs never contain raw PII — only `{tenantId, clientId}` references; CSP + helmet headers; Output sanitization on all endpoints | **A02**, **A05** |
| **D**enial of Service | Attacker floods API with requests | Rate limiting: 100 req/min per tenant (API), 20 req/min (auth/login), 10 req/s (webhooks); BullMQ queues with concurrency limits; Connection pooling (max 20 per instance); Memory limits on Docker containers | **A04** |
| **E**levation of Privilege | Tenant A accesses Tenant B's data | `tenantId` filter enforced in ALL repository queries (never omitted); Cross-tenant access returns 403 Forbidden; Authorization middleware checks tenant ownership for every resource | **A01** |

### 1.2 Database (PostgreSQL)

| Threat Category | Risk | Mitigation |
|---|---|---|
| **S**poofing | Attacker connects as unauthorized DB user | TLS connection enforced (`sslmode=require`); Separate database users for app (read/write own schema) vs migrations (DDL); No password in connection string — uses env vars |
| **T**ampering | Attacker modifies data via SQL injection | Prisma ORM uses parameterized queries natively (no raw SQL concatenation); Zod validation blocks malicious input before reaching DB; All user input goes through Zod → DTO → Prisma |
| **R**epudiation | Admin denies having deleted records | Append-only event log (`events` table is immutable — no UPDATE/DELETE); Database audit triggers for sensitive tables (clients, payment_provider_configs) |
| **I**nformation Disclosure | PII leaked in database breach | AES-256-GCM encryption for PII columns: `client.name`, `client.phone`, `client.email`, `tenant.taxId`, `tenant.email`, `tenant.phone`; API keys encrypted at rest in `PaymentProviderConfig`; Encryption keys stored in env vars, never in DB |
| **D**enial of Service | Attacker runs expensive queries | Connection pool limits (max 20); Query timeouts (30s); Indexed all query patterns per SDD; Rate limiting prevents excessive API calls |
| **E**levation of Privilege | Attacker reads other tenants' data | Row-Level Security (RLS) via `tenantId` on all tenant-scoped tables; Repository layer always filters by `tenantId` from authenticated context |

### 1.3 Redis

| Threat Category | Risk | Mitigation |
|---|---|---|
| **S**poofing | Attacker connects to Redis without auth | `REDIS_PASSWORD` required (`requirepass`); Network isolated to Docker internal network (no exposed ports in production) |
| **T**ampering | Attacker modifies cached decision data | No sensitive data cached; `decision:*` and `risk:*` caches are recalculated from source of truth; Cache keys include `tenantId` prefix |
| **I**nformation Disclosure | Session data exposed | No PII stored in Redis; `session:{evolutionInstance}` stores only non-sensitive connection state; `pix-qrcode:{invoiceId}` stores only QR code image (no raw payment data) |
| **D**enial of Service | Cache flooding | Key TTLs enforced (5min to 24h); Memory limits (`maxmemory` + `maxmemory-policy allkeys-lru`) |
| **E**levation of Privilege | Cross-tenant cache access | Cache keys prefixed with `tenantId` where applicable; Auth layer validates tenant before cache lookup |

### 1.4 Evolution API (WhatsApp Provider)

| Threat Category | Risk | Mitigation |
|---|---|---|
| **S**poofing | Fake webhooks from untrusted source | Static API key authentication on webhook endpoint; IP whitelist (Evolution API known ranges); Webhook URL signing between backend and Evolution instance |
| **T**ampering | Message content modified in transit | TLS 1.3 for all Evolution API HTTP calls; Session data encryption between backend and Evolution API |
| **I**nformation Disclosure | Message content leaked | Message body not persisted beyond delivery (stored only in transient `Message.content` for audit, encrypted at rest); No logging of raw message content |
| **D**enial of Service | Webhook flooding | Rate limit: 10 req/s on `/api/webhooks/evolution`; Payload size limits; Queue-based processing decouples ingestion from business logic |
| **E**levation of Privilege | Evolution instance hijacked | API key per tenant instance; Session tokens rotated periodically; QR code connection flow requires tenant authentication |

### 1.5 Payment Providers (Asaas, Mercado Pago, PagBank, Polar)

| Threat Category | Risk | Mitigation |
|---|---|---|
| **S**poofing | Fake payment webhooks | HMAC-SHA256 signature verification for every provider webhook; Each provider has its own verification strategy (see section 4); Webhook secrets stored encrypted at rest |
| **T**ampering | Payment data modified | Webhook payload validation via Zod before processing; Idempotency keys prevent duplicate processing; `externalPaymentId` uniqueness constraint per provider |
| **I**nformation Disclosure | Card/PIX data leaked | Tokenized payment data only (never store raw card numbers); PIX QR codes transient (stored until expiry); API keys encrypted at rest |
| **D**enial of Service | Payment callback flooding | Rate limit: 10 req/s per provider on webhook endpoints; Payload validation rejects malformed requests immediately; Queue decoupling |

### 1.6 Frontend (Next.js)

| Threat Category | Risk | Mitigation |
|---|---|---|
| **S**poofing | XSS used to steal session tokens | React JSX auto-escapes output; CSP headers prevent inline script execution; `X-Content-Type-Options: nosniff`; No `dangerouslySetInnerHTML` unless audited |
| **T**ampering | Form data manipulated client-side | All API requests validated server-side by Zod (client-side validation is UX only, not security); API never trusts client-provided `tenantId` — derives from auth context |
| **I**nformation Disclosure | API keys in client bundle | Zero API keys in `NEXT_PUBLIC_*` variables; Frontend calls backend API only (never directly to payment providers or Evolution); No secrets in client-side code |
| **D**enial of Service | Client-side resource exhaustion | Image optimization via Next.js (sharp); Lazy loading for report pages; Pagination for all list views |
| **E**levation of Privilege | Route access bypass | API authorization is server-side only; Frontend routes are cosmetic — all permission checks happen on backend |

---

## 2. Authentication & Authorization

### 2.1 Authentication Schemes

| Scheme | Audience | Header | Token Format | Expiry |
|---|---|---|---|---|
| **JWT (Dashboard)** | B2B users (human) | `Authorization: Bearer <token>` | `access_token` (15min) + `refresh_token` (7d) | Short-lived access + rotating refresh |
| **API Key (B2B)** | Programmatic / integrations | `X-API-Key: <key>` | UUID v4 (generated per tenant, stored as bcrypt hash) | Long-lived, revocable |
| **Magic Link** | End clients (B2C) | `Authorization: Bearer <token>` | One-time JWT (5min expiry) | Single-use |

### 2.2 Authorization — Scope-Based (RBAC)

```typescript
// Scope definitions (mapped to JWT claims or API Key permissions)
type PermissionScope =
  | 'clients:read'
  | 'clients:write'
  | 'invoices:read'
  | 'invoices:write'
  | 'payments:read'
  | 'payments:write'
  | 'messages:read'
  | 'messages:write'
  | 'reports:read'
  | 'settings:read'
  | 'settings:write'
  | 'webhooks:manage'

// Default role-permission mapping (MVP)
const RBAC_MAP = {
  owner: [
    'clients:read', 'clients:write',
    'invoices:read', 'invoices:write',
    'payments:read', 'payments:write',
    'messages:read', 'messages:write',
    'reports:read',
    'settings:read', 'settings:write',
    'webhooks:manage',
  ],
  user: [
    'clients:read', 'clients:write',
    'invoices:read', 'invoices:write',
    'payments:read',
    'messages:read', 'messages:write',
    'reports:read',
    'settings:read',
  ],
}
```

### 2.3 Tenant Isolation Enforcement

```typescript
// Every repository method MUST include tenantId filter
// src/infrastructure/database/repositories/prisma-client.repository.ts
class PrismaClientRepository implements ClientRepository {
  async findById(id: string, tenantId: string): Promise<Client | null> {
    return this.prisma.client.findFirst({
      where: { id, tenantId },  // <-- tenantId ALWAYS present
    })
  }

  async list(query: ListClientsQuery, tenantId: string): Promise<PaginatedResult<Client>> {
    return this.prisma.client.findMany({
      where: { ...query, tenantId },  // <-- tenantId ALWAYS present
    })
  }
}
```

> **VETO RULE**: Any repository query that does not include `tenantId` in the WHERE clause will be **BLOCKED** during code review. This is a non-negotiable security invariant.

### 2.4 Rate Limiting

| Endpoint Group | Limit | Window | Scope |
|---|---|---|---|
| **API endpoints** | 100 req/min | 1 min | Per tenant + per IP |
| **Auth (login, register)** | 20 req/min | 1 min | Per IP |
| **Webhooks payment** | 10 req/s | 1 sec | Per provider endpoint |
| **Webhooks evolution** | 10 req/s | 1 sec | Global |
| **Report generation** | 10 req/min | 1 min | Per tenant |
| **Decision API** | 200 req/min | 1 min | Per tenant |

Implementation via `@fastify/rate-limit` with Redis store:

```typescript
// src/presentation/index.ts
import rateLimit from '@fastify/rate-limit'

app.register(rateLimit, {
  redis: redisClient,
  global: false,                // Per-route configuration
  max: 100,                     // Default
  timeWindow: '1 minute',
  keyGenerator: (request) => {
    return request.tenantId || request.ip
  },
})
```

---

## 3. Data Protection & LGPD Compliance

### 3.1 PII Inventory

| Entity | PII Fields | Encryption | Masked in Logs | Retention |
|---|---|---|---|---|
| **Tenant** | name, taxId, email, phone | AES-256-GCM | `{name: "Acad***"}` | 5 years after contract end |
| **Client** | name, phone, email | AES-256-GCM | `{phone: "****8888"}` | 5 years after last invoice |
| **PaymentProviderConfig** | apiKey, webhookSecret | AES-256-GCM | `{apiKey: "asaas_***abc"}` | Until provider config deleted |
| **Invoice** | pixQrCode (base64 image) | None (transient) | N/A | 90 days (QR expiry) |
| **Message** | content | AES-256-GCM at rest | `{content: "Lembrete de pagamento"}` | 2 years |
| **Event** | metadata (may contain PII) | No (audit trail) | No PII should reach events | 90 days raw, aggregated forever |

### 3.2 Encryption Implementation

```typescript
// src/infrastructure/crypto/aes-crypto.provider.ts
// AES-256-GCM encryption for PII fields using pgcrypto (DB-level) or Node crypto (app-level)

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')  // 32 bytes hex
const IV_LENGTH = 16
const TAG_LENGTH = 16

class AesCryptoProvider implements CryptoPort {
  encrypt(plaintext: string): EncryptedData {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, KEY, iv)
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
    }
  }

  decrypt(data: EncryptedData): string {
    const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(data.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(data.tag, 'hex'))
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }
}

// DB-level approach using pgcrypto extension:
// UPDATE clients SET
//   name_encrypted = pgp_sym_encrypt($1, current_setting('enc.key')),
//   phone_encrypted = pgp_sym_encrypt($2, current_setting('enc.key'))
// WHERE id = $3;
```

> **RECOMMENDATION**: Use Prisma middleware to auto-encrypt/decrypt PII fields at the repository boundary, keeping encryption logic out of use cases.

### 3.3 LGPD Compliance

#### 3.3.1 Right to Deletion (Art. 18, II)

```typescript
// DELETE /api/clients/:id — Full client erasure
// Cascade deletes: client → invoices (anonymized) → payments (anonymized) → messages → decision_logs → events
//
// Implementation: Instead of true DELETE, anonymize PII fields:
//   name → "DELETADO"
//   phone → "00000000000"
//   email → NULL
//   metadata → NULL
// This preserves referential integrity for financial audit while removing PII.

class DeleteClientUseCase {
  async execute(input: DeleteClientInput): Promise<Either<DomainError, void>> {
    // ... validate tenant ownership ...
    return this.uow.run(async () => {
      await this.clientRepo.anonymize(input.clientId, input.tenantId)
      await this.eventBus.publish(new ClientDeletedEvent(input.clientId, input.tenantId))
    })
  }
}
```

#### 3.3.2 Consent Tracking

```typescript
// Client model includes:
//   consentGivenAt: DateTime?
//   consentVersion: String?      // "v1_2026-07"
//   marketingOptOut: Boolean @default(false)
//   dataShareOptOut: Boolean @default(false)
//
// Consent is recorded during onboarding (3-question flow)
// Consent records stored in append-only `consent_logs` table:
// model ConsentLog {
//   id         String   @id @default(uuid())
//   clientId   String
//   tenantId   String
//   action     String   // "granted" | "revoked" | "updated"
//   version    String
//   ipAddress  String?
//   userAgent  String?
//   createdAt  DateTime @default(now())
// }
```

#### 3.3.3 Data Retention Policy

| Data Category | Retention Period | Disposal Method |
|---|---|---|
| Client PII | 5 years after last invoice | Anonymization (field overwrite) |
| Tenant data | 5 years after contract end | Anonymization |
| Payment records | 5 years (tax compliance) | Kept with anonymized client ref |
| Event logs (raw) | 90 days | Auto-delete via cron |
| Message content | 2 years | Anonymization |
| Decision logs | 3 years | Keep (no PII by design) |
| Session data | Until logout + 24h | TTL expiry |

### 3.4 Logging & PII Masking

```typescript
// src/config/logger.ts
const piiPatterns = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,     // CPF → ***.***.***-**
  /\b\d{2}\.?\d{3}\.?\d{3}\/\d{4}-?\d{2}\b/g, // CNPJ → **.***.***/****-**
  /\b\d{10,11}\b/g,                            // Phone → ****8888
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email → ***@***.com
]

function maskPII(message: string): string {
  return piiPatterns.reduce((msg, pattern) => {
    return msg.replace(pattern, (match) => {
      if (match.includes('@')) {
        const [local, domain] = match.split('@')
        return `${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`
      }
      return match.length <= 4 ? match : '*'.repeat(match.length - 4) + match.slice(-4)
    })
  }, message)
}

const logger = pino({
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      tenantId: req.tenantId,
      userId: req.userId,
      // NO: headers, body, query params (may contain PII)
    }),
    err: pino.stdSerializers.err,
  },
  formatters: {
    level: (label) => ({ level: label }),
    log: (obj) => {
      if (obj.msg) obj.msg = maskPII(obj.msg)
      return obj
    },
  },
})
```

---

## 4. Webhook Security

### 4.1 Payment Webhooks — HMAC Signature Verification

Each payment provider has a unique signature verification strategy. All must be implemented before the webhook handler processes the event.

| Provider | Header | Algorithm | Implementation |
|---|---|---|---|
| **Asaas** | `x-asaas-signature` | HMAC-SHA256 (body + secret) | `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')` |
| **Mercado Pago** | `x-signature` | HMAC-SHA256 (combined params) | Parse `ts` and `v1` from header; `hmac(ts + '.' + body, secret)` |
| **PagBank** | `x-pagbank-signature` | HMAC-SHA256 (body + secret) | `crypto.createHmac('sha256', secret).update(rawBody).digest('base64')` |
| **Polar** | `webhook-id` + `webhook-timestamp` + `webhook-signature` | HMAC-SHA256 (`id.timestamp.body`) | `crypto.createHmac('sha256', secret).update(msgId + '.' + timestamp + '.' + body).digest('base64')` |

```typescript
// src/infrastructure/payment/webhook-verifier.ts
// Generic HMAC verifier used by all provider handlers

interface WebhookVerifier {
  verify(payload: { rawBody: string; headers: Record<string, string>; secret: string }): boolean
}

const asaasVerifier: WebhookVerifier = {
  verify({ rawBody, headers, secret }) {
    const signature = headers['x-asaas-signature']
    if (!signature) return false
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  },
}

// Apply Zod validation AFTER signature verification (reject malformed first)
// NEVER process a webhook event before verifying its signature
```

### 4.2 Evolution API Webhook Security

```typescript
// POST /api/webhooks/evolution
// Security: Static API Key (X-API-Key header) + optional IP whitelist

const EVOLUTION_ALLOWED_IPS = process.env.EVOLUTION_ALLOWED_IPS
  ? process.env.EVOLUTION_ALLOWED_IPS.split(',')
  : []

async function evolutionWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  // 1. API Key check
  const apiKey = request.headers['x-api-key']
  if (apiKey !== process.env.EVOLUTION_WEBHOOK_KEY) {
    return reply.status(401).send({ error: 'Invalid API key' })
  }

  // 2. IP whitelist check (if configured)
  if (EVOLUTION_ALLOWED_IPS.length > 0) {
    if (!EVOLUTION_ALLOWED_IPS.includes(request.ip)) {
      return reply.status(403).send({ error: 'IP not allowed' })
    }
  }

  // 3. Zod validation
  const parsed = evolutionWebhookSchema.parse(request.body)

  // 4. Enqueue for processing
  await messageQueue.add('track-delivery', parsed)

  return { received: true }
}
```

### 4.3 Webhook Processing Pipeline

```
HTTP Request
    │
    ▼
┌─────────────────────┐
│ Fastify Route       │  ← Validates HTTP method, content-type
│                     │     Parses raw body (required for HMAC)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Provider Router     │  ← Routes to correct provider handler based on
│                     │     :provider param or URL path
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ HMAC Verification   │  ← REJECT with 401 if invalid signature
│                     │     (timing-safe comparison required)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Zod Payload Schema  │  ← Validate structure (reject malformed)
│                     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Normalize Event     │  ← Convert to internal format
│                     │     { eventType, providerPaymentId, amount, status }
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Enqueue BullMQ Job  │  ← ACK to provider immediately (< 100ms)
│                     │     Processing continues async
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ ReconcilePayment    │  ← Retry: 3 attempts, exponential backoff
│ UseCase (Worker)    │     DLQ after 3 failures
└─────────────────────┘
```

### 4.4 Webhook Retry Policy

| Queue | Max Retries | Backoff | DLQ Strategy |
|---|---|---|---|
| `reconcile-payment` | 3 | 10s → 30s → 90s (exponential) | Save payload to `dead_letter_webhooks` table + alert |
| `track-message-delivery` | 3 | 5s → 15s → 45s | Log error + ignore (non-critical) |
| `process-payment` | 3 | 10s → 60s → 300s | Alert on-call + save to DLQ |

---

## 5. API Security

### 5.1 Endpoint Security Matrix

| Endpoint | Auth Required | Rate Limit | CORS | Notes |
|---|---|---|---|---|
| `GET /api/health` | ❌ | ❌ | ❌ | Health check only — no data returned |
| `POST /api/auth/login` | ❌ | 20/min/IP | ✅ | Rate limit prevents brute force |
| `POST /api/auth/refresh` | ❌ | 20/min/IP | ✅ | |
| ALL `/api/*` (authenticated) | ✅ JWT or API Key | 100/min/tenant | ✅ | Includes all business endpoints |
| `POST /api/webhooks/payment/*` | ✅ HMAC | 10/s | ❌ (public) | Signature verification, not JWT |
| `POST /api/webhooks/evolution` | ✅ API Key | 10/s | ❌ (public) | Key + optional IP whitelist |

### 5.2 Security Headers (Helmet.js)

```typescript
// src/presentation/index.ts
import helmet from '@fastify/helmet'

app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Next.js needs inline scripts
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL!],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,  // Next.js needs this off
  crossOriginResourcePolicy: { policy: 'same-origin' },
  hsts: {
    maxAge: 31536000,              // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xFrameOptions: { action: 'deny' },
  xContentTypeOptions: { nosniff: true },
  xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
})
```

### 5.3 CORS Configuration

```typescript
import cors from '@fastify/cors'

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL!,                              // Production frontend
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000', 'http://localhost:3333']
    : []),
]

app.register(cors, {
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400,  // Preflight cache: 24h
})
```

### 5.4 Input Validation (Zod)

All external input MUST be validated with Zod schemas before reaching any use case. This applies to:

- ✅ API request bodies (all POST/PUT/PATCH routes)
- ✅ API query parameters (all GET routes with params)
- ✅ Webhook payloads (payment + evolution)
- ✅ BullMQ job payloads (queued messages, payment events)
- ❌ Internal domain events (emitted by trusted code, no validation needed)

```typescript
// Zod validation happens in the route handler, BEFORE use case execution:
// src/presentation/routes/client.routes.ts

app.post<{ Body: CreateClientDTO }>('/api/clients', {
  schema: {
    body: createClientSchema,  // Zod schema
  },
  preHandler: [authenticate, authorize('clients:write')],
}, async (request, reply) => {
  // request.body is already validated and typed
  const result = await createClientFactory().execute({
    ...request.body,
    tenantId: request.tenantId,  // From auth context, NOT from body
  })
  // ...
})
```

### 5.5 Output Sanitization

```typescript
// Never leak internal error details to the client
// src/presentation/handler.ts

app.setErrorHandler((error, request, reply) => {
  // Log full error internally (without PII)
  request.log.error({ err: error, tenantId: request.tenantId }, 'Request failed')

  // Return safe error to client
  const statusCode = error.statusCode || 500
  const response = {
    error: {
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : error.code || 'UNKNOWN_ERROR',
      message: statusCode >= 500
        ? 'An unexpected error occurred'
        : error.message,
    },
  }

  // Never expose stack traces in production
  if (process.env.NODE_ENV !== 'production') {
    (response.error as any).stack = error.stack
  }

  return reply.status(statusCode).send(response)
})
```

---

## 6. Infrastructure Security

### 6.1 Docker Security

```yaml
# docker/docker-compose.dev.yml — complemented by production overrides

services:
  backend:
    build:
      context: ..
      dockerfile: apps/backend/Dockerfile
    user: "node:node"                    # Non-root user
    read_only: true                       # Read-only root filesystem
    security_opt:
      - no-new-privileges:true           # Prevent privilege escalation
    cap_drop:
      - ALL                               # Drop all capabilities
    cap_add:
      - NET_BIND_SERVICE                  # Only need to bind to port
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    ports:
      - "3333:3333"
    mem_limit: 512m                       # Memory limit
    mem_reservation: 256m
    cpus: 1.0
    restart: unless-stopped
    networks:
      - internal                          # Internal network only
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3333/api/health')"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16-alpine
    user: "postgres:postgres"
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - internal
    mem_limit: 1g
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    networks:
      - internal
    mem_limit: 512m

networks:
  internal:
    driver: bridge
    internal: true                       # No external access

secrets:
  db_password:
    file: ./secrets/db_password.txt     # Not in git
```

### 6.2 Network Security

```
Production Network Topology:

Internet
   │
   ▼
┌─────────────┐     Ports 80/443 only
│  Load       │
│  Balancer   │───► Frontend (Next.js)
└─────────────┘     │
                    │
                    ▼
               Backend (Fastify)
                    │
                    ├──► PostgreSQL (internal:5432 — NEVER exposed)
                    ├──► Redis (internal:6379 — NEVER exposed)
                    └──► Evolution API (internal or via VPN)
```

### 6.3 Secrets Management

| Secret | Storage | Rotation | Access |
|---|---|---|---|
| `DATABASE_URL` | Env var (CI/CD secret) | Quarterly | Backend only |
| `REDIS_PASSWORD` | Env var (CI/CD secret) | Quarterly | Backend only |
| `JWT_SECRET` | Env var (CI/CD secret) | Monthly | Backend only |
| `ENCRYPTION_KEY` | Env var (CI/CD secret) | Manual (key rotation procedure) | Backend only |
| `EVOLUTION_API_KEY` | Env var (CI/CD secret) | Per instance | Backend + Evolution |
| `ASAAS_API_KEY` | Encrypted in DB (AES-256-GCM) | Per tenant rotation | Per-tenant gateway |
| Webhook secrets | Encrypted in DB (AES-256-GCM) | Per tenant rotation | Per-tenant gateway |
| TLS certificates | Let's Encrypt (auto-renew) | 90 days | Public |

### 6.4 Dependency Security

```yaml
# .github/workflows/security.yml
name: Security Scan
on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday 06:00 UTC

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm audit --audit-level=high
      - run: npx better-npm-audit audit  # Customizable thresholds

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: GitLeaks
        uses: gitleaks/gitleaks-action@v2
        with:
          config-path: .gitleaks.toml

  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: ESLint Security
        run: npx eslint . --ext .ts,.tsx --config .eslintrc.security.js
        continue-on-error: false  # Break CI on security regressions
```

### 6.5 Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.1
    hooks:
      - id: gitleaks
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: check-added-large-files
        args: ['--maxkb=500']
      - id: check-merge-conflict
      - id: detect-private-key
```

---

## 7. Security Test Cases (Given/When/Then)

All test cases below are intended for the **QA Engineer** and **Fullstack Engineer** to implement as automated tests. Each test maps to an OWASP Top 10 item for compliance traceability.

### 7.1 Test Case SEC-01: Missing Authentication → 401

**OWASP Ref**: A07 (Identification and Authentication Failures)

```gherkin
Feature: API Authentication
  All protected endpoints must reject unauthenticated requests.

  Scenario: Missing auth token
    Given no authentication token
    When calling POST /api/clients with valid client data
    Then the response status is 401 Unauthorized
    And the response body contains error code "UNAUTHORIZED"

  Scenario: Invalid auth token
    Given an invalid JWT token "eyJ.invalid.token"
    When calling GET /api/clients with Authorization header "Bearer eyJ.invalid.token"
    Then the response status is 401 Unauthorized

  Scenario: Expired auth token
    Given a JWT token that expired 1 hour ago
    When calling GET /api/invoices with the expired token
    Then the response status is 401 Unauthorized

  Scenario: Health endpoint does not require auth
    Given no authentication token
    When calling GET /api/health
    Then the response status is 200 OK
```

### 7.2 Test Case SEC-02: Webhook HMAC Validation

**OWASP Ref**: A08 (Software and Data Integrity Failures)

```gherkin
Feature: Payment Webhook HMAC Validation
  Every payment webhook must have its HMAC signature verified before processing.

  Scenario: Valid HMAC signature (Asaas)
    Given a valid Asaas webhook payload
    And the correct webhook secret for this tenant
    When POST to /api/webhooks/payment/asaas with:
      | header x-asaas-signature | valid_hmac |
      | body                     | valid_payload |
    Then the response status is 200 OK
    And the payment reconciliation job is enqueued

  Scenario: Invalid HMAC signature
    Given a webhook payload
    And an incorrect HMAC signature
    When POST to /api/webhooks/payment/asaas with header x-asaas-signature = "invalid"
    Then the response status is 401 Unauthorized
    And no reconciliation job is enqueued

  Scenario: Missing HMAC header
    Given a valid webhook payload
    And no HMAC signature header
    When POST to /api/webhooks/payment/asaas
    Then the response status is 401 Unauthorized

  Scenario: Replay attack (same payload twice)
    Given a previously processed webhook payload
    When POST to /api/webhooks/payment/asaas with the same payload
    Then the response status is 200 OK (idempotent)
    And no duplicate reconciliation job is created
```

### 7.3 Test Case SEC-03: Rate Limiting → 429

**OWASP Ref**: A04 (Insecure Design)

```gherkin
Feature: Rate Limiting
  API endpoints must enforce rate limits per tenant.

  Scenario: Exceeding rate limit on API endpoints
    Given a tenant with rate limit of 100 req/min
    When the tenant sends 101 requests in 1 minute to GET /api/clients
    Then the 101st request returns status 429 Too Many Requests
    And the response body contains error code "RATE_LIMITED"
    And the Retry-After header is present

  Scenario: Rate limit resets after window
    Given a tenant that exceeded rate limit
    When waiting 1 minute
    And sending a new request to GET /api/clients
    Then the response status is 200 OK

  Scenario: Different tenants have independent rate limits
    Given tenant A and tenant B
    When tenant A sends 101 requests (exceeding limit)
    Then tenant A's 101st request is 429
    And tenant B's first request is 200 OK

  Scenario: Login endpoint has stricter rate limit
    Given an IP address
    When sending 21 login attempts in 1 minute
    Then the 21st login attempt returns 429 Too Many Requests
```

### 7.4 Test Case SEC-04: SQL Injection Prevention

**OWASP Ref**: A03 (Injection)

```gherkin
Feature: SQL Injection Prevention
  All database queries must use parameterized queries (Prisma ORM).

  Scenario: SQL injection in client name
    Given a malicious payload
    When creating a client with name = "João'; DROP TABLE clients; --"
    Then the client is created normally (name is stored as-is)
    And the clients table still exists
    And subsequent queries work normally

  Scenario: SQL injection in search parameter
    Given a malicious search string
    When calling GET /api/clients?search="' OR 1=1 --"
    Then only authorized clients are returned (no data leak)
    And the search is treated as a literal string

  Scenario: NoSQL-style injection via JSONB
    Given a malicious metadata payload
    When creating an invoice with metadata = { "$gt": "" }
    Then the metadata is stored as a literal JSON object
    And no injection occurs in JSONB queries
```

### 7.5 Test Case SEC-05: PII Encryption at Rest

**OWASP Ref**: A02 (Cryptographic Failures)

```gherkin
Feature: PII Encryption at Rest
  Sensitive PII fields must be encrypted in the database.

  Scenario: Client phone is encrypted at rest
    Given a client with phone = "5511999998888"
    When querying the database directly (bypassing the app)
    Then the phone column contains encrypted binary data, not the plaintext
    And the plaintext "5511999998888" does not appear in the column

  Scenario: Client name is encrypted at rest
    Given a client with name = "João Silva"
    When querying the database directly
    Then the name column contains encrypted data

  Scenario: API key is encrypted at rest
    Given a payment provider config with apiKey = "asaas_live_abc123"
    When querying the database directly
    Then the apiKeyEncrypted column contains encrypted data
    And the plaintext apiKey never appears in the database

  Scenario: Application decrypts correctly
    Given an encrypted client record
    When the application reads the client via repository
    Then the phone and name are returned as plaintext
    And match the original values
```

### 7.6 Test Case SEC-06: XSS Prevention

**OWASP Ref**: A03 (Injection — Cross-Site Scripting)

```gherkin
Feature: XSS Prevention
  User-supplied data must be rendered safely (never executed as script).

  Scenario: HTML/script in client name is stored but not executed
    Given a client with name = "<script>alert('xss')</script>"
    When the API stores and returns this client
    Then the stored value is the literal string
    And when rendered in the frontend, it appears as text, not as an executed script
    And the script tag does not fire any alert

  Scenario: XSS in metadata fields
    Given an invoice with metadata containing JavaScript
    When the invoice is retrieved via API
    Then the metadata is returned as a JSON object (sanitized or raw JSON)
    And is safely rendered by the frontend

  Scenario: Content-Type headers prevent XSS
    Given any API response
    Then the Content-Type header is "application/json"
    And the X-Content-Type-Options header is "nosniff"
```

### 7.7 Test Case SEC-07: CORS Validation

**OWASP Ref**: A05 (Security Misconfiguration)

```gherkin
Feature: CORS Enforced
  API must reject requests from unauthorized origins.

  Scenario: Request from allowed origin
    Given the frontend origin "https://app.agiliza.com"
    When sending a request with Origin: "https://app.agiliza.com"
    Then the response includes Access-Control-Allow-Origin: "https://app.agiliza.com"

  Scenario: Request from unknown origin
    Given an unknown origin "https://evil.com"
    When sending a request with Origin: "https://evil.com"
    Then the response does NOT include Access-Control-Allow-Origin
    And the browser blocks the cross-origin request

  Scenario: Preflight request from unknown origin
    Given an unknown origin
    When sending OPTIONS request with Origin: "https://evil.com"
    Then the response does NOT include Access-Control-Allow-Origin

  Scenario: Webhook endpoints do not require CORS
    Given any known or unknown origin
    When sending POST to /api/webhooks/payment/asaas
    Then CORS headers are not checked (webhook is server-to-server)
    But HMAC signature is still required
```

### 7.8 Test Case SEC-08: Cross-Tenant Data Isolation

**OWASP Ref**: A01 (Broken Access Control)

```gherkin
Feature: Tenant Data Isolation
  Tenants must never access each other's data.

  Scenario: Tenant A tries to read Tenant B's client
    Given tenant A with API key
    And tenant B has a client with id = "client-b-id"
    When tenant A calls GET /api/clients/client-b-id
    Then the response status is 404 Not Found (not 403 — avoids confirming existence)

  Scenario: Tenant A tries to list Tenant B's invoices
    Given tenant A with API key
    When tenant A calls GET /api/invoices
    Then only tenant A's invoices are returned
    And zero invoices from tenant B appear in the results

  Scenario: Tenant A tries to access Tenant B's reports
    Given tenant A with API key
    When tenant A calls GET /api/reports/cash-flow?tenantId=<tenant-b-id>
    Then the response is filtered to tenant A's data only
    And the tenantId query parameter is ignored (derived from auth)
```

### 7.9 Test Case SEC-09: Brute Force Protection

**OWASP Ref**: A07 (Identification and Authentication Failures)

```gherkin
Feature: Brute Force Protection
  Login endpoints must resist brute force attacks.

  Scenario: Multiple failed logins trigger lockout
    Given a valid tenant email
    When 5 consecutive login attempts fail with wrong password
    Then the 6th attempt (even with correct password) returns 429 Too Many Requests
    And a security event is logged

  Scenario: Lockout expires after cool-down
    Given an account locked due to failed attempts
    When waiting 15 minutes
    And attempting login with correct credentials
    Then the login succeeds and returns 200 OK

  Scenario: Different IPs share the same lockout counter for the same user
    Given a tenant account
    When failing login from IP 1.2.3.4 (5 times)
    Then login from IP 5.6.7.8 also triggers rate limit
    Because lockout is by account, not by IP
```

### 7.10 Test Case SEC-10: SSRF Prevention

**OWASP Ref**: A10 (Server-Side Request Forgery)

```gherkin
Feature: SSRF Prevention
  The system must prevent server-side request forgery when fetching external resources.

  Scenario: Webhook registration validates URL
    Given a malicious URL "http://169.254.169.254/latest/meta-data/" (AWS metadata)
    When calling GET /api/webhooks/evolution/register?url=http://169.254.169.254/latest/
    Then the request is rejected with 400 Bad Request
    And the error indicates invalid URL

  Scenario: Blocked internal network URLs
    Given a URL pointing to internal services
    When the system tries to register webhook with url="http://localhost:5432"
    Then the request is rejected

  Scenario: Allowed external URLs
    Given a valid public URL "https://api.agiliza.com/webhooks/evolution"
    When calling register webhook with this URL
    Then the registration succeeds

  Scenario: Payment provider callback URLs validated
    Given any integration that makes server-side HTTP requests
    When the URL target is from user/tenant input
    Then the URL is validated against an allowlist of known provider domains
```

### 7.11 Test Case SEC-11: Sensitive Data in Logs

**OWASP Ref**: A09 (Security Logging and Monitoring Failures)

```gherkin
Feature: PII Not Logged
  Logs must not contain raw PII data.

  Scenario: CPF is masked in logs
    Given a request containing CPF "123.456.789-00"
    When the application logs the request
    Then the log output contains "***.***.***-00" or similar mask
    And never contains the full CPF

  Scenario: Phone number is masked in logs
    Given a client phone "5511999998888"
    When logging is triggered during client creation
    Then the log contains "****8888" or similar mask

  Scenario: Credit card data is never logged
    Given any payment processing
    When logging occurs
    Then no 16-digit number pattern appears in logs
    And no CVV or expiry date appears in logs
```

### 7.12 Test Case SEC-12: JWT Token Security

**OWASP Ref**: A07 (Identification and Authentication Failures)

```gherkin
Feature: JWT Token Security
  JWT tokens must follow security best practices.

  Scenario: JWT contains minimal claims
    Given a valid JWT token
    When decoding the token payload (not verifying)
    Then it contains only: sub, tenantId, role, iat, exp
    And does NOT contain: password, apiKey, or any PII

  Scenario: Refresh token rotation
    Given a valid refresh token
    When using it to obtain a new access token
    Then the old refresh token is invalidated
    And a new refresh token is issued

  Scenario: Token reuse detection
    Given a stolen refresh token that was already rotated
    When attempting to use the old refresh token
    Then the request is rejected with 401
    And all sessions for the user are invalidated (token family kill switch)

  Scenario: JWT signature algorithm enforced
    Given a JWT with algorithm "none" in header
    When the server verifies the token
    Then verification fails with 401 Unauthorized
```

### 7.13 Test Case SEC-13: LGPD Right to Deletion

**OWASP Ref**: A02 (Cryptographic Failures — Data Protection)

```gherkin
Feature: LGPD Right to Deletion
  Clients and tenants can request data deletion.

  Scenario: Client data anonymization
    Given a client with name, phone, email, and payment history
    When the tenant requests deletion of this client
    Then the client PII fields are overwritten:
      | name  | "DELETADO"              |
      | phone | "00000000000"           |
      | email | NULL                    |
      | metadata | NULL                 |
    And the client record still exists (for financial audit integrity)
    But the client cannot be identified from stored data

  Scenario: Tenant data cascade anonymization
    Given a tenant with all associated data
    When the tenant requests full deletion
    Then all client PII under this tenant is anonymized
    And financial records are preserved with anonymized references
    And the tenant account is marked as deleted (not truly deleted)

  Scenario: Deletion request is logged for compliance
    Given any deletion/anonymization request
    When the operation completes
    Then a consent_log entry is created with action "deletion_request"
    And the timestamp and requesting user are recorded
```

### 7.14 Test Case SEC-14: File Upload Security (Future)

**OWASP Ref**: A03 (Injection)

```gherkin
Feature: File Upload Security (when implemented via MinIO)

  Scenario: File type validation
    Given an upload endpoint
    When uploading a file with extension ".exe" or ".php"
    Then the upload is rejected with 400 Bad Request
    And only allowed MIME types are accepted (image/*, application/pdf)

  Scenario: File size limits
    Given an upload endpoint with 10MB limit
    When uploading a file larger than 10MB
    Then the upload is rejected with 413 Payload Too Large

  Scenario: Malicious file content
    Given a file that claims to be "image/jpeg" but contains PHP code
    When uploading the file
    Then the server validates magic bytes, not just Content-Type header
    And rejects files that don't match their declared MIME type

  Scenario: Pre-signed URL security
    Given a valid pre-signed upload URL
    When an unauthorized party obtains the URL
    Then they can only upload to the specific path and filename
    And the URL expires after the configured TTL (default 15 min)
```

---

## 8. Secrets Management

### 8.1 Prohibited Patterns (VETO on Code Review)

The following patterns are **STRICTLY PROHIBITED** and will result in automatic rejection of any PR/commit:

```typescript
// ❌ VETO: Hardcoded secrets
const apiKey = 'asaas_live_abc123def456'

// ❌ VETO: Secrets in configuration files committed to git
// config/production.json  { "jwtSecret": "my-secret" }

// ❌ VETO: .env files committed to git (use .env.example only)
// .env  (should be in .gitignore)

// ❌ VETO: Secrets in source code comments
// API Key: asaas_live_abc123

// ❌ VETO: Secrets in logs or error messages
console.log(`Connecting with API key: ${apiKey}`)

// ❌ VETO: Secrets passed as CLI arguments
// docker run myapp --db-password=secret123

// ❌ VETO: Secrets in environment variable dumps
console.log(process.env)  // Never log all env vars
```

### 8.2 Approved Secret Injection

```typescript
// ✅ src/config/env.ts — Zod-validated environment variables
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3333),

  // Database
  DATABASE_URL: z.string().url(),
  DB_PASSWORD: z.string().min(1),  // Never logged

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32),  // At least 256-bit key
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Encryption
  ENCRYPTION_KEY: z.string().length(64),  // 32 bytes hex-encoded

  // Evolution API
  EVOLUTION_API_KEY: z.string().min(1),
  EVOLUTION_WEBHOOK_KEY: z.string().min(1),

  // Frontend
  FRONTEND_URL: z.string().url(),
})

export const env = envSchema.parse(process.env)
```

### 8.3 CI/CD Secrets

All secrets must be stored in **GitHub Secrets** (or equivalent CI/CD secrets store):

| Secret Name | Used By | Rotation |
|---|---|---|
| `DATABASE_URL_PROD` | Deploy workflow | Quarterly |
| `REDIS_PASSWORD` | Deploy workflow | Quarterly |
| `JWT_SECRET` | Deploy workflow | Monthly |
| `ENCRYPTION_KEY` | Deploy workflow | Manual |
| `EVOLUTION_API_KEY` | Deploy workflow | Per instance |
| `GITLEAKS_LICENSE` | Security workflow | Annually |

### 8.4 `.env.example` Guidelines

The `.env.example` file must:

- ✅ Contain ALL environment variables needed by the application
- ✅ Use placeholder values that are obviously fake (`your-key-here`, `change-me`)
- ✅ Include comments about where to obtain each value
- ❌ Never contain real secrets, even for development
- ❌ Never contain production values

Current `.env.example` status:

```
# Database
DATABASE_URL=postgresql://dev:dev@localhost:5432/agiliza           # ✅ Still example
REDIS_URL=redis://localhost:6379                                    # ✅ Still example
EVOLUTION_API_KEY=your-evolution-api-key                           # ✅ Placeholder
ASAAS_API_KEY=your-asaas-api-key                                   # ✅ Placeholder
```

> **Note**: The current `.env.example` is missing: `JWT_SECRET`, `ENCRYPTION_KEY`, `REDIS_PASSWORD`, `EVOLUTION_WEBHOOK_KEY`, `DB_PASSWORD`. These must be added.

---

## 9. Security Checklist for Deployment

### Pre-Deployment Checklist

- [ ] **TLS Certificates**: Let's Encrypt (Certbot) configured and auto-renewal verified
- [ ] **Database SSL/TLS**: `sslmode=require` in DATABASE_URL for production
- [ ] **Default Credentials**: All default passwords changed (PostgreSQL, Redis, Evolution API)
- [ ] **Firewall Rules**: Only ports 80 (HTTP→HTTPS redirect) and 443 (HTTPS) open
- [ ] **Docker Security**: All containers run as non-root; read-only filesystem; `no-new-privileges`
- [ ] **Memory Limits**: Docker containers have `mem_limit` configured (backend: 512M, DB: 1G, Redis: 512M)
- [ ] **Audit Logging**: Structured JSON logging enabled; logs shipped to stdout
- [ ] **Secrets Rotated**: All default secrets from `.env.example` replaced with production values
- [ ] **Security Headers Tested**: Validate at [securityheaders.com](https://securityheaders.com)
- [ ] **Rate Limiting**: Configured and tested with production-like load
- [ ] **CORS**: Origins configured to production frontend URL only
- [ ] **Helmet.js**: Enabled with production CSP directives
- [ ] **HTTPS Redirect**: HTTP → 301 → HTTPS enforced at load balancer level
- [ ] **No Secrets in Code**: `git-secrets` / Gitleaks scan passed
- [ ] **Dependency Audit**: `npm audit` passes with zero high/critical vulnerabilities
- [ ] **Database Backups**: WAL archiving + daily snapshots verified
- [ ] **Health Check Endpoint**: `/api/health` returns 200 with no sensitive data
- [ ] **Error Pages**: Custom error pages, no stack traces exposed
- [ ] **Docker Network**: `internal: true` for backend/db/redis network

### Post-Deployment Checklist (First 24h)

- [ ] **TLS Validation**: All endpoints accessible via HTTPS only; HTTP redirects to HTTPS
- [ ] **Security Headers**: Scan with [securityheaders.com](https://securityheaders.com) — grade A+ target
- [ ] **Webhook Verification**: Test payment webhook with valid and invalid signatures
- [ ] **Rate Limiting**: Verify 429 response when exceeding limits
- [ ] **CORS**: Verify cross-origin requests blocked from unknown origins
- [ ] **PII Encryption**: Direct DB query confirms PII columns are encrypted
- [ ] **Audit Logs**: Logs contain tenantId, userId, timestamp (no PII)
- [ ] **API Monitoring**: Set up alerts for 401/403/429 spikes
- [ ] **Backup Verification**: Test database restore from latest snapshot

---

## 10. OWASP Top 10 Compliance Matrix

| # | Category | Coverage | Evidence Location |
|---|---|---|---|
| **A01** | Broken Access Control | ✅ | Section 2.3 (tenant isolation), Section 7.8 (test SEC-08) |
| **A02** | Cryptographic Failures | ✅ | Section 3.2 (AES-256-GCM), Section 7.5 (test SEC-05) |
| **A03** | Injection | ✅ | Section 5.4 (Zod validation), Section 7.4 (test SEC-04), Section 7.6 (test SEC-06) |
| **A04** | Insecure Design | ✅ | Section 2.4 (rate limiting), Section 7.3 (test SEC-03) |
| **A05** | Security Misconfiguration | ✅ | Section 5.2 (Helmet), Section 5.3 (CORS), Section 7.7 (test SEC-07) |
| **A06** | Vulnerable Components | ✅ | Section 6.4 (dependency scanning), Section 12 (version pins) |
| **A07** | Auth Failures | ✅ | Section 2.1 (auth schemes), Section 7.1 (test SEC-01), Section 7.9 (test SEC-09), Section 7.12 (test SEC-12) |
| **A08** | Data Integrity Failures | ✅ | Section 4 (webhook HMAC), Section 7.2 (test SEC-02) |
| **A09** | Logging & Monitoring | ✅ | Section 3.4 (PII masking in logs), Section 7.11 (test SEC-11) |
| **A10** | SSRF | ✅ | Section 7.10 (test SEC-10) |
| **Cross** | Secrets in Code | ✅ | Section 8 (secrets management), VETO rules |
| **Cross** | Supply Chain | ✅ | Section 6.4 (dependency audit + better-npm-audit) |

---

## 11. Incident Response Plan

### 11.1 Security Event Classification

| Severity | Examples | Response Time | Notify |
|---|---|---|---|
| **CRITICAL** | Data breach, active intrusion, PII exfiltration | < 15 min | CTO + Security Lead + Legal |
| **HIGH** | Successful SQL injection, privilege escalation | < 1 hour | CTO + Security Lead |
| **MEDIUM** | Rate limit bypass, XSS in admin panel | < 4 hours | Security Lead |
| **LOW** | Missing security header, info leak in error message | < 1 week | Development team |

### 11.2 Incident Response Steps

```
1. DETECT
   ● Automated alert (rate limit spike, 5xx surge, failed HMACs)
   ● Manual report (tenant reports suspicious activity)
   ● Security scan finding

2. TRIAGE
   ● Determine severity (CRITICAL/HIGH/MEDIUM/LOW)
   ● Contain if CRITICAL: disable tenant, revoke keys, block IP
   ● Create incident ticket with all evidence

3. INVESTIGATE
   ● Review audit logs (authenticated, no PII)
   ● Identify affected tenant(s), client(s), data
   ● Determine root cause (code bug, misconfiguration, zero-day)

4. REMEDIATE
   ● Hotfix if CRITICAL/HIGH (bypass normal deploy cycle)
   ● Rotate affected secrets
   ● Patch vulnerability
   ● Add automated test to prevent regression

5. POST-MORTEM
   ● Document timeline, root cause, impact, fix
   ● Update security-spec.md with lessons learned
   ● Review if additional controls needed
```

### 11.3 Key Security Contacts

| Role | Contact |
|---|---|
| Security Lead | TBD (assign before production launch) |
| CTO | TBD |
| Legal / DPO | TBD (LGPD compliance officer) |
| On-call Engineer | Via PagerDuty/OpsGenie |

---

## 12. Security Dependencies & Versions

### 12.1 Runtime Dependencies

| Package | Minimum Version | Security Rationale |
|---|---|---|
| `fastify` | ^4.26.0 | Active maintenance, security fixes |
| `@fastify/helmet` | ^11.0.0 | HTTP security headers |
| `@fastify/cors` | ^9.0.0 | CORS enforcement |
| `@fastify/rate-limit` | ^9.0.0 | Rate limiting with Redis |
| `zod` | ^3.22.0 | Input validation |
| `bcrypt` | ^5.1.0 | Password hashing (cost >= 10) |
| `jsonwebtoken` | ^9.0.0 | JWT signing/verification |
| `pino` | ^8.16.0 | Structured logging |
| `ioredis` | ^5.3.0 | Redis client with TLS support |
| `@prisma/client` | ^5.8.0 | Parameterized queries (SQL injection prevention) |

### 12.2 Dev Dependencies

| Package | Purpose |
|---|---|
| `eslint-plugin-security` | SAST: detect insecure patterns |
| `eslint-plugin-no-secrets` | Block hardcoded secrets |
| `gitleaks` | Git history secret scanning |
| `better-npm-audit` | Customizable vulnerability thresholds |
| `@typescript-eslint/eslint-plugin` | Type-aware linting |

### 12.3 Vulnerability Scanning Cadence

| Scan Type | Frequency | Tool | Threshold |
|---|---|---|---|
| Dependency audit | Every PR + weekly | `npm audit` + `better-npm-audit` | Zero high/critical |
| SAST (static analysis) | Every PR | `eslint-plugin-security` | Zero errors |
| Secret scanning | Every commit | Gitleaks pre-commit hook | Zero findings |
| Container scan | Weekly | Trivy (or Docker Scout) | Zero high/critical |
| DAST (dynamic) | Monthly | OWASP ZAP (integration tests) | Zero high findings |

---

## Appendix A: Security-Focused ESLint Config

```javascript
// .eslintrc.security.js
module.exports = {
  plugins: ['security', 'no-secrets'],
  extends: ['plugin:security/recommended'],
  rules: {
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'warn',
    'no-secrets/no-secrets': ['error', {
      tolerance: 3.5,  // Entropy threshold
      additionalRegexes: {
        'AWS Access Key': 'AKIA[0-9A-Z]{16}',
        'Private Key': '-----BEGIN\\s?(RSA|EC|DSA|OPENSSH|PGP)?\\s?PRIVATE KEY-----',
      },
    }],
  },
}
```

## Appendix B: Gitleaks Configuration

```toml
# .gitleaks.toml
title = "Agiliza Security Scan"

[allowlist]
description = "Allowlisted files and patterns"
paths = [
  "package-lock.json",     # Contains hashes, not secrets
  "pnpm-lock.yaml",
  "*.test.ts",             # Test files may have example values
]

[[rules]]
id = "agiliza-api-key"
description = "Agiliza API Key pattern"
regex = '''agiliza_(live|test)_[a-zA-Z0-9]{32}'''
tags = ["agiliza", "api-key"]

[[rules]]
id = "asaas-api-key"
description = "Asaas API Key"
regex = '''\$aes\$[a-zA-Z0-9+/=]+'''
tags = ["asaas", "payment"]

[[rules]]
id = "jwt-secret"
description = "Hardcoded JWT Secret"
regex = '''['"](your-jwt-secret|jwt-secret|jwt_secret)['"]\s*[:=]\s*['"][a-zA-Z0-9]{8,}['"]'''
tags = ["jwt", "secret"]
```

---

## Appendix C: Security Requirements Traceability Matrix

| Requirement | SDD Reference | Security Spec Section | Test Case | Priority |
|---|---|---|---|---|
| PII encryption at rest | §8.1 | §3.2 | SEC-05 | **Critical** |
| Webhook HMAC validation | §8.2 | §4.1 | SEC-02 | **Critical** |
| Tenant isolation | §7.4 | §2.3 | SEC-08 | **Critical** |
| JWT authentication | §8.2 | §2.1 | SEC-01, SEC-12 | **Critical** |
| Rate limiting | §8.2 | §2.4 | SEC-03 | **High** |
| SQL injection prevention | §8.4 | §5.4 | SEC-04 | **High** |
| CORS configuration | §8.4 | §5.3 | SEC-07 | **High** |
| Security headers | §8.4 | §5.2 | Manual check | **High** |
| XSS prevention | — | §5.2 | SEC-06 | **High** |
| LGPD right to deletion | §8.3 | §3.3 | SEC-13 | **High** |
| Secrets management | §8.1 | §8 | Pre-commit hook | **High** |
| SSRF prevention | — | §7.10 | SEC-10 | **Medium** |
| Brute force protection | — | §7.9 | SEC-09 | **Medium** |
| PII masking in logs | — | §3.4 | SEC-11 | **Medium** |
| Dependency scanning | — | §6.4 | CI pipeline | **Medium** |
| Docker security | §8.4 | §6.1 | Manual check | **Medium** |

---

> **Document Version**: 1.0.0  
> **Last Updated**: 2026-07-25  
> **Author**: Security Specialist Agent  
> **Review Status**: Approved for Implementation  
> **Related Specs**: `docs/sdd.md`, `specs/*.spec.md`  
> **Compliance**: LGPD (Lei 13.709/2018), OWASP Top 10 (2021)
