# Sprint 8 Plan — Production Readiness: Payment Provider Config, API Docs, CD Pipeline, Quality Gates

**Theme**: Production Readiness — payment provider config, API docs, CD pipeline, quality gates
**Period**: 2026-08-13 to 2026-08-20 (1 week)
**Target Release**: `v0.8.0`

---

## Pre-Sprint Context

Sprint 7 delivered the recurring billing module: `CreateInvoiceForSubscriptionUseCase`, the BullMQ `RecurringInvoiceWorker`, subscription lifecycle (`Expire`/`Renew`/`Pause`/`Resume`), the `AutoPayHandler` on `subscription.invoice.created`, and the end-to-end recurring billing integration test. Tag `v0.7.0` is cut.

**What exists now (after Sprint 7):**

| Capability | Status |
|-----------|--------|
| Recurring invoice generation (BullMQ daily worker) | ✅ Sprint 7 |
| Subscription lifecycle (expire, renew, pause, resume) | ✅ Sprint 7 |
| Auto-pay on `subscription.invoice.created` | ✅ Sprint 7 |
| `PaymentProviderConfig` Prisma model (`payment_provider_configs` table, `@@unique([tenantId, provider])`) | ✅ Model exists in schema |
| `PUT/GET /api/tenants/:id/payment-provider` routes | ✅ Exist — **but store `apiKey` as plaintext JSON on `Tenant.paymentProviderConfig`** |
| AES-256-GCM pattern | ✅ Exists only in security tests (`__tests__/security/encryption.test.ts`) — **no production encryption service** |
| `ENCRYPTION_KEY` env var | ✅ Exists in `config/env.ts` (default `''`) |
| `@fastify/swagger` + `@fastify/swagger-ui` | ✅ In `package.json` — **not registered anywhere** |
| Frontend component tests | ✅ 20 test files (~260+ tests) — **`exception-panel` and `message-tracking` have zero coverage** |
| Backend Dockerfiles | ✅ `apps/backend/Dockerfile`, `apps/frontend/Dockerfile` |
| CI (`ci.yml`) | ✅ Lint/typecheck, unit tests, coverage, E2E jobs |
| CD pipeline | ❌ **Does not exist** — no image publishing, no tag-triggered deploy |
| Prisma `migrations/` directory | ⚠️ **Does not exist** — schema is applied without tracked migrations (verification needed, see Item 1) |

**The four gaps this sprint closes:**

| Gap | Sprint 8 Item | Priority |
|-----|---------------|----------|
| Payment provider credentials are global env vars — no per-tenant config, keys stored plaintext when set via API | **Item 2** | 🔴 High |
| Zero API documentation — consumers must read source to know request/response shapes | **Item 4** | 🟡 Medium |
| Tests + CI have drift (2 failing decision route tests, E2E job cannot run standalone) | **Item 1** | 🔴 High |
| No CD pipeline — releases are manual, no artifact publishing to GHCR | **Item 6** | 🟡 Medium |

---

## Sprint Goal

Make the platform deployable and operable for real tenants. By end of sprint: payment provider credentials are stored per-tenant and encrypted at rest (AES-256-GCM) with env-var fallback, `ProcessPaymentUseCase` honors tenant config, the frontend exposes a working settings page, the API is documented via Swagger UI at `/docs`, CI is green and the E2E job is actually runnable, frontend coverage exceeds 340 tests, and a tag-triggered CD pipeline publishes both Docker images to GHCR.

---

## Dependency Graph

```
┌──────────────────────────────────────────────────────┐
│ Item 1: Fix tests + CI E2E (1d)                       │
│   - Fix 2 decision route tests                        │
│   - Add prisma migrate deploy to E2E CI job           │
└──────────────┬───────────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────────┐
│ Item 2: Payment Provider Config API (1.5d)            │
│   - PaymentProviderConfig CRUD                        │
│   - AES-256-GCM encryption for credentials            │
│   - Wire into ProcessPaymentUseCase (use per-tenant   │
│     config instead of env vars)                       │
└──────────────┬───────────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────────┐
│ Item 3: Tenant Settings UI (1d)                       │
│   - Frontend page for payment provider config         │
│   - Webhook URL config                                │
└──────────────────────────────────────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| Item 1 → Item 2 | Item 2 adds new routes, repository, and use cases that CI will exercise. CI must be green (and the E2E job runnable) first so Item 2 lands on a verified baseline |
| Item 2 → Item 3 | The settings UI (`/settings`) consumes the `GET/PUT /api/tenants/:id/payment-config` contract that Item 2 defines. The UI cannot be built against a moving contract |
| Item 6 | Starts after Item 1 merges (Stream D) — the CD pipeline must not publish artifacts from a repo whose CI is red |

---

## Parallel Streams

| Stream | Items | Total Effort | Dependency |
|--------|-------|-------------|------------|
| **Stream A** | Item 1 → Item 2 → Item 3 | 3.5 days | Fully sequential |
| **Stream B** | Item 4 (Swagger) | 0.5 day | Parallel with A — touches `index.ts` + route files only |
| **Stream C** | Item 5 (Frontend tests) | 1 day | Parallel with A — frontend-only changes |
| **Stream D** | Item 6 (CD pipeline) | 1 day | After Item 1 merges (CI green first) — creates new workflow file, no source conflict |

### Stream Diagram

```
Week 1 (Aug 13 - Aug 20):
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Day 1 (Aug 13):                                                                            │
│   A: Item 1 — Fix tests + CI E2E (1d) ────────────────────────────────────                 │
│   B: Item 4 — Swagger (0.5d) ════════════════════ (parallel, no conflict)                  │
│   C: Item 5 — Frontend tests (1d) ════════════════════════════════════════                 │
│                                                                                             │
│ Day 2-3 (Aug 14-15):                                                                        │
│   A: Item 2 — Payment Provider Config API (1.5d) ───────────────────────                   │
│   C: Item 5 continues / finishes                                                            │
│   D: Item 6 — CD pipeline (1d) ════ starts after Item 1 merged ════                        │
│                                                                                             │
│ Day 4 (Aug 16):                                                                             │
│   A: Item 3 — Tenant Settings UI (1d) ──────────────────────────────────                    │
│                                                                                             │
│ Day 5 (Aug 17-20):                                                                          │
│   Buffer: Review (CTO security/architecture), release prep, tag v0.8.0                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Critical Path

**Item 1 (1d) → Item 2 (1.5d) → Item 3 (1d) = 3.5 calendar days**

Streams B/C/D (2.5d of work) run in parallel → total calendar time ~4.5 days, fits in 1 week with buffer.

---

## Item 1: Fix Tests + CI E2E (🔴 High, 1d)

**Effort**: 1 day
**Theme**: Quality / CI
**Stream**: A
**Blocking**: Item 2, Item 6
**Dependencies**: None

### Description

Restore a green, verifiable baseline before any new feature work. Two decision route tests are failing and the CI E2E job cannot run standalone.

**What exists (verified at sprint start):**

- `apps/backend/src/__tests__/routes/decision.routes.test.ts` — **67 lines, exactly 2 tests, both broken**:
  - **Test 1** (`should return next action with channel, template, and sendAt`): exercises the real route, which calls `createGetNextDecisionUseCase()` → `PrismaClientRepository` + `PrismaInvoiceRepository` (real DB access). The test registers `decisionRoutes` with no database → **test isolation failure**. It also asserts `body.data.action === 'send_reminder'` against fake IDs (`00000000-...-00000001`) that no seeded DB can return deterministically.
  - **Test 2** (`should handle request without clientId`): asserts `res.statusCode` is `200`, but `decision.routes.ts` now returns **400** with `{ error: 'clientId and invoiceId are required' }` when `clientId` is missing → **stale expectation**.
- `.github/workflows/ci.yml` → `e2e` job starts the backend with `npx tsx src/index.ts &` and waits for `:3333/api/health`, but has **no schema-migration step** and **no `migrations/` directory exists in the repo**.
- ⚠️ **Verification required at sprint start**: the `e2e` job never starts the frontend, yet `e2e/playwright.config.ts` sets `baseURL: http://localhost:3000`. Confirm whether the current E2E suite is backend-only via `API_URL` (then the baseURL mismatch is latent) or whether the job genuinely cannot run. The AC "CI E2E job actually runnable" covers this.

#### 1A: Fix the 2 decision route tests

- **Test 2 (stale expectation)**: update to assert `400` and the error body — the route's current contract (`clientId` and `invoiceId` required) is correct behavior, the test is wrong.
- **Test 1 (isolation)**: stop hitting real Prisma repositories from a unit test. Use `vi.mock` to stub `createGetNextDecisionUseCase` (or the factory module) with a deterministic fake use case, then assert the route's response envelope (`{ data: { action, channel, templateName, scheduledAt } }`). Route-level contract tests must not require a database; the real-DB behavior is already covered by the use case tests + E2E suite.

#### 1B: Add `prisma migrate deploy` to the E2E CI job

```yaml
# .github/workflows/ci.yml — e2e job, between "Install dependencies" and "Start Backend"
- name: Apply Database Migrations
  working-directory: apps/backend
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: postgresql://dev:dev@localhost:5432/agiliza
```

**Precondition**: create the initial Prisma migration baseline if `apps/backend/src/infrastructure/database/prisma/migrations/` is still empty:
- Run `npx prisma migrate dev --name init` (or `--create-only` for review) to produce the tracked migration set for the current schema.
- Commit the `migrations/` folder. From this point, every schema change lands as a migration, and `migrate deploy` in CI/prod is the single apply mechanism.
- If a migration baseline is intentionally out of scope this sprint, document the decision explicitly in the PR — but the AC requires `migrate deploy` to succeed, which is impossible without at least one migration.

#### 1C: Verify the E2E job is runnable end-to-end

- Confirm the healthcheck (`wait-on :3333/api/health`) passes after the migrate step.
- Confirm whether the frontend must be started for the suite (see verification note above) and if so, add the `Start Frontend` step (or document that the E2E suite is backend-contract only and adjust `baseURL` to `API_URL`).

### Acceptance Criteria

- [ ] `tsc --noEmit` passes on both apps (`apps/backend`, `apps/frontend`)
- [ ] All non-E2E backend tests pass — **0 failures** (known exceptions documented, E2E requiring a running server excluded from unit run)
- [ ] `decision.routes.test.ts` has 2 green tests: route returns 400 on missing params; route returns 200 + envelope with a stubbed use case (no DB dependency)
- [ ] `prisma migrate deploy` step exists in the E2E CI job before backend startup
- [ ] Initial migration baseline exists in `apps/backend/src/infrastructure/database/prisma/migrations/` (or explicit documented exception)
- [ ] E2E job is runnable: backend starts, healthcheck passes, E2E suite executes (frontend-start decision resolved)
- [ ] Zero new warnings in `npx vitest run` output

---

## Item 2: Payment Provider Config API (🔴 High, 1.5d)

**Effort**: 1.5 days
**Theme**: Core Feature / Security
**Stream**: A
**Blocking**: Item 3
**Dependencies**: Item 1 (green CI baseline)

### Description

Per-tenant payment provider configuration: CRUD backed by the existing `PaymentProviderConfig` model, API keys encrypted at rest with AES-256-GCM, and `ProcessPaymentUseCase` resolving the provider from tenant config with env-var fallback.

**What exists (verified at sprint start):**

- `model PaymentProviderConfig` already in schema (`payment_provider_configs`): `id`, `tenantId`, `provider`, `apiKeyEncrypted`, `webhookSecret`, `isActive`, `@@unique([tenantId, provider])`, `@@index([tenantId])`, cascade delete. **No repository exists for it** and the model is not used by any use case.
- `tenant.routes.ts` already has `PUT/GET /api/tenants/:id/payment-provider` — **it stores `apiKey` as plaintext JSON** in `Tenant.paymentProviderConfig` (via `tenantRepo.updatePaymentProvider`). `GET` deliberately hides the key (`hasApiKey` boolean).
- `ENCRYPTION_KEY` exists in `config/env.ts` (default `''` — must be validated non-empty before use).
- AES-256-GCM reference implementation in `apps/backend/src/__tests__/security/encryption.test.ts` (node `crypto`, 16-byte IV, auth tag) — **test-only, to be extracted into a production service**.
- `create-process-payment.factory.ts` constructs `AsaasPaymentProvider` from `process.env.ASAAS_API_KEY` / `ASAAS_ENVIRONMENT` — **ignores tenant config entirely**.
- `PaymentProvider` domain enum: `ASAAS | MERCADO_PAGO | PAGBANK | POLAR` (`domain/entities/tenant.ts`).

#### 2A: Ports and entities

```typescript
// application/ports/repositories/payment-provider-config.repository.port.ts
export interface PaymentProviderConfigRepositoryPort {
  findByTenantAndProvider(tenantId: string, provider: PaymentProvider): Promise<PaymentProviderConfig | null>;
  findByTenant(tenantId: string): Promise<PaymentProviderConfig[]>;
  upsert(config: PaymentProviderConfig): Promise<PaymentProviderConfig>;
  delete(tenantId: string, provider: PaymentProvider): Promise<void>;
}
```

Prisma implementation in `infrastructure/database/repositories/payment-provider-config.repository.ts` with a mapper (`PersistencePaymentProviderConfig ↔ PaymentProviderConfig`), following the existing repository/mapper pattern.

```typescript
// application/ports/adapters/encryption.port.ts
export interface EncryptionPort {
  encrypt(plaintext: string): EncryptedPayload; // { ciphertext, iv, tag } — hex
  decrypt(payload: EncryptedPayload): string;
}
```

`infrastructure/encryption/aes-256-gcm.service.ts` — AES-256-GCM, 32-byte key derived from `ENCRYPTION_KEY` (hex-decode if 64 hex chars, else SHA-256 derive), 16-byte random IV per encryption, auth tag stored alongside. **Reuses the exact algorithm validated by `encryption.test.ts`.**

#### 2B: Domain entity

`domain/entities/payment-provider-config.ts`:
- `PaymentProviderConfig` (id, tenantId, provider, apiKeyEncrypted, webhookSecretEncrypted?, environment: 'sandbox' | 'production', isActive, timestamps)
- `UpsertPaymentProviderConfigInput` — plaintext `apiKey` and optional `webhookUrl`/`webhookSecret`; encryption happens in the use case (via `EncryptionPort`), never in the entity.

#### 2C: Use cases

```typescript
// application/usecases/upsert-payment-provider-config.usecase.ts
export interface UpsertPaymentProviderConfigInput {
  tenantId: string;
  provider: PaymentProvider;
  apiKey: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}
export interface UpsertPaymentProviderConfigOutput {
  provider: PaymentProvider;
  environment: 'sandbox' | 'production';
  hasApiKey: boolean; // never returns the key
  isActive: boolean;
}

export class UpsertPaymentProviderConfigUseCase {
  constructor(
    private readonly configRepo: PaymentProviderConfigRepositoryPort,
    private readonly tenantRepo: TenantRepositoryPort,
    private readonly encryption: EncryptionPort,
  ) {}
  async execute(input: UpsertPaymentProviderConfigInput): Promise<Either<ApplicationError, UpsertPaymentProviderConfigOutput>>;
}
```

Flow: validate tenant exists (404) → encrypt `apiKey` (and `webhookSecret` if provided) → `upsert` (insert-or-update on the `(tenantId, provider)` unique key) → return masked output. **Never return the ciphertext or plaintext key.**

```typescript
// application/usecases/get-payment-provider-config.usecase.ts
export class GetPaymentProviderConfigUseCase {
  constructor(private readonly configRepo: PaymentProviderConfigRepositoryPort) {}
  async execute(input: { tenantId: string; provider?: PaymentProvider }): Promise<
    Either<ApplicationError, { provider: PaymentProvider; environment: 'sandbox' | 'production'; hasApiKey: boolean; isActive: boolean } | null>
  >;
}
```

#### 2D: Routes

Per the sprint contract, new dedicated routes in `tenant.routes.ts` (or a new `payment-config.routes.ts`):

```
PUT /api/tenants/:id/payment-config   — body: { provider, apiKey, environment, webhookSecret? } → 200 masked config | 404 tenant | 400 validation
GET /api/tenants/:id/payment-config   — → 200 { provider, environment, hasApiKey, isActive } | 404 tenant | 404 no config
```

**Reconciliation decision (document in PR):** the existing `PUT/GET /api/tenants/:id/payment-provider` routes overlap. Recommended: keep both temporarily, but mark the old routes deprecated in the Swagger spec (Item 4) and have them delegate to the same use cases. Full removal is a follow-up. This avoids breaking any existing frontend caller while removing the plaintext path.

#### 2E: Wire `ProcessPaymentUseCase` factory to per-tenant config (env fallback)

The factory is synchronous today; per-tenant resolution must be async. Introduce a resolver:

```typescript
// application/services/payment-provider-resolver.service.ts
export class PaymentProviderResolver {
  constructor(
    private readonly configRepo: PaymentProviderConfigRepositoryPort,
    private readonly encryption: EncryptionPort,
  ) {}

  // Returns a configured PaymentGatewayPort for the tenant, or null → caller falls back to env
  async resolveForTenant(tenantId: string): Promise<PaymentGatewayPort | null>;
}
```

- `ProcessPaymentUseCase` currently receives `PaymentGatewayPort` in its constructor. Change the factory flow: `createProcessPaymentUseCase` becomes an async factory (or returns a thin async adapter) that:
  1. Reads `tenantId` from the request context,
  2. Calls `PaymentProviderResolver.resolveForTenant(tenantId)` — finds the active `PaymentProviderConfig`, decrypts the key,
  3. Returns the matching provider gateway (Asaas/MercadoPago/PagBank/Polar via **Strategy Pattern** — one interface, one class per provider),
  4. **Fallback**: if no tenant config exists or `isActive === false` → construct the gateway from env vars exactly as today (`process.env.ASAAS_API_KEY`, `ASAAS_ENVIRONMENT`, `PAYMENT_PROVIDER`).
- The `ProcessPaymentUseCase` **core logic does not change** — it keeps depending only on `PaymentGatewayPort`. Per-tenant resolution lives in the composition root (factory) + resolver service. This preserves the Dependency Rule: Domain/Application know nothing about Prisma or the encryption implementation.

**Design Patterns (declare explicitly):**
- **Strategy Pattern**: one `PaymentGatewayPort` interface; each provider (Asaas, Mercado Pago, PagBank, Polar) is a concrete strategy. The resolver selects the strategy from tenant config — no `switch/if` per provider inside the use case.
- **Adapter Pattern**: `EncryptionPort` (application) ← `Aes256GcmEncryptionService` (infrastructure).

### Acceptance Criteria

- [ ] `PaymentProviderConfigRepositoryPort` + Prisma implementation with `findByTenantAndProvider`, `findByTenant`, `upsert`, `delete`
- [ ] `EncryptionPort` + `Aes256GcmEncryptionService` using `ENCRYPTION_KEY` — ciphertext, IV, tag persisted; plaintext never stored
- [ ] `UpsertPaymentProviderConfigUseCase` + `GetPaymentProviderConfigUseCase` with full unit tests (success, tenant not found, masking — API key never in output)
- [ ] Routes `PUT/GET /api/tenants/:id/payment-config` — 200/404/400 status codes per contract
- [ ] `PaymentProviderResolver` selects tenant config when present and active; falls back to env vars otherwise (unit-tested both paths)
- [ ] `ProcessPaymentUseCase` factory resolves per-tenant config; env fallback preserved and verified by existing tests
- [ ] Plaintext key no longer written by the new routes; old `/payment-provider` routes delegate to the same use cases (deprecated)
- [ ] Encryption service negative tests: wrong key fails to decrypt, tampered ciphertext fails auth tag
- [ ] Zero new Dependency Rule violations (encryption + repository are infrastructure; use cases depend only on ports)
- [ ] All existing tests continue to pass

---

## Item 3: Tenant Settings UI (🟡 Medium, 1d)

**Effort**: 1 day
**Theme**: Frontend
**Stream**: A
**Blocking**: None
**Dependencies**: Item 2 (API contract must be stable)

### Description

Frontend page for payment provider configuration with a webhook URL field, backed by `lib/api.ts`.

**What exists (verified at sprint start):**
- `apps/frontend/src/lib/api.ts` — `api.get/put/post/patch` ready to use.
- `sidebar.tsx` already links **`/dashboard/settings`** (label "Configurações").
- `apps/frontend/src/app/` has `billing/`, `dashboard/`, `page.tsx`, `layout.tsx` — **no settings page**.

**Reconciliation decision:** the sprint brief says page `/settings`; the existing sidebar link points to `/dashboard/settings`. Create the page at `/dashboard/settings` to match existing navigation (no dead link). Flag in PR if the CEO prefers `/settings`.

#### 3A: Settings page + form component

- `apps/frontend/src/app/dashboard/settings/page.tsx` — loads existing config on mount (`GET /api/tenants/:id/payment-config`), renders `PaymentProviderForm`, handles loading skeleton and error state.
- `apps/frontend/src/components/payment-provider-form.tsx` — fields:
  - `provider` select (asaas | mercadopago | pagbank | polar)
  - `apiKey` (password input, masked; placeholder "••••••••" when a key exists)
  - `environment` select (sandbox | production)
  - `webhookUrl` (URL input, optional — maps to the config's webhook secret/URL handling)
  - Submit → `PUT /api/tenants/:id/payment-config`; success feedback; error display.
- Export from `components/index.ts` barrel.

**Tenant id note:** if the app has no session-scoped tenant yet, default to a `NEXT_PUBLIC_DEMO_TENANT_ID` env var with a documented fallback — same pattern as the existing demo-mode plumbing. If a tenant context exists, use it.

#### 3B: Tests

`apps/frontend/src/__tests__/components/payment-provider-form.test.tsx` (these count toward Item 5's total):
- renders all fields with correct labels
- validates: empty apiKey blocks submit; invalid webhookUrl shows error
- saves via mocked `api.put` with correct payload
- shows loading state while submitting
- shows error state when PUT fails
- pre-fills provider/environment when editing existing config

### Acceptance Criteria

- [ ] `/dashboard/settings` page renders (linked from sidebar)
- [ ] `PaymentProviderForm` renders provider select, apiKey, environment, webhookUrl fields
- [ ] Form validates (required apiKey, URL format) before submit
- [ ] Save calls `PUT /api/tenants/:id/payment-config` with the right payload
- [ ] Loading state shown while fetching/saving; error state shown on failure
- [ ] Existing config is pre-filled on edit
- [ ] Component tests pass (≥6 test cases)
- [ ] `tsc --noEmit` passes on frontend

---

## Item 4: API Documentation Swagger (🟡 Medium, 0.5d)

**Effort**: 0.5 day
**Theme**: Documentation / API
**Stream**: B
**Blocking**: None
**Dependencies**: None (parallel with Stream A)

### Description

Expose OpenAPI 3.0 documentation for the API.

**What exists (verified at sprint start):**
- `@fastify/swagger@^8.14.0` and `@fastify/swagger-ui@^3.0.0` are **already in `apps/backend/package.json`** — no install needed, this item is registration + schemas only.
- Fastify v4, `index.ts` `buildApp()` registers cors/helmet/rate-limit then routes.
- Zero route-level schemas exist on the registered routes.

#### 4A: Register Swagger in `index.ts`

```typescript
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

await app.register(swagger, {
  openapi: {
    info: { title: 'Agiliza API', version: '0.8.0', description: '...' },
    servers: [{ url: `http://localhost:${env.PORT}` }],
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs', // ← AC requires /docs (default is /documentation)
});
```

Register before routes. `tsconfig` types: ensure `@fastify/swagger`'s schema types don't break the strict `tsc --noEmit` gate.

**Security note (for security-specialist review):** in production, disable the UI route or protect it — `swaggerUi` accepts `{ enabled: env.NODE_ENV !== 'production' }`-style guarding so `/docs` never leaks route internals publicly. Decide and document in the PR.

#### 4B: Route schemas for main endpoints

Add `schema: { body/querystring/params/response }` (Zod + `@fastify/type-provider-zod` is already a dependency, or plain JSON Schema) to the main endpoints:
- `tenant.routes.ts` — create/update tenant, `payment-config` (Item 2), `decision-config`
- `client.routes.ts` — list/create/get
- `invoice.routes.ts` — list/create/get, payments
- `subscription.routes.ts` — create/cancel/expire/renew/pause/resume
- `payment` / `decision.routes.ts` — process payment, next-action
- `health.routes.ts`

Priority order (cut scope if tight): tenants, invoices, subscriptions, payments, decisions. Schemas added in Item 2 for `payment-config` are mandatory.

### Acceptance Criteria

- [ ] `@fastify/swagger` + `@fastify/swagger-ui` registered in `buildApp()`
- [ ] `GET /docs` serves Swagger UI
- [ ] `GET /docs/json` serves the OpenAPI 3.0 JSON spec
- [ ] Route schemas present for the main endpoints (tenants, invoices, subscriptions, payments, decisions at minimum)
- [ ] Swagger UI disabled or protected in production (documented decision)
- [ ] `tsc --noEmit` passes on backend; existing tests unaffected

---

## Item 5: Frontend Remaining Tests (🟡 Medium, 1d)

**Effort**: 1 day
**Theme**: Quality / Frontend
**Stream**: C
**Blocking**: None
**Dependencies**: None (parallel with Stream A)

### Description

Close the frontend component-test coverage gaps.

**What exists (verified at sprint start):**

20 component test files exist. Reconciliation with the sprint brief (which listed `sidebar`, `loading-skeleton`, `empty-state`, `error-state`, `exception-panel`, `message-tracking`):

| Component | Test file today | Action |
|-----------|----------------|--------|
| `sidebar` | ✅ `sidebar.test.tsx` (10 tests) | Deepen only if gaps found |
| `loading-skeleton` | ✅ `loading-skeleton.test.tsx` | Deepen if thin |
| `empty-state` | ✅ `empty-state.test.tsx` (9 tests) | Deepen if thin |
| `error-state` | ✅ `error-state.test.tsx` | Deepen if thin |
| `exception-panel` | ❌ **no test file** | **Write from scratch** (≥8 tests) |
| `message-tracking` | ❌ **no test file** | **Write from scratch** (≥8 tests) |

**Target reconciliation:** the brief's "60+ new tests" assumed more gaps than actually exist. The realistic target: **2 new test files** (`exception-panel`, `message-tracking`) + deepen the 3 thin files (loading-skeleton, empty-state, error-state) + the settings form tests from Item 3. Final gate is the **total count**, not the delta: frontend total > **340 tests** (verify current count on sprint start via `npx vitest run`; adjust delta accordingly). If the count already exceeds 340, the AC is met with the new files only.

**Test patterns** — follow existing conventions (`@testing-library/react`, `vi.mock('next/navigation')` for router-dependent components, `data-testid`, Portuguese describe/it labels as in the existing suites).

### Acceptance Criteria

- [ ] `exception-panel.test.tsx` created (render, error message, retry callback, empty variants)
- [ ] `message-tracking.test.tsx` created (render, statuses, empty state, loading, error)
- [ ] `loading-skeleton`, `empty-state`, `error-state` deepened where thin
- [ ] Frontend total tests **> 340** (`npx vitest run` count)
- [ ] `tsc --noEmit` passes on frontend
- [ ] No skipped/empty tests (zombie-free)

---

## Item 6: CD Pipeline (🟡 Medium, 1d)

**Effort**: 1 day
**Theme**: DevOps / CI-CD
**Stream**: D
**Blocking**: None
**Dependencies**: Item 1 merged (CI green first)

### Description

Tag-triggered continuous delivery pipeline that builds and publishes both Docker images to GHCR.

**What exists (verified at sprint start):**
- `apps/backend/Dockerfile` and `apps/frontend/Dockerfile` exist.
- `.github/workflows/ci.yml` exists; **no `cd.yml`**, no GHCR publish anywhere.
- `docker-compose.prod.yml` references local builds (`build.context: ..`); no registry images.

#### 6A: Create `.github/workflows/cd.yml`

```yaml
name: CD

on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: read
  packages: write   # required for GHCR push

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - name: Install dependencies
        run: npm ci
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push backend image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/backend/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/backend:${{ github.ref_name }}
            ghcr.io/${{ github.repository }}/backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Build and push frontend image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/frontend/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/frontend:${{ github.ref_name }}
            ghcr.io/${{ github.repository }}/frontend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Key points:
- **Trigger**: `v*.*.*` tags (aligned with release flow: `v0.8.0`).
- **Multi-arch**: optional — if runtime is linux/amd64 only, keep single-platform; add `platforms: [linux/amd64]` explicitly.
- **Prisma**: verify the backend Dockerfile runs `prisma generate` during build and `prisma migrate deploy` on container start (aligns with Item 1's migrate strategy). If not, add the steps in this item.
- **Secrets**: no secrets baked into images — `ENCRYPTION_KEY`, API keys, and webhook secrets must remain runtime env (prod compose already uses `env_file`).
- **Deploy target**: no staging environment is available this sprint → **image publish only**. The `cd.yml` should have a clearly commented placeholder (`deploy-staging` job, `environment: staging`, `needs: publish`, commented out) so the next step is one uncomment away.

#### 6B: Validate the pipeline

- Local validation: `docker build -f apps/backend/Dockerfile .` and `docker build -f apps/frontend/Dockerfile .` succeed.
- YAML validation: run the workflow file through a parser (e.g., `actionlint` if available) — no invalid syntax.
- Dry-run the publish path in a fork or a pre-release tag (`v0.8.0-rc.1`) if GHCR permissions allow.

### Acceptance Criteria

- [ ] `.github/workflows/cd.yml` created with `push: tags: ['v*.*.*']` trigger
- [ ] Backend image builds and pushes to GHCR (tag `v*.*.*` + `latest`)
- [ ] Frontend image builds and pushes to GHCR (tag `v*.*.*` + `latest`)
- [ ] Workflow YAML is valid (parser check passes)
- [ ] Both Docker images build locally (`docker build`) without errors
- [ ] Backend image runs `prisma generate` at build and `prisma migrate deploy` at startup (verified)
- [ ] No secrets baked into the images
- [ ] Staging deploy job stubbed/commented with clear "uncomment when target available" instructions

---

## Effort Summary Table

| Item | Description | Days | Theme | Stream | Depends On | Blocks |
|------|-------------|------|-------|--------|------------|--------|
| 1 | **Fix tests + CI E2E** | 1.0 | Quality/CI | A | — | Item 2, Item 6 |
| 2 | **Payment Provider Config API** | 1.5 | Core Feature/Security | A | Item 1 | Item 3 |
| 3 | **Tenant Settings UI** | 1.0 | Frontend | A | Item 2 | — |
| 4 | **API Documentation Swagger** | 0.5 | Documentation | B | — | — |
| 5 | **Frontend remaining tests** | 1.0 | Quality | C | — | — |
| 6 | **CD Pipeline** | 1.0 | DevOps | D | Item 1 | — |
| | **Total** | **6.0 days** | | | **(4 parallel streams)** | |

### Effort Distribution by Theme

| Theme | Items | Total Days |
|-------|-------|-----------|
| Core Feature / Security | Item 2 | 1.5 days |
| Quality | Items 1, 5 | 2.0 days |
| Frontend | Item 3 | 1.0 day |
| Documentation | Item 4 | 0.5 day |
| DevOps / CI-CD | Item 6 | 1.0 day |

### Sprint Capacity

- **Total effort**: 6.0 days
- **Sprint duration**: 1 week (5 working days)
- **Team size**: 4 streams (A sequential, B/C parallel, D gated on A's first item)
- **Calendar time**: Stream A (3.5d) runs alongside B (0.5d) and C (1d); D (1d) starts after Item 1 → **~4.5 calendar days**
- **Feasibility**: ✅ Fits within 1 week with ~1 day of buffer for review and release

### Trade-offs

| If | Then |
|----|------|
| Item 1 overruns (migrations baseline turns out complex) | Cut Item 4's route schemas to the 3 most-used endpoints; keep `payment-config` schemas. Item 2 can still start after Item 1's test fixes alone |
| Item 2 overruns (encryption key mgmt debates) | Ship encryption with `ENCRYPTION_KEY` hex-decode only; defer SHA-256 derivation path to a hardening follow-up |
| Item 3 overruns | Ship the form without the webhookUrl field (defer to next sprint); core provider + apiKey + environment still delivered |
| Frontend current count already > 340 | Item 5 shrinks to the 2 missing test files (exception-panel, message-tracking) — AC is total-count based |
| GHCR push blocked by permissions | Validate with `docker build` only + `docker/metadata-action` dry-run; defer actual push until repo permission granted |
| E2E job cannot run (frontend not started / no migrations) | Document E2E as backend-contract only; the AC becomes "E2E job executes against a migrate-deployed schema" rather than full browser suite |

---

## Risk Register

### 🔴 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| No `migrations/` directory exists — `prisma migrate deploy` in CI has nothing to apply, and the E2E job has never had a real schema-apply step | High | High | Sprint-start: run `prisma migrate dev --name init` to baseline the current schema, commit the migrations folder. This is inside Item 1's 1d budget |
| E2E job may be fundamentally unrunnable (backend started, but Playwright `baseURL` points at `:3000` with no frontend job) | High | High | Verify on sprint start (Item 1C). Resolve by either starting the frontend in the job or documenting E2E as backend-contract tests and pointing `baseURL`/`API_URL` correctly |
| Existing `PUT /payment-provider` plaintext path remains live after Item 2 — new encrypted path and old path coexist writing to different storage | Medium | High | Old routes delegate to the same `UpsertPaymentProviderConfigUseCase` (which encrypts). No code path writes plaintext after Item 2 |

### 🟡 Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `ENCRYPTION_KEY` default is `''` — encryption service could fail at runtime if misconfigured | Medium | High | Fail closed: `Aes256GcmEncryptionService` throws on empty/short key at construction; document required format in `.env.example`; security-specialist reviews the service |
| Swagger UI exposes internal route structure in production | Medium | Medium | Disable or protect `/docs` when `NODE_ENV === 'production'` (decision recorded in Item 4) |
| Async factory refactor for `ProcessPaymentUseCase` ripples into handlers/tests that call the sync factory | Medium | Medium | Keep a sync factory overload that falls back to env (used by legacy call sites); the async path is used by routes carrying `tenantId`. Full migration can follow |
| GHCR image builds fail on npm workspace install (Dockerfile context/workspace resolution) | Medium | Medium | Validate `docker build` locally before the sprint's CD work is "done" — AC is buildable images |

### 🟢 Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CD `latest` tag collides across environments | Low | Low | Tag strategy `ref_name` (exact version) + `latest`; document that prod pins exact versions |
| Item 5 "60+ new tests" estimate is stale (most listed components already tested) | Low | Low | Target is total-based (>340); measure on sprint start and right-size the delta |
| Swagger schema annotations touch every route file → merge conflicts with Stream A's route changes (Item 2 routes) | Low | Low | Coordinate: Item 2's `payment-config` routes add their own schemas; Item 4 skips files in active PRs or rebases |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] **Item 1**: 2 decision route tests fixed (stale 400 expectation + DB-free isolation); `prisma migrate deploy` in E2E CI job; initial migration baseline committed
- [ ] **Item 2**: `PaymentProviderConfigRepositoryPort` + Prisma impl; `EncryptionPort` + AES-256-GCM service; `Upsert`/`Get` use cases; `PUT/GET /api/tenants/:id/payment-config`; `PaymentProviderResolver` wired into the payment factory with env fallback
- [ ] **Item 3**: `/dashboard/settings` page + `PaymentProviderForm` (provider, apiKey, environment, webhookUrl) with loading/error states and tests
- [ ] **Item 4**: Swagger UI at `/docs`, OpenAPI JSON at `/docs/json`, schemas on main endpoints
- [ ] **Item 5**: `exception-panel` + `message-tracking` test files; thin suites deepened; frontend total > 340 tests
- [ ] **Item 6**: `cd.yml` tag-triggered GHCR publish for backend + frontend images; staging deploy stubbed

### Quality Gates

- [ ] `tsc --noEmit` passes on all workspaces
- [ ] Backend tests **0 failures** (non-E2E); all new tests pass
- [ ] Frontend tests > 340 and all pass
- [ ] No `console.log` or debugging artifacts
- [ ] No hardcoded secrets, URLs, or environment-specific values
- [ ] New use cases and services have ≥80% line coverage

### Architecture Checks

- [ ] Zero new Dependency Rule violations (encryption, Prisma repos, gateway providers all infrastructure; use cases depend only on ports)
- [ ] `EncryptionPort` is the only encryption abstraction the application layer sees
- [ ] `ProcessPaymentUseCase` unchanged in core logic — provider resolution happens in the factory/resolver (composition root)
- [ ] No `switch/if` per provider inside use cases — Strategy Pattern via `PaymentGatewayPort`
- [ ] API key never appears in any API response (masked outputs only)
- [ ] Plaintext key write path eliminated (old routes delegate to encrypted use cases)
- [ ] Prisma migration baseline committed; `migrate deploy` is the single apply mechanism in CI/prod
- [ ] Swagger schema additions do not break request validation on existing routes

### Release

- [ ] Tag `v0.8.0` created
- [ ] Release notes written (Sprint 8 summary — production readiness)
- [ ] CD pipeline triggered by the `v0.8.0` tag publishes both images to GHCR
- [ ] `.env.example` updated with any new variables (e.g., encryption key format note, `NEXT_PUBLIC_DEMO_TENANT_ID` if added)
- [ ] All new specs committed to `specs/`

---

## Artifact Checklist

| Item | Artifacts |
|------|-----------|
| **1** | Updated `apps/backend/src/__tests__/routes/decision.routes.test.ts` (2 fixed tests), updated `.github/workflows/ci.yml` (migrate deploy step + E2E runnability fix), new `apps/backend/src/infrastructure/database/prisma/migrations/` baseline |
| **2** | `application/ports/repositories/payment-provider-config.repository.port.ts`, `infrastructure/database/repositories/payment-provider-config.repository.ts` + mapper, `application/ports/adapters/encryption.port.ts`, `infrastructure/encryption/aes-256-gcm.service.ts`, `domain/entities/payment-provider-config.ts`, `application/usecases/upsert-payment-provider-config.usecase.ts`, `application/usecases/get-payment-provider-config.usecase.ts`, updated `tenant.routes.ts` (new `/payment-config` routes), `application/services/payment-provider-resolver.service.ts`, updated `presentation/factories/create-process-payment.factory.ts`, use case + service test files |
| **3** | `apps/frontend/src/app/dashboard/settings/page.tsx`, `apps/frontend/src/components/payment-provider-form.tsx`, updated `components/index.ts`, `apps/frontend/src/__tests__/components/payment-provider-form.test.tsx` |
| **4** | Updated `apps/backend/src/index.ts` (swagger + swagger-ui registration with `/docs` prefix), route schemas in `tenant.routes.ts`, `client.routes.ts`, `invoice.routes.ts`, `subscription.routes.ts`, `decision.routes.ts` |
| **5** | `apps/frontend/src/__tests__/components/exception-panel.test.tsx`, `apps/frontend/src/__tests__/components/message-tracking.test.tsx`, deepened `loading-skeleton`/`empty-state`/`error-state` suites |
| **6** | `.github/workflows/cd.yml`, verified backend Dockerfile (`prisma generate` build + `migrate deploy` startup), local `docker build` validation |

---

## Release v0.8.0 Checklist

### Pre-Release

- [ ] All 6 items merged to `main`
- [ ] Full test suite passes: backend 0 failures, frontend > 340 tests
- [ ] `npm run build` succeeds on both apps
- [ ] `tsc --noEmit` passes on all workspaces
- [ ] Zero Dependency Rule violations confirmed
- [ ] Prisma migration baseline committed and `migrate deploy` verified in CI
- [ ] `.env.example` updated (encryption key format, tenant-id demo var if added)
- [ ] `docker build` succeeds locally for backend and frontend images
- [ ] CD workflow validated (YAML parse + dry-run if GHCR permissions allow)

### Release

- [ ] Tag `v0.8.0` created → triggers `cd.yml` → both images published to GHCR
- [ ] Release notes written (Sprint 8 summary — production readiness)
- [ ] GitHub release with changelog

---

## Sprint 8 Specs to Generate

Beyond this plan, the following SDD specs should be created before implementation starts (per item):

| Spec | Domain | Priority |
|------|--------|----------|
| `specs/payment-provider-config.spec.md` | `PaymentProviderConfigRepositoryPort`, `EncryptionPort`, `Upsert`/`Get` use cases, routes, resolver wiring | High (before Item 2) |
| `specs/tenant-settings-ui.spec.md` | Settings page + `PaymentProviderForm` contract with `lib/api.ts` | Medium (before Item 3) |
| `specs/api-docs.spec.md` | Swagger registration + route schema inventory | Low (before Item 4) |
| `specs/cd-pipeline.spec.md` | GHCR publish workflow, tag strategy, staging placeholder | Low (before Item 6) |

---

*Plan prepared by: Architect Agent*
*Date: 2026-08-13*
*Related documents: `docs/sprint-7-plan.md`, `docs/sprint-6.1-plan.md`, `docs/sprint-6-plan.md`, `docs/review-cto.md`, `docs/security-spec.md`, `specs/*`*
