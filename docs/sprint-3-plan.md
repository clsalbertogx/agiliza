# Sprint 3 Plan — Security Hardening + Production Readiness

**Theme**: Security Hardening & Architecture Debt Remediation  
**Period**: 2026-07-30 to 2026-08-12 (2 weeks)  
**Target Release**: `v0.3.0`

---

## Pre-Sprint: Architecture Debt Cleanup (Completed Jul 29)

The following items were identified and FIXED during the architecture audit before Sprint 3 execution:

| # | Finding | Status | Change |
|---|---------|--------|--------|
| 1 | `presentation/factories/create-cash-flow.factory.ts` — singleton pattern (violation of CTO rule against global singletons) | ✅ Fixed | Removed `cashFlowServiceInstance` global variable; factory now creates fresh instance per call |
| 2 | `application/services/cash-flow.service.ts` — defined port interfaces locally instead of importing from `application/ports/` | ✅ Fixed | Extracted `AnalyticsInvoiceRepositoryPort` and `AnalyticsClientRepositoryPort` to `application/ports/repositories/analytics.repository.port.ts` |
| 3 | 6 route files had module-level instantiations (singletons at import time): `client.routes.ts`, `invoice.routes.ts`, `webhook.routes.ts`, `reminder.routes.ts`, `onboarding.routes.ts`, `decision.routes.ts` | ✅ Fixed | Moved all instantiations inside the route registration functions (lazy creation, better testability) |
| 4 | Project-wide TypeScript `@/` path aliases + `tsx` runtime migration | ✅ Fixed | Added `paths` in `tsconfig.json`, `resolve.alias` in `vitest.config.ts`, switched to `tsx` runtime, converted **78 files** to use `@/` imports |

### Identified & Deferred to Sprint 3

The following issues were found but are BEYOND the scope of a quick fix — they require the Sprint 3 refactoring effort:

| # | Finding | Sprint 3 Issue | Priority |
|---|---------|---------------|----------|
| 1 | **Dependency Rule violation**: `application/services/onboarding.service.ts` imports infrastructure directly (`ClientRepository`, `EventRepository`, `EvolutionMessageProvider`) | New sub-issue of #5 | 🔴 Critical |
| 2 | **Dependency Rule violation**: `application/services/reminder.service.ts` imports infrastructure directly (`InvoiceRepository`, `ClientRepository`, `EventRepository`, `addJob`, `EvolutionMessageProvider`) | New sub-issue of #5 | 🔴 Critical |
| 3 | **Dual repository implementations**: `ClientRepository` (BaseRepository-based) + `PrismaClientRepository` (Port-based) in the same file (`client.repository.ts`). Same for `InvoiceRepository` + `PrismaInvoiceRepository` in `invoice.repository.ts`, and `TenantRepository` + `PrismaTenantRepository` in `tenant.repository.ts`. | #5 (Repository Mapping) | 🟡 High |
| 4 | `packages/shared/` is completely orphaned — **zero** files in backend or frontend import from `@agiliza/shared`. Types are duplicated with domain entities. | #6 (Shared Package Dedup) | 🟡 High |
| 5 | `EventRepository` has no port interface — application services import it directly from infrastructure | #5 (create `EventRepositoryPort`) | 🟡 High |
| 6 | No `QueuePort` interface — `addJob` from `infrastructure/queue` is imported directly by `reminder.service.ts` | #5 (create `QueuePort`) | 🟡 Medium |
| 7 | `OnboardingService` and `ReminderService` instantiate their own dependencies (no constructor DI) | #5 (refactor to DI) | 🟡 High |
| 8 | Backend Dockerfile reescrito para usar `tsx src/index.ts` em vez de `node dist/index.js` | N/A (already done) | 🟢 Low | The `build` step now runs `tsc --noEmit` (type-check only); `tsx` handles runtime path resolution. Verify Issue #12 doesn't conflict with this change. |

---

## Sprint Goal

Harden the platform for production-grade security, complete the EventBus wiring for domain-driven side effects, eliminate type duplication between shared package and domain, and establish frontend/E2E quality foundations. At the end of this sprint, the platform must have zero critical security findings, events must trigger real handlers, and the frontend must have component tests and two E2E smoke tests passing.

---

## Dependency Graph (Issue Ordering)

```
                         ┌──────────────────────────────┐
                         │   Issue 1 (JWT Review+Test)  │
                         └──────────┬───────────────────┘
                                    ▼
               ┌─────────────────────────────────────────┐
               │   Issue 2 (Helmet Check + Global Error  │
               │            Handler)                      │
               └──────────────────┬──────────────────────┘
                                  ▼
                         ┌─────────────────────────┐
                         │   Issue 3 (Rate Limit)   │
                         └──────────┬──────────────┘
                                    ▼
               ┌─────────────────────────────────────────┐
               │   Issue 4 (EventBus Wiring — Handlers)  │
               └──────┬──────────────────┬───────────────┘
                      │                  │
                      ▼                  ▼
          ┌───────────────────┐  ┌──────────────────┐
          │  Issue 5 (Repo    │  │  Issue 6 (Shared  │
          │  Mapping toDomain)│  │  Package Dedup)   │
          └───────┬───────────┘  └────────┬─────────┘
                  │                       │
                  └───────────┬───────────┘
                              ▼
          ┌───────────────────────────────────────┐
          │  Issue 7 (Frontend Components)        │
          └──────────────┬────────────────────────┘
                         ▼
          ┌───────────────────────────────────────┐
          │  Issue 8 (Frontend Tests)             │
          └──────────────┬────────────────────────┘
                         ▼
          ┌───────────────────────────────────────┐
          │  Issue 9 (E2E Tests — Playwright)     │
          └──────────────┬────────────────────────┘
                         ▼
          ┌───────────────────────────────────────┐
          │  Issue 10 (CI/CD Refinement)          │
          └──────────────┬────────────────────────┘
                         ▼
          ┌───────────────────────────────────────┐
          │  Issue 11 (UUID v7 Migration)         │
          └──────────────┬────────────────────────┘
                         ▼
          ┌───────────────────────────────────────┐
          │  Issue 12 (Docker Compose Refinement) │
          └───────────────────────────────────────┘
```

**Parallel Streams:**
- **Stream A (Security)**: Issues 1 → 2 → 3 (sequential)
- **Stream B (Architecture)**: Issues 4 → 5 → 6 (sequential after 3)
- **Stream C (Frontend)**: Issue 7 (parallel with A)
- **Stream D (Quality)**: Issues 8 → 9 (sequential after 7)
- **Stream E (Infrastructure)**: Issues 10 → 11 → 12 (parallel with A, can start after 4)

---

## Issue 1: Fix JWT Signature Verification — Review, Test & Harden

**Addresses**: CTO C-07, Tech Nucleus I-01  
**Effort**: 0.5 day  
**Blocking**: Issue 2 (security baseline must pass first)  
**Dependencies**: None (JWT was already fixed, this is review + hardening)

### Description
The `verifyToken()` function in `jwt.strategy.ts` was patched during Sprint 2 to include proper signature verification using `timingSafeEqual`. This issue audits the fix, adds unit tests for edge cases, and hardens the implementation with:

1. **Audit current implementation** — verify the fix matches CTO's suggested code exactly
2. **Add edge case tests**:
   - Token with wrong signature → returns null
   - Token with expired `exp` → returns null
   - Token with malformed body → returns null (caught by try/catch)
   - Token with missing parts → returns null
   - Token with correct signature and valid exp → returns payload
   - Timing attack resilience test
3. **Verify `createToken()` consistency** — ensure the signing algorithm in `createToken` matches `verifyToken`
4. **Add integration test** — create token → verify token → verify payload fields

### Approach
- Jest/Vitest unit tests in `apps/backend/src/__tests__/security/auth.test.ts`
- Use `crypto.timingSafeEqual` for comparisons (already done)
- No architectural changes — pure test coverage + validation

### Acceptance Criteria
- [ ] JWT verification unit test suite with ≥8 edge case tests
- [ ] All tests pass: forged token rejected, expired token rejected, malformed token rejected, valid token accepted
- [ ] Integration test: `createToken()` → `verifyToken()` round-trip verifies all payload fields
- [ ] `createToken()` and `verifyToken()` use the exact same signing algorithm
- [ ] No timing attack vector detectable (constant-time comparison for all branches)

---

## Issue 2: Security Headers (Helmet) Verification + Global Error Handler

**Addresses**: CTO H-04, H-07, Tech Nucleus I-05  
**Effort**: 1 day  
**Blocking**: Issue 3 (error handling is foundation for rate limiting responses)  
**Dependencies**: Issue 1

### Description

Two independent security/quality items grouped for efficiency:

#### 2A: Helmet Verification
`@fastify/helmet` is already registered in `index.ts` with CSP, HSTS, X-Frame-Options, and X-Content-Type-Options. Audit and verify:
- CSP directives match security spec (block inline scripts except `'unsafe-inline'` for Next.js)
- HSTS preload enabled
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Verify via integration test that security headers are present in all responses (except public endpoints)

#### 2B: Global Error Handler (NEW — H-07)

Create `presentation/handler.ts` — a centralized Fastify error handler:

```typescript
// presentation/handler.ts
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApplicationError } from '@/application/errors/application.error';
import { env } from '@/config/env';

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // 1. Zod validation errors → 400
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // 2. ApplicationError (from use cases) → use its statusCode
  if (error instanceof ApplicationError) {
    reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  // 3. Fastify built-in errors (rate-limit, 404, etc.)
  const fastifyError = error as FastifyError;
  if (fastifyError.statusCode) {
    reply.status(fastifyError.statusCode).send({
      error: {
        code: fastifyError.code || 'FASTIFY_ERROR',
        message: fastifyError.message,
      },
    });
    return;
  }

  // 4. Unknown errors → 500 (never leak stack traces in production)
  console.error('[Unhandled Error]', error);
  reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message,
    },
  });
}
```

### Approach
- Register error handler in `index.ts` via `app.setErrorHandler(errorHandler)`
- Existing `ApplicationError` is already used by use cases — this handler is the catch-all
- Backward compatible: all existing routes continue to work, error responses now follow standard format

### Acceptance Criteria
- [ ] `presentation/handler.ts` created with the 4-tier error classification
- [ ] `app.setErrorHandler()` registered in `index.ts` (after all routes)
- [ ] Integration test: Zod validation error returns `{ error: { code: "VALIDATION_ERROR", ... } }`
- [ ] Integration test: ApplicationError returns correct HTTP status code
- [ ] Integration test: Unknown error returns 500 (no stack trace in production mode)
- [ ] Integration test: All responses include security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)

---

## Issue 3: Rate Limiting Registration — Redis Store Verification

**Addresses**: Tech Nucleus I-02, Security spec rate limiting  
**Effort**: 0.5 day  
**Blocking**: Issue 4 (security baseline)  
**Dependencies**: Issue 2

### Description
`@fastify/rate-limit` is already registered in `index.ts` with Redis. Verify, test, and harden:

1. **Audit current registration** — verify Redis connection, key generator, limits
2. **Add configuration for tiered limits per the security spec**:
   - Global: 100 req/min per tenant (already set)
   - Auth endpoints: 20 req/min per IP
   - Webhook endpoints: 10 req/s per provider IP
3. **Add integration tests**:
   - Send 101 requests in 1 minute → 101st is rate limited (429)
   - Public endpoint (health) not rate limited (or has higher limit)
   - Webhook endpoint with higher throughput limit
4. **Add `RATE_LIMIT_MAX` env var validation** (already in env.ts schema)

### Approach
- Create route-specific rate limit overrides using `app.route()` config or per-route `config` property
- Test with Redis in CI (service already configured in ci.yml)
- All limits are configurable via env vars

### Acceptance Criteria
- [ ] Tiered rate limits configured: auth (20/min), webhooks (10/s), default (100/min)
- [ ] Integration test: rate limit exceeded returns 429 with `retry-after` header
- [ ] Integration test: health endpoint bypasses rate limit
- [ ] Redis is used as rate limit store (not memory)
- [ ] Key generator uses `tenantId` when available, falls back to IP

---

## Issue 4: EventBus Wiring — Domain Event Handlers Subscription

**Addresses**: CTO M-02  
**Effort**: 2 days  
**Blocking**: Issue 5 (repos need toDomain for event metadata lookups)  
**Dependencies**: Issue 3

### Description
Currently, domain events are **emitted** by use cases (`this.eventBus.publish(event)`) but **never consumed** — the `InMemoryEventBus` dispatches to an empty handler map. This issue wires 3 concrete handlers to their respective events:

#### 4A: Create Handler Interfaces & Base

Define each handler as a class implementing a simple `handle(event)` method pattern:

```typescript
// src/application/events/handlers/send-receipt.handler.ts
export class SendReceiptHandler {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
    private readonly messageProvider: MessageProviderPort
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType !== 'payment.confirmed') return;
    // Look up invoice + client details
    // Queue WhatsApp receipt message via Evolution API
    // This is an async fire-and-forget — errors are logged, not thrown
  }
}
```

#### 4B: Three Handlers

| Handler | Subscribes To | Action |
|---------|--------------|--------|
| **`SendReceiptHandler`** | `payment.confirmed` | Send WhatsApp receipt with invoice details |
| **`UpdateRiskScoreHandler`** | `payment.confirmed`, `payment.failed`, `invoice.overdue`, `message.read`, `message.clicked` | Recalculate client risk score via RiskCalculatorService |
| **`NotifyOutboundHandler`** | `client.created`, `payment.confirmed`, `invoice.overdue`, `decision.made` | If tenant has outbound webhook configured, POST event payload |

#### 4C: EventBus Wiring at Composition Root

In `presentation/factories/`, register handlers at server startup:

```typescript
// src/presentation/factories/register-event-handlers.ts
export function registerEventHandlers(eventBus: EventBusPort): void {
  const invoiceRepo = new PrismaInvoiceRepository();
  const clientRepo = new PrismaClientRepository();
  const messageProvider = new EvolutionMessageProvider(env.EVOLUTION_API_URL, env.EVOLUTION_API_KEY);
  const riskCalculator = new RiskCalculatorService();
  const webhookNotifier = new OutboundWebhookNotifier();

  const sendReceipt = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider);
  const updateRisk = new UpdateRiskScoreHandler(clientRepo, invoiceRepo, riskCalculator);
  const notifyOutbound = new NotifyOutboundHandler(/* ... */);

  eventBus.subscribe('payment.confirmed', (e) => sendReceipt.handle(e));
  eventBus.subscribe('payment.confirmed', (e) => updateRisk.handle(e));
  eventBus.subscribe('payment.failed', (e) => updateRisk.handle(e));
  eventBus.subscribe('invoice.overdue', (e) => updateRisk.handle(e));
  eventBus.subscribe('message.read', (e) => updateRisk.handle(e));
  eventBus.subscribe('message.clicked', (e) => updateRisk.handle(e));
  eventBus.subscribe('client.created', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('payment.confirmed', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('invoice.overdue', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('decision.made', (e) => notifyOutbound.handle(e));
}
```

#### 4D: Wire into Server Bootstrap

Call `registerEventHandlers(eventBus)` from `index.ts` after building the app but before starting the server.

### Approach
- Handlers are **async fire-and-forget** — errors are logged, never thrown (don't crash the server)
- Handler implementations are **synchronous within the in-memory bus** (production will use BullMQ)
- Each handler has **unit tests** with mocked dependencies
- The existing `InMemoryEventBus` works for MVP — RedisEventBus is post-MVP

### Acceptance Criteria
- [ ] `SendReceiptHandler` exists and subscribes to `payment.confirmed`
- [ ] `UpdateRiskScoreHandler` exists and subscribes to 5 event types
- [ ] `NotifyOutboundHandler` exists and subscribes to 4 event types
- [ ] `registerEventHandlers()` factory function exists and is called from `index.ts`
- [ ] Unit tests for each handler: verify correct events trigger correct actions
- [ ] Unit test: handler error does not crash server (logged, swallowed)
- [ ] Existing `CreateClientUseCase` integration test: event is published AND consumed

---

## Issue 5: Repository → Domain Entity Mapping (toDomain / toPersistence)

**Addresses**: CTO M-06  
**Effort**: 1.5 days  
**Blocking**: Issue 7 (frontend components need clean domain types)  
**Dependencies**: Issue 4

### Description
Currently, `PrismaClientRepository` has a `toClient()` helper that coerces Prisma rows to domain types, but the pattern is not standardized across all repositories. This issue creates a consistent `toDomain()` / `toPersistence()` mapping pattern:

#### 5A: Define Mapping Interface

```typescript
// infrastructure/database/mappers/mapper.interface.ts
export interface DomainMapper<TPersistence, TDomain> {
  toDomain(persistence: TPersistence): TDomain;
  toPersistence(domain: TDomain): TPersistence;
}
```

#### 5B: Create Mappers for Each Entity

| Entity | Mapper | Key Transformations |
|--------|--------|-------------------|
| Client | `ClientMapper` | Convert date strings → Date objects; numeric fields → numbers; enums → proper VO types |
| Invoice | `InvoiceMapper` | Convert `amount` (Decimal → number); `status` → InvoiceStatus enum; dates → Date |
| Payment | `PaymentMapper` | Convert amounts, dates, enums |
| Tenant | `TenantMapper` | Niche → enum, plan → enum |
| Event | `EventMapper` | Standardize timestamps |

#### 5C: Update Repository Implementations

Each Prisma repository gets a mapper instance and uses it in all public methods:
- `findById()` → calls `toDomain()`
- `findMany()` → calls `.map(toDomain)`
- `create()` → calls `toPersistence()` on input, then `toDomain()` on result
- `update()` → calls `toPersistence()` on input, then `toDomain()` on result

#### 5D: Update Existing References

- Remove inline `toClient()` from `PrismaClientRepository` and use `ClientMapper` instead
- Ensure all existing tests continue to pass (behavior preserved)

### Approach
- Mappers are pure functions (no class overhead) — static methods on a class for discoverability
- Each mapper is unit-testable with known input/output pairs
- Types are explicit: no `as any` casts in mappers
- Backward compatible: existing factory functions continue to work unchanged

### Acceptance Criteria
- [ ] `DomainMapper<TP, TD>` interface defined in `infrastructure/database/mappers/`
- [ ] `ClientMapper` with `toDomain()` and `toPersistence()` implemented and tested
- [ ] `InvoiceMapper`, `PaymentMapper`, `TenantMapper`, `EventMapper` implemented and tested
- [ ] All Prisma repositories use mappers instead of inline type coercion
- [ ] Existing tests pass without modification (behavioral equivalence)
- [ ] Zero `as any` casts in mapper implementations

---

## Issue 6: Shared Package Type Deduplication

**Addresses**: CTO H-01, Tech Nucleus I-14  
**Effort**: 1 day  
**Blocking**: Issue 7 (frontend types depend on shared package)  
**Dependencies**: Issue 5 (domain types now stable)

### Description
`packages/shared/src/index.ts` defines types (`InvoiceStatus`, `PaymentMethod`, `MessageChannel`, `ClientRiskScore`, `ClientProfile`, `Invoice`, `PaymentEvent`) that **duplicate** domain types in `apps/backend/src/domain/entities/` and `apps/backend/src/domain/value-objects/`. This creates a drift risk — changes in domain may not be reflected in shared.

#### Solution: Make `packages/shared` re-export from `domain` (not redefine)

**Option A (Preferred — for monorepo)**: Change `packages/shared` to re-export from `@agiliza/backend/domain`:
```typescript
// packages/shared/src/index.ts
// This package is the public API contract for frontend ↔ backend communication.
// Types are defined in apps/backend/src/domain/ — this file re-exports them.
export type { PaymentProvider, PaymentMethod, InvoiceStatus, ClientRiskScore, MessageChannel } from '../../backend/src/domain/value-objects/index';
export type { ClientProfile, Invoice } from '../../backend/src/domain/entities/index';
export type { PaymentEvent } from '../../backend/src/domain/events/domain-events';
```

**Option B (If cross-app imports are not allowed by Turborepo)**: Define types ONCE in shared package and import from there in domain. Domain entities validate using VO classes but reference shared enums.

**Recommendation**: Option A first; if Turborepo prevents cross-package source imports, fall back to Option B and consolidate all type definitions in shared, then have domain import from shared.

#### Additional cleanup:
- Remove `// Shared types for Agiliza platform` comment and replace with doc comment about source of truth
- Update frontend imports to use `@agiliza/shared` consistently (verify no direct domain type imports in frontend)
- Update backend domain entities to export from a single `domain/index.ts` barrel file

### Approach
- Audit all frontend imports of domain types (should come from `@agiliza/shared`, not `../../backend/...`)
- Audit all backend imports of shared types (should come from `domain/`, not `@agiliza/shared`)
- If Option A works: minimal change, big impact on maintainability
- If cross-package imports cause build issues: Option B with explicit consolidation

### Acceptance Criteria
- [ ] No type definitions duplicated between `packages/shared` and `apps/backend/src/domain/`
- [ ] `packages/shared/src/index.ts` either re-exports domain types or is the single source of truth
- [ ] Frontend imports types only from `@agiliza/shared` (zero direct domain imports)
- [ ] Backend imports domain types from `domain/` (zero shared package imports for types)
- [ ] `tsc --noEmit` passes on both apps
- [ ] Build pipeline completes without errors

---

## Issue 7: Frontend Component Completion — Build Remaining 11 Domain Components

**Addresses**: Sprint 2 deferred (Issue 9 — only 8 of 19 components built)  
**Effort**: 3 days  
**Blocking**: Issue 8 (frontend tests need components to test)  
**Dependencies**: Issue 6 (shared types) — low dependency, can parallelize

### Description
Sprint 2 delivered 8 of the 19 domain components specified in the UX/UI spec. This issue builds the remaining 11 components:

#### Already Built (Sprint 2):
- `client-table` (as `ClientCard` + `InvoiceTable`)
- `invoice-card` (as `InvoiceTable`)
- `pix-payment-flow` (as `PaymentStatus`)
- `risk-badge`
- `onboarding-wizard` (not found — new)
- `collection-timeline` (not found — new)
- `kanban-board` (not found — new)
- `report-chart` (not found — new)

#### Remaining 11 Components (This Issue):

| # | Component | Description | Props Interface |
|---|-----------|-------------|-----------------|
| 1 | **`onboarding-wizard.tsx`** | 3-step wizard for client onboarding (channel, time, lead days) | `clientId`, `onComplete` |
| 2 | **`collection-timeline.tsx`** | Visual timeline of reminder messages sent to a client | `clientId`, `invoiceId` |
| 3 | **`kanban-board.tsx`** | Kanban board for invoice management (Pending/Overdue/Paid) | `invoices[]`, `onStatusChange` |
| 4 | **`report-chart.tsx`** | Reusable chart wrapper (bar, line, pie) with date filters | `type`, `data`, `filters` |
| 5 | **`pix-payment-flow.tsx`** | Full PIX payment flow: QR code display, copy-paste button, countdown timer, status polling | `invoiceId`, `pixData`, `onPaid` |
| 6 | **`client-detail-card.tsx`** | Extended client detail with risk score breakdown, payment stats | `client`, `onEdit` |
| 7 | **`invoice-form.tsx`** | Create/edit invoice form with client selector, amount, due date, payment method | `clients[]`, `onSubmit` |
| 8 | **`payment-history.tsx`** | Paginated payment history table with status badges and amounts | `clientId`, `invoices[]` |
| 9 | **`message-tracking.tsx`** | Message delivery tracking: sent→delivered→read→clicked timeline per message | `messageId`, `events[]` |
| 10 | **`exception-panel.tsx`** | Exceptions/reconciliation panel with flagged items, manual retry | `exceptions[]`, `onRetry` |
| 11 | **`notification-banner.tsx`** | Reusable alert/notification banner (success, error, warning, info) with dismiss | `type`, `message`, `onDismiss` |

### Approach
- Components are **pure presentational** (server/API calls are the parent page's responsibility)
- All components use existing design tokens from `tailwind.config.ts`
- Props are fully typed (exported as TypeScript interfaces)
- Each component handles: **loading** (skeleton), **empty** (EmptyState component), **error** (ErrorState component), and **success** states
- Follow shadcn/ui conventions where applicable
- Install any additional missing Radix UI packages: `@radix-ui/react-progress`, `@radix-ui/react-scroll-area`

### Acceptance Criteria
- [ ] All 11 components built with TypeScript interfaces and exported from `components/index.ts`
- [ ] Each component handles loading, empty, error, and success states
- [ ] Components use design token colors (no hardcoded `#hex` values)
- [ ] Components are responsive (mobile-first, tested at 320px, 768px, 1280px)
- [ ] `components/index.ts` updated to export all new components
- [ ] TypeScript compiles without errors

---

## Issue 8: Frontend Test Setup — @testing-library + Component Tests

**Addresses**: Missing frontend test coverage  
**Effort**: 1.5 days  
**Blocking**: Issue 9 (E2E tests depend on stable frontend)  
**Dependencies**: Issue 7 (components needed to test)

### Description
Establish frontend testing infrastructure and write component tests:

#### 8A: Install & Configure Testing Tools

```bash
# Already in package.json? Check and ensure:
- vitest (already present)
- @testing-library/react
- @testing-library/jest-dom
- @testing-library/user-event
- jsdom
- @vitejs/plugin-react
```

Create/update `apps/frontend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/components/**/*.tsx'],
      thresholds: { statements: 60, branches: 50, functions: 60, lines: 60 },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

Create `apps/frontend/src/__tests__/setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

#### 8B: Write Component Tests (3 critical components)

1. **`risk-badge.test.tsx`** — verify color by risk score, tooltip content, loading/error states
2. **`kpi-card.test.tsx`** — verify rendering of value, label, trend indicator, loading skeleton
3. **`invoice-table.test.tsx`** — verify row rendering, status badge colors, empty state, sortable headers

#### 8C: Add Test Script to `package.json`
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Approach
- MSW (Mock Service Worker) not needed for component-level tests (pure UI)
- If components make API calls, mock at the module level with `vi.mock()`
- Tests follow Arrange-Act-Assert pattern
- All tests are idempotent (no shared state)

### Acceptance Criteria
- [ ] `apps/frontend/vitest.config.ts` exists with jsdom environment
- [ ] `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` installed
- [ ] Setup file with jest-dom matchers configured
- [ ] `pnpm --filter frontend test` passes with ≥3 component tests
- [ ] Coverage thresholds configured (≥60% statements, branches, functions, lines)
- [ ] Tests run in CI (ci.yml frontend test step works, not skipped)

---

## Issue 9: E2E Test Foundation — Playwright + 2 Critical Paths

**Addresses**: Missing E2E coverage  
**Effort**: 2 days  
**Blocking**: Nothing (can run in parallel with frontend)  
**Dependencies**: Issues 7, 8 (frontend stable for testing)

### Description
Establish end-to-end testing foundation with Playwright:

#### 9A: Install & Configure Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Create `e2e/playwright.config.ts` at monorepo root:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

#### 9B: Write 2 Critical Path E2E Tests

**Test 1: "Create client → see client in dashboard"**
```typescript
// e2e/tests/client-flow.spec.ts
test('create client and verify it appears in the dashboard', async ({ page }) => {
  // 1. Navigate to client creation page
  // 2. Fill in client details (name, phone, channel)
  // 3. Submit form
  // 4. Verify success toast/redirect
  // 5. Navigate to client list
  // 6. Verify new client appears in table
});
```

**Test 2: "Create invoice → view in billing page"**
```typescript
// e2e/tests/invoice-flow.spec.ts
test('create invoice and verify it appears in billing', async ({ page }) => {
  // 1. Navigate to invoice creation page
  // 2. Select client, enter amount, due date
  // 3. Submit form
  // 4. Verify success
  // 5. Navigate to billing page
  // 6. Verify invoice appears with correct amount and status
});
```

#### 9C: Create `docker-compose.e2e.yml`

Isolated environment with test database:
```yaml
version: '3.8'
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: agiliza_test
    ports: ['5433:5432']
  redis-test:
    image: redis:7-alpine
    ports: ['6380:6379']
```

#### 9D: Add E2E Scripts to Root `package.json`
```json
{
  "scripts": {
    "test:e2e": "playwright test --config=e2e/playwright.config.ts",
    "test:e2e:ui": "playwright test --ui --config=e2e/playwright.config.ts"
  }
}
```

### Approach
- E2E tests run against **real backend + real database** (docker-compose.e2e.yml)
- Tests are **idempotent** — each test creates its own data and cleans up
- No mocking — tests exercise the full stack (frontend → backend → Prisma → PostgreSQL)
- CI pipeline runs E2E as a separate job (after deploy to test environment)

### Acceptance Criteria
- [ ] Playwright installed and configured at monorepo root
- [ ] `e2e/playwright.config.ts` exists with chromium project
- [ ] Test 1 (create client → see in dashboard) passes end-to-end
- [ ] Test 2 (create invoice → see in billing) passes end-to-end
- [ ] `docker-compose.e2e.yml` exists with isolated test database
- [ ] `pnpm test:e2e` runs both tests in CI
- [ ] Playwright HTML report generated on failure

---

## Issue 10: CI/CD Pipeline Refinement

**Addresses**: Sprint 2 deferred (available but needs refinement)  
**Effort**: 1 day  
**Blocking**: Nothing (improvement, not greenfield)  
**Dependencies**: Issues 4, 5, 6 (CI should run against mature codebase)

### Description
The CI/CD pipeline exists (`ci.yml`, `security.yml`) but has gaps:

#### 10A: Fix Working-Directory Paths
- Audit all `working-directory` paths in `ci.yml` — ensure they match monorepo structure
- Switch from `cd apps/backend && npx vitest` to root-level `pnpm --filter backend test`

#### 10B: Add Coverage Thresholds
- Add `--coverage.thresholds` to vitest configs
- CI fails if coverage drops below configured thresholds:
  - Backend: ≥70% statements, ≥60% branches, ≥70% functions
  - Frontend: ≥60% statements, ≥50% branches, ≥60% functions

#### 10C: Add E2E Job
```yaml
e2e-tests:
  name: E2E Tests
  needs: test
  runs-on: ubuntu-latest
  services:
    postgres: { ... }
    redis: { ... }
  steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
    - name: Install dependencies
      run: npm ci
    - name: Build
      run: npm run build
    - name: Run E2E Tests
      run: npx playwright test --config=e2e/playwright.config.ts
      env:
        DATABASE_URL: postgresql://dev:dev@localhost:5432/agiliza
        REDIS_URL: redis://localhost:6379
```

#### 10D: Add Dependency Vulnerability Scan to CI
- Add `npm audit` step after install
- Add `--audit` flag to install in CI (or separate step that fails on critical/moderate)
- Add scheduled (weekly) `npm audit` workflow

#### 10E: Add Turborepo Caching
- Configure Turborepo remote caching for faster CI
- Add `turbo.json` task outputs for `test`, `lint`, `typecheck`, `build`

### Approach
- Incremental changes to existing workflows — not rewriting from scratch
- Each change is independently verifiable
- Coverage thresholds start conservative and increase in future sprints

### Acceptance Criteria
- [ ] All `working-directory` references use root npm scripts (`pnpm --filter ...`)
- [ ] Coverage thresholds configured: backend ≥70% stmts, frontend ≥60% stmts
- [ ] CI fails if coverage drops below thresholds
- [ ] E2E job in CI passes (even if skipped for PRs without E2E label)
- [ ] `npm audit` runs in CI, fails on critical vulnerabilities
- [ ] Turborepo caching configured — CI completes < 5 min on cache hit
- [ ] Weekly `security.yml` already exists and runs `npm audit` + dependency check

---

## Issue 11: UUID v7 Migration

**Addresses**: CTO M-03, ADR-003 compliance  
**Effort**: 1 day  
**Blocking**: Nothing (can parallelize)  
**Dependencies**: Issue 5 (entity mappers) — low coupling

### Description
ADR-003 mandates UUID v7 (time-ordered UUIDs) for all entities. Currently, the codebase uses `crypto.randomUUID()` (UUID v4) in 10+ locations. UUID v7 provides better database index performance (sequential insertion) and time-ordering.

#### 11A: Install UUID v7 Package

```bash
npm install --save uuid@11
npm install --save-dev @types/uuid
```

Or use the `uuidv7` package:
```bash
npm install --save uuidv7
```

#### 11B: Create UUID Service

```typescript
// infrastructure/uuid/uuid.service.ts
import { v7 as uuidv7 } from 'uuid';

export function generateUUID(): string {
  return uuidv7();
}

export function validateUUID(id: string): boolean {
  // UUID v4 and v7 have different version bits
  // Accept both for backward compatibility during migration
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
```

#### 11C: Replace All `crypto.randomUUID()` Calls

Find and replace in these files:

| File | Line | Current | Replace With |
|------|------|---------|-------------|
| `domain/entities/base.entity.ts` | 9 | `randomUUID()` | `generateUUID()` |
| `domain/entities/tenant.ts` | 29 | `crypto.randomUUID()` | `generateUUID()` |
| `domain/entities/invoice.ts` | 40 | `crypto.randomUUID()` | `generateUUID()` |
| `domain/events/domain-events.ts` | 30 | `crypto.randomUUID()` | `generateUUID()` |
| `application/usecases/create-client.usecase.ts` | 58 | `crypto.randomUUID()` | `generateUUID()` |
| `infrastructure/messaging/evolution/...` | 26,45 | `crypto.randomUUID()` | `generateUUID()` |
| `infrastructure/payment/asaas.provider.ts` | 34 | `crypto.randomUUID()` | `generateUUID()` |
| `routes/tenant.routes.ts` | 50 | `crypto.randomUUID()` | `generateUUID()` |

#### 11D: Update Prisma Schema

Change `@default(uuid())` to a custom `@default(uuid7())` is not directly supported by Prisma — keep `@default(uuid())` and generate UUIDs in application code (current pattern). The Prisma `uuid()` function generates UUID v4, but since we override with app-generated UUID v7, this is fine.

### Approach
- Use `uuid` package v11 (supports UUID v7 via `v7()`)
- Create a `validateUUID()` function that accepts UUID v4 (existing data) and v7 (new data) for migration period
- No database migration needed (PostgreSQL UUID column accepts any UUID version)
- Atomic change: replace all `crypto.randomUUID()` → `generateUUID()` in a single commit

### Acceptance Criteria
- [ ] `uuid` (v11) or `uuidv7` package installed
- [ ] `infrastructure/uuid/uuid.service.ts` created with `generateUUID()` using UUID v7
- [ ] All `crypto.randomUUID()` calls replaced with `generateUUID()`
- [ ] `validateUUID()` accepts both UUID v4 and v7
- [ ] All existing tests pass (UUID generation is tested through entity creation)
- [ ] `tsc --noEmit` passes with new UUID types

---

## Issue 12: Docker Compose Refinement — Healthcheck Polish + Redis Volume

**Addresses**: Tech Nucleus I-16 (partial), Sprint 2 deferred  
**Effort**: 0.5 day  
**Blocking**: Nothing (polish task)  
**Dependencies**: Nothing (can parallelize)

### Description
Review and polish Docker Compose configurations:

#### 12A: Add Redis Volume to Dev Compose

`docker-compose.dev.yml` currently has `postgres_data` volume but no `redis_data` volume — add it:
```yaml
services:
  redis:
    # ... existing config
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:        # ADD THIS
```

#### 12B: Add Start Period to Backend Healthcheck

The prod compose healthcheck already has `start_period` for frontend but not backend. Add:
```yaml
backend:
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3333/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s    # ADD THIS (Node server takes time to init)
```

#### 12C: Add `restart: unless-stopped` to Redis in Dev Compose

Currently only postgres has restart policy in dev:
```yaml
redis:
  restart: unless-stopped    # ADD THIS
```

#### 12D: Verify All Services Use Named Networks

Audit both compose files to ensure all services are on the same named network (no default bridge):
- Dev: `agiliza-net` — all services ✅
- Prod: `internal` — all services ✅

#### 12E: Add Memory Limits to Dev Compose (Optional Best Practice)

```yaml
backend:
  mem_limit: 512m
  mem_reservation: 256m

frontend:
  mem_limit: 512m
  mem_reservation: 256m

redis:
  mem_limit: 256m

postgres:
  mem_limit: 512m
```

### Approach
- Changes are purely additive (no removal of existing config)
- Dev compose remains developer-friendly (ports exposed, etc.)
- All changes are backward compatible

### Acceptance Criteria
- [ ] `redis_data` volume exists in `docker-compose.dev.yml`
- [ ] Backend healthcheck has `start_period: 30s` in prod compose
- [ ] Redis service has `restart: unless-stopped` in dev compose
- [ ] Memory limits added to dev compose services
- [ ] `docker compose up` works without warnings
- [ ] `docker compose down -v` cleans up volumes correctly (postgres_data + redis_data)

---

## Sprint 3 Effort Summary

| # | Issue | Days | Dependencies | Theme |
|---|-------|------|--------------|-------|
| 1 | JWT Verification — Review, Test & Harden | 0.5 | None | Security |
| 2 | Security Headers + Global Error Handler | 1 | #1 | Security |
| 3 | Rate Limiting Registration — Verification & Test | 0.5 | #2 | Security |
| 4 | EventBus Wiring — Domain Event Handlers | 2.5 | #3 | Architecture |
| 5 | Repository Mapping + DI Refactoring + Port Extraction | 3.5 | #4 | Architecture |
| 6 | Shared Package Type Deduplication | 1 | #5 | Architecture |
| 7 | Frontend Component Completion (11 remaining) | 3 | #6* | Frontend |
| 8 | Frontend Test Setup + Component Tests | 1.5 | #7 | Quality |
| 9 | E2E Test Foundation (Playwright + 2 critical paths) | 2 | #7, #8 | Quality |
| 10 | CI/CD Pipeline Refinement | 1 | #4-6* | Infrastructure |
| 11 | UUID v7 Migration | 1 | #5* | Infrastructure |
| 12 | Docker Compose Refinement | 0.5 | None | Infrastructure |
| **Total** | | **16 days** | | |

**\* Low coupling — can start in parallel if the dependency issue's primary work is done.**

### Parallel Work Streams

```
Week 1 (Jul 30 - Aug 5):
┌─────────────────────────────────────────────────────────────────┐
│ Stream A (Security):  #1(0.5d) → #2(1d) → #3(0.5d)           │
│ Stream C (Frontend):  #7(3d) ──────────────────────────        │
│ Stream E (Docker):    #12(0.5d) ───────────────────────        │
└─────────────────────────────────────────────────────────────────┘

Week 2 (Aug 6 - Aug 12):
┌─────────────────────────────────────────────────────────────────┐
│ Stream B (Arch):   #4(2.5d) → #5(3.5d) → #6(1d)               │
│ Stream D (Quality): #8(1.5d) → #9(2d)                          │
│ Stream E (Infra):   #10(1d) → #11(1d)                          │
└─────────────────────────────────────────────────────────────────┘
```

**Total calendar time (sequential critical path):** 
Stream A (2d) + Stream B (7d) = **9 days**  
With Stream C (Frontend) running in parallel (3d) and Stream D (Quality, 3.5d) starting after C: **~9 days critical path** → fits within 14-day sprint with 5-day buffer  
Buffer: 2 days for review, fixes, and release → **14 days total**

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| EventBus handler errors crash the server | Low | High | All handlers are wrapped in try/catch — errors logged, not thrown |
| Frontend 11 components slip schedule | Medium | Medium | Prioritize onboarding-wizard, pix-payment-flow, kanban-board; defer exception-panel, notification-banner |
| Shared package dedup breaks frontend build | Medium | High | Test `tsc --noEmit` before merge; gradual migration (deprecate old types, add new) |
| UUID v7 migration introduces race condition | Low | Medium | UUIDs are generated in app code — no DB-level sequence dependency |
| Playwright E2E tests flaky in CI | Medium | Medium | Retry mechanism (2 retries in CI); trace/screenshot on failure for debugging |
| Helmet CSP breaks frontend rendering | Medium | Medium | Test frontend thoroughly after CSP changes; use `'unsafe-inline'` for Next.js scripts/styles |
| Rate limiting blocks legitimate API traffic | Low | Medium | Key generator uses tenantId — test with realistic request patterns |
| Repo mapping changes break existing queries | Low | High | All changes are additive (new mapper class) — existing toClient() kept until migration verified |
| Path alias `@/` breaks CI if build step expects compiled JS | Low | Medium | `build` changed to `tsc --noEmit`; Docker uses `tsx` for runtime; verify `ci.yml` doesn't depend on `dist/` output |
| Dependency Rule violations in onboarding/reminder services block DI refactoring | Medium | High | #5 scoped to extract ports first, then refactor services incrementally; CI enforces no-new-violations rule |
| Dual repository implementations (BaseRepository + Port-based) cause merge conflicts or logic drift | Medium | High | #5 consolidates to single Port-based impl per entity; both impls kept in same file during migration for diff clarity |
| `EventRepository` and `QueuePort` missing interfaces block handler wiring in #4 | High | Medium | Create ports early in #5 (first sub-task) so #4 handlers can depend on abstractions, not concretions |
| `OnboardingService` and `ReminderService` tight coupling reduces testability and blocks unit tests | Medium | High | DI refactoring is a sub-issue of #5; services will accept ports via constructor, enabling mock injection |

---

## Definition of Done (Sprint Level)

- [ ] All 12 issues implemented and merged to `main`
- [ ] CTO re-review confirms C-07 (JWT) fix is verified with tests
- [ ] CTO re-review confirms H-04 (Helmet), H-07 (Error Handler), M-02 (EventBus), M-03 (UUID v7), M-06 (Mapping) satisfied
- [ ] Tech Nucleus re-review confirms I-01, I-02, I-05, I-14 closed
- [ ] Zero Dependency Rule violations in backend (automated check in CI — no application/ service imports from infrastructure/)
- [ ] `EventRepositoryPort` and `QueuePort` interfaces exist and are used by application services (no direct infra imports)
- [ ] `OnboardingService` and `ReminderService` accept dependencies via constructor DI (no inline instantiation)
- [ ] Dual repository implementations (BaseRepository + Port) consolidated into single Port-based implementation per entity
- [ ] `tsc --noEmit` passes on both apps (including test files)
- [ ] All existing 305+ tests still pass
- [ ] Frontend has ≥3 component tests passing
- [ ] 2 E2E critical path tests passing
- [ ] CI pipeline green with coverage thresholds enforced
- [ ] Tag `v0.3.0` created
- [ ] `.env.example` updated with any new variables

---

## Artifact Checklist

| Issue | Artifact |
|-------|----------|
| 1 | `apps/backend/src/__tests__/security/jwt-verification.test.ts` |
| 2 | `apps/backend/src/presentation/handler.ts` + updated `index.ts` |
| 3 | Updated `index.ts` with tiered rate limits + rate limit tests |
| 4 | `application/events/handlers/` (3 handlers) + `registerEventHandlers()` factory |
| 5 | `infrastructure/database/mappers/` (5 mapper files) + `application/ports/repositories/event.repository.port.ts` + `application/ports/queue/queue.port.ts` + refactored `onboarding.service.ts` & `reminder.service.ts` (constructor DI) |
| 6 | Updated `packages/shared/src/index.ts` + updated frontend imports |
| 7 | `apps/frontend/src/components/` (11 new component files) |
| 8 | `apps/frontend/vitest.config.ts` + `__tests__/` setup + component tests |
| 9 | `e2e/` directory with `playwright.config.ts` + 2 test files + `docker-compose.e2e.yml` |
| 10 | Updated `.github/workflows/ci.yml` + `turbo.json` updates |
| 11 | `infrastructure/uuid/uuid.service.ts` + all UUID call sites updated |
| 12 | Updated `docker-compose.dev.yml` + `docker-compose.prod.yml` |

---

## Release v0.3.0 Checklist

### Pre-Re release
- [ ] All 12 issues merged to `main`
- [ ] Full test suite passes: `pnpm test` (backend + frontend + e2e)
- [ ] `pnpm build` succeeds on both apps
- [ ] `docker compose -f docker/docker-compose.prod.yml up` works
- [ ] All security integration tests pass
- [ ] CTO re-review completed
- [ ] Tech Nucleus re-review completed

### Release
- [ ] Tag `v0.3.0` created
- [ ] Release notes written (Sprint 3 summary + all resolved issues)
- [ ] `.env.example` committed with any new variables
- [ ] Deployment to staging environment (if available)

---

*Plan prepared by: Architect Agent*  
*Date: 2026-07-29*  
*Related documents: `docs/sdd.md`, `docs/sprint-2-plan.md`, `docs/review-cto.md`, `docs/review-tech-nucleus.md`*
