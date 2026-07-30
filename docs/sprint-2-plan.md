# Sprint 2 Plan — Architectural Foundation

**Theme**: Clean Architecture Layers & Debt Remediation  
**Period**: 2026-07-28 to 2026-08-10 (2 weeks)  
**Target Release**: `v0.2.0`

---

## Sprint Goal

Pay down the architectural debt deferred from Sprint 1 by building the proper Clean Architecture layers: Domain entities with Value Objects, Application ports and use cases, and Composition Root wiring. At the end of this sprint, the backend must have zero Dependency Rule violations and at least 2 routes fully flowing through Use Case → Port → Repository.

---

## Dependency Graph (Issue Ordering)

```
Issue 1 (Domain Layer)
  │
  ▼
Issue 2 (Application Contracts: Either + Ports)
  │
  ├─────────────┬──────────────────┐
  ▼             ▼                  ▼
Issue 3      Issue 4           Issue 5
(Use Cases)  (Infra Ports)    (Prisma Alignment)
  │             │
  └──────┬──────┘
         ▼
     Issue 6 (Composition Root)
         │
         ▼
     Issue 7 (Route Refactor)
         │
         ├──────────────────┬──────────────┐
         ▼                  ▼              ▼
     Issue 8            Issue 9        Issue 10
  (HMAPerTenant)   (Frontend Comp)   (Docker Non-root)
         │
         ▼
     Issue 11 (CI/CD)
         │
         ▼
     Issue 12 (E2E Foundation + Frontend Tests)
```

---

## Issue 1: Domain Layer Foundation — Entity Base + Value Objects + DomainError

**Addresses**: CTO C-01, Tech Nucleus I-08  
**Effort**: 3 days  
**Blocking**: Nothing (foundation)  
**Dependencies**: None

### Description
Create the proper Domain layer building blocks that were deferred from Sprint 1. Currently, domain entities are Zod schemas with inferred types (anemic). Sprint 2 MUST introduce:

1. **`domain/errors/domain.error.ts`** — base class for business rule violations (extends `Error`, carries invariant description)
2. **`domain/entities/base.entity.ts`** — abstract `Entity<T>` with UUID v7 (not `randomUUID()`), `equals()`, `toJSON()`, `createdAt`, `updatedAt`
3. **`domain/value-objects/`** — six Value Objects with invariant enforcement (private constructor + static `create()` returning `Either<DomainError, VO>`):
   - `phone.vo.ts` — 10-15 digits, numeric-only, `formatted()` for display
   - `email.vo.ts` — RFC 5322 validation via regex, lowercased
   - `money.vo.ts` — amount > 0, precision 2, `add()`, `subtract()`, `percentage()`
   - `tax-id.vo.ts` — CPF (11) or CNPJ (14), digit validation
   - `invoice-status.vo.ts` — state machine: `canTransitionTo(target)` with legal transitions
   - `risk-score.vo.ts` — GREEN | YELLOW | RED enum with ordering and explainability

### Approach
- Follow `skill:clean-architecture-reference` patterns exactly (private constructor + static `create()`)
- Each VO is its own file, fully covered by unit tests
- `Either<DomainError, VO>` return ensures consumers handle invalid input
- All existing Zod schemas remain as factory methods on entities but delegate validation to VOs where applicable

### Acceptance Criteria
- [ ] `Entity<T>` base class exists with UUID v7 generation (via `crypto.randomUUID()` to start, migrate to `uuidv7` package in Sprint 3)
- [ ] `DomainError` base class exists with `name`, `message`, `invariant` properties
- [ ] All 6 VOs have private constructor + static `create()` + invariant enforcement
- [ ] Each VO has unit tests covering valid creation, invalid creation, and edge cases
- [ ] `Entity.equals()` uses referential + structural comparison

---

## Issue 2: Application Contracts — Either Monad + Port Interfaces + ApplicationError

**Addresses**: CTO C-02, Tech Nucleus I-09  
**Effort**: 2 days  
**Blocking**: Issue 1 (DomainError is referenced by ApplicationError)  
**Dependencies**: Issue 1

### Description
Create the Application layer contracts that define how use cases interact with infrastructure:

1. **`application/types/either.ts`** — `Either<L, R>` monad with:
   - `success<R>(value: R): Either<never, R>`
   - `failure<L>(error: L): Either<L, never>`
   - `isSuccess()` / `isFailure()` type guards
   - `map()`, `mapError()`, `flatMap()` combinators

2. **`application/errors/application.error.ts`** — `ApplicationError` base (not found, validation, conflict, unauthorized)

3. **`application/ports/`** — core port interfaces (contracts infrastructure implements):
   - `repositories/client.repository.port.ts` — `findById()`, `findByPhone()`, `create()`, `update()`, `findMany()`, `count()`
   - `repositories/invoice.repository.port.ts` — `findById()`, `create()`, `update()`, `findMany()`, `count()`
   - `repositories/tenant.repository.port.ts` — `findById()`, `findBySlug()`, `create()`, `update()`
   - `gateways/payment-gateway.port.ts` — already exists but refactor to use `Either`
   - `adapters/unit-of-work.port.ts` — `beginTransaction<T>(fn) => Promise<T>`
   - `adapters/event-bus.port.ts` — `publish(event: DomainEvent): void`

### Approach
- Either monad follows team pattern from `skill:clean-architecture-reference` Section 4 (no try/catch in use cases)
- Port interfaces are pure TypeScript interfaces — no dependency on Prisma, Fastify, or any framework
- Repository ports return domain entities (not DB rows) — mapping is infrastructure's responsibility
- Each port interface gets a unit test verifying its contract signature

### Acceptance Criteria
- [ ] `Either<L, R>` implemented with `success()`, `failure()`, type guards, and combinators
- [ ] `ApplicationError` base class with `notFound()`, `validation()`, `conflict()`, `unauthorized()` factory methods
- [ ] ClientRepositoryPort, InvoiceRepositoryPort, TenantRepositoryPort defined
- [ ] PaymentGatewayPort refactored to use `Either<ApplicationError, T>` returns
- [ ] UnitOfWorkPort and EventBusPort defined
- [ ] All ports pass type-checking with zero external imports

---

## Issue 3: Use Case Implementation — CreateClient + CreateInvoice

**Addresses**: CTO C-02 (Sprint 2 requires at least 2 use cases), CTO C-03 (routes should delegate)  
**Effort**: 2 days  
**Blocking**: Issue 2 (ports + Either needed)  
**Dependencies**: Issue 1, Issue 2

### Description
Implement the first two use cases that demonstrate the full Clean Architecture flow:

1. **`application/usecases/client/create-client.usecase.ts`**
   - Input: `CreateClientInput` DTO (name, phone, email?, document?, preferredChannel?, etc.)
   - Validates via domain VOs (Phone.create(), Email.create())
   - Checks duplicate phone via `ClientRepositoryPort.findByPhone()`
   - Creates domain `Client` entity via factory
   - Persists via `ClientRepositoryPort.create()`
   - Publishes `ClientCreated` domain event
   - Returns `Either<ApplicationError, Client>`

2. **`application/usecases/billing/create-invoice.usecase.ts`**
   - Input: `CreateInvoiceInput` DTO (clientId, amount, dueDate, description?)
   - Validates amount via `Money.create()`
   - Checks client exists via `ClientRepositoryPort.findById()`
   - Creates domain `Invoice` entity via factory
   - Generates PIX charge via `PaymentGatewayPort.createPixCharge()`
   - Persists via `InvoiceRepositoryPort.create()`
   - Publishes `InvoiceCreated` domain event
   - Returns `Either<ApplicationError, Invoice>`

### Approach
- Use Cases import only from `domain/` and `application/ports/` — zero infrastructure imports
- All business rules are enforced before persistence (fail-fast)
- Domain events are emitted but NOT consumed yet (EventBus wiring deferred to Sprint 3 per CTO)
- Unit tests use mocked ports (simple in-memory implementations in the test file)

### Acceptance Criteria
- [ ] `CreateClientUseCase` implemented with duplicate phone check and domain event emission
- [ ] `CreateInvoiceUseCase` implemented with PIX charge generation and domain event emission
- [ ] Both use cases return `Either<ApplicationError, T>` (never throw)
- [ ] Both use cases have unit tests with in-memory port mocks
- [ ] Zero infrastructure imports in use case files

---

## Issue 4: Infrastructure Ports Implementation — Prisma Repository Adapters

**Addresses**: CTO C-02 (ports must have concrete implementations)  
**Effort**: 2 days  
**Blocking**: Issue 2 (ports are defined), Issue 3 (use cases need working repos)  
**Dependencies**: Issue 2

### Description
Refactor existing Prisma repository implementations to implement the new port interfaces. Currently `ClientRepository`, `InvoiceRepository`, etc. are concrete classes used directly by routes. Sprint 2 makes them implement port interfaces.

1. Refactor `infrastructure/database/repositories/client.repository.ts` to implement `ClientRepositoryPort`
2. Refactor `infrastructure/database/repositories/invoice.repository.ts` to implement `InvoiceRepositoryPort`
3. Create `infrastructure/database/repositories/tenant.repository.ts` implementing `TenantRepositoryPort`
4. Add repository → domain entity mapping methods (`toDomain(entity)`, `toPersistence(domain)`)
5. Implement `UnitOfWorkPort` using Prisma transaction (`$transaction`)

### Approach
- Keep existing Prisma logic — wrap it behind the port interface
- Entity mapping is a thin adapter: Prisma row → Domain Entity (not Zod inferred type)
- `BaseRepository` is updated to accept the port interface type parameter
- Existing route-level code continues to work (backward-compatible)

### Acceptance Criteria
- [ ] `ClientRepository` implements `ClientRepositoryPort` with `toDomain()` mapping
- [ ] `InvoiceRepository` implements `InvoiceRepositoryPort` with `toDomain()` mapping
- [ ] `TenantRepository` implements `TenantRepositoryPort`
- [ ] `PrismaUnitOfWork` implemented using `$transaction`
- [ ] All existing tests still pass (no regression)
- [ ] Tenant isolation enforced in all repository methods

---

## Issue 5: Prisma Schema Alignment — Separate PaymentProviderConfig & BillingSchedule Models

**Addresses**: Tech Nucleus I-15, SDD Appendix A compliance  
**Effort**: 1.5 days  
**Blocking**: Issue 4 (infrastructure repos need updating after schema change)  
**Dependencies**: None (can start in parallel with Issue 1)

### Description
Align the Prisma schema with the SDD model. Currently `Tenant` has inline JSON columns for `paymentProviderConfig` and `decisionConfig`. The SDD specifies separate models:

1. **Create `PaymentProviderConfig` model** (migration):
   - `id`, `tenantId`, `provider` (enum: asaas|mercadopago|pagbank|polar), `apiKey` (encrypted), `environment` (sandbox|production), `webhookSecret` (encrypted), `config` (JSONB), `active`, `createdAt`, `updatedAt`
   - `@@unique([tenantId, provider])` — one config per provider per tenant

2. **Create `BillingSchedule` model** (migration):
   - `id`, `tenantId`, `name`, `rules` (JSONB array), `active`, `isDefault`, `createdAt`, `updatedAt`

3. **Drop inline JSON columns** from Tenant model:
   - Remove `paymentProviderConfig` and `decisionConfig` columns
   - Migrate existing data to new tables

4. **Update `Subscription` model** to use proper enum for `frequency` and `status`

### Approach
- Generate Prisma migration; test rollback
- Data migration script moves existing Tenant.config values to new tables
- Backward-compatible: existing code continues reading from new models
- HMAC verifier (Issue 8) will later use `PaymentProviderConfig` table directly

### Acceptance Criteria
- [ ] `PaymentProviderConfig` model exists with proper relations and unique constraint
- [ ] `BillingSchedule` model exists with JSONB rules array
- [ ] Data migration preserves existing configuration
- [ ] `Subscription.frequency` and `Subscription.status` are proper enums (not String)
- [ ] Prisma migration is reversible

---

## Issue 6: Composition Root — Factory Functions

**Addresses**: CTO C-06, Tech Nucleus I-10  
**Effort**: 1 day  
**Blocking**: Issue 3 (use cases exist to wire), Issue 4 (repositories exist to inject)  
**Dependencies**: Issue 3, Issue 4

### Description
Create `presentation/factories/` as the composition root. Each use case gets a factory function that instantiates all dependencies:

1. **`presentation/factories/create-client.factory.ts`**:
   ```typescript
   export function makeCreateClientUseCase(): CreateClientUseCase {
     const uow = new PrismaUnitOfWork(getPrismaClient());
     const clientRepo = new ClientRepository(uow);
     const tenantRepo = new TenantRepository(uow);
     const eventBus = new InMemoryEventBus(); // Sprint 3: RedisEventBus
     return new CreateClientUseCase(clientRepo, tenantRepo, eventBus);
   }
   ```

2. **`presentation/factories/create-invoice.factory.ts`**:
   ```typescript
   export function makeCreateInvoiceUseCase(): CreateInvoiceUseCase {
     const uow = new PrismaUnitOfWork(getPrismaClient());
     const clientRepo = new ClientRepository(uow);
     const invoiceRepo = new InvoiceRepository(uow);
     const paymentGateway = new AsaasPaymentGateway(env.ASAAS_API_KEY, env.ASAAS_ENVIRONMENT);
     const eventBus = new InMemoryEventBus();
     return new CreateInvoiceUseCase(clientRepo, invoiceRepo, paymentGateway, eventBus);
   }
   ```

3. **Factory index** with named exports for all use cases

### Approach
- Manual DI — no DI container library (per CTO rule)
- Each factory is a single function, not a class
- No global singletons — factories are called per-request or at server startup
- Follow pattern: `new UseCase(repo1, repo2, service)`

### Acceptance Criteria
- [ ] `presentation/factories/` directory exists with at least 2 factory functions
- [ ] Factories instantiate all dependencies transitively
- [ ] No global singletons or Service Locator pattern
- [ ] Factory functions are synchronous (no async init)

---

## Issue 7: Route Refactor — Delegate to Use Cases via Factories

**Addresses**: CTO C-03, Tech Nucleus I-04  
**Effort**: 2 days  
**Blocking**: Issue 6 (factories must exist to wire use cases)  
**Dependencies**: Issue 6

### Description
Refactor `client.routes.ts` and `invoice.routes.ts` to eliminate direct infrastructure/domain imports and instead delegate to use cases via factory functions:

1. **`client.routes.ts`**:
   - Remove `import { ClientRepository } from '../infrastructure/database/repositories/client.repository'`
   - Remove inline Zod validation (move to use case input DTOs)
   - Inject use case via factory: `const useCase = makeCreateClientUseCase()`
   - Route handler: `const result = await useCase.execute(input)` → `result.isSuccess() ? reply.code(201).send(...) : reply.code(400).send(result.error)`

2. **`invoice.routes.ts`** — same pattern for `createInvoice` endpoint

3. **`webhook.routes.ts`** — introduce `WebhookVerifierPort` interface:
   - Port: `verifyWebhookSignature(provider, payload, signature): Either<ApplicationError, boolean>`
   - Infrastructure: `HmacWebhookVerifier` implements port
   - Factory: `makeWebhookVerifier()` → looks up `PaymentProviderConfig` from DB (per-tenant)

### Approach
- Routes become thin HTTP adapters: parse request → call use case → format response
- All business logic moves to use cases
- Validation is duplicated in route (Fastify schema) AND use case (domain VOs) — by design: route catches early, use case guarantees integrity
- Follow CTO rule: "Routes MUST NOT contain business logic — only validation + HTTP handling + use case delegation"

### Acceptance Criteria
- [ ] `POST /api/clients` delegates to `CreateClientUseCase` via factory
- [ ] `POST /api/invoices` delegates to `CreateInvoiceUseCase` via factory
- [ ] `webhook.routes.ts` uses `WebhookVerifierPort` instead of importing infrastructure directly
- [ ] Zero Dependency Rule violations in refactored routes
- [ ] All existing HTTP integration tests pass (behavior preserved)

---

## Issue 8: HMAC Per-Tenant Config — Read Webhook Secrets from Database

**Addresses**: Tech Nucleus I-07  
**Effort**: 1.5 days  
**Blocking**: Issue 5 (PaymentProviderConfig model must exist), Issue 7 (WebhookVerifierPort being introduced)  
**Dependencies**: Issue 5, Issue 7

### Description
Currently, `hmac-verifier.ts` reads webhook secrets from hardcoded `process.env` variables. In production, each tenant has different webhook secrets stored encrypted in the `PaymentProviderConfig` table.

1. **Create `application/ports/gateways/webhook-verifier.port.ts`**:
   ```typescript
   export interface WebhookVerifierPort {
     verify(provider: string, payload: string, signature: string, tenantId: string): Promise<Either<ApplicationError, boolean>>;
   }
   ```

2. **Implement `infrastructure/payment/hmac-verifier.ts`** — refactor to:
   - Accept `tenantId` parameter
   - Query `PaymentProviderConfig` table for the tenant's webhook secret
   - Verify HMAC using the tenant's secret (not a global env var)
   - Cache result in Redis per-tenant (TTL: 5 min) to avoid DB lookup on every webhook

3. **Handle missing config gracefully**:
   - Tenant not found → log warning + return `failure(notFound)`
   - Provider not configured → return `failure(validation)`

### Approach
- Webhook secrets are encrypted at rest in DB (AES-256-GCM via `infrastructure/crypto/`)
- Cache reduces latency: webhooks are high-frequency
- Port interface allows different verifier implementations (HMAC vs API key)
- Existing `verifyWebhookSignature` function is replaced; migration path kept for backward compatibility

### Acceptance Criteria
- [ ] `WebhookVerifierPort` defined in `application/ports/gateways/`
- [ ] `HmacWebhookVerifier` implements port, reads tenant secret from DB
- [ ] Tenant secret is looked up from `PaymentProviderConfig` table (not env vars)
- [ ] Per-tenant caching with Redis (5 min TTL)
- [ ] Fallback: if tenant not found, return `failure` (not crash)
- [ ] All webhook integration tests pass with new verifier

---

## Issue 9: Frontend — Design System Completion + Domain Components

**Addresses**: Creative Nucleus review design tokens + missing components  
**Effort**: 3 days  
**Blocking**: None (can parallel with backend issues)  
**Dependencies**: None

### Description
Complete the frontend design system and build domain-specific components. The Creative Nucleus review highlighted:
1. Design tokens tailwind config now exists — audit usage
2. Build the 19 domain-specific components from the UX/UI spec
3. Install missing npm dependencies (`sonner`, `recharts`, `@radix-ui/*`)

**Component Priority (top 8 for this sprint):**
1. `client-table` — Full-featured table with search, sort, pagination, risk badge
2. `invoice-card` — Displays invoice with status, amount, due date, payment actions
3. `pix-payment-flow` — Component showing PIX QR code, copy-paste, countdown
4. `risk-badge` — Color-coded badge (GREEN/YELLOW/RED) with explanation tooltip
5. `onboarding-wizard` — 3-step wizard for client onboarding
6. `collection-timeline` — Visual timeline of reminder messages sent to a client
7. `kanban-board` — Invoice management board (Pending/Overdue/Paid)
8. `report-chart` — Reusable chart wrapper with filters

**Also complete:**
- Add missing deps: `npm install sonner recharts @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-select`
- Audit current pages for compliance with design tokens
- Add `tailwind.config.ts`: animation keyframes (fade, slide, scale)

### Approach
- Components are pure presentational (no data fetching)
- State management via Zustand stores (existing pattern)
- Storybook-style: each component has typed props and renders all states
- Follow shadcn/ui conventions (CVA, cn() utility)

### Acceptance Criteria
- [ ] All missing npm deps installed and configured
- [ ] 8 domain components built with TypeScript interfaces and all states
- [ ] Components use design token colors (not hardcoded values)
- [ ] Tailwind config extended with animation keyframes
- [ ] Existing pages refactored to use new components
- [ ] Components responsive (mobile/desktop)

---

## Issue 10: Docker Non-Root User + Production Hardening

**Addresses**: Tech Nucleus I-16, Sprint 1 Retro item  
**Effort**: 0.5 day  
**Blocking**: Nothing  
**Dependencies**: None (parallel)

### Description
Update Dockerfiles and compose files for non-root execution:
1. **`apps/backend/Dockerfile`**: Add `USER node:node` after dependencies, set `WORKDIR /app` owned by node user
2. **`apps/frontend/Dockerfile`**: Same pattern
3. **`docker-compose.dev.yml`**: Add `user: "${UID:-1000}:${GID:-1000}"` to backend and frontend services

### Approach
- Standard Node.js Docker non-root pattern (copy packages as root, then switch to node user)
- No change to existing development workflows

### Acceptance Criteria
- [ ] Backend container runs as `node` user (not root)
- [ ] Frontend container runs as `node` user (not root)
- [ ] `docker compose up` works without permission errors
- [ ] Host-mounted volumes function correctly

---

## Issue 11: CI/CD Pipeline — GitHub Actions

**Addresses**: Compliance Auditor review (no CI/CD), Sprint 1 Retro  
**Effort**: 1 day  
**Blocking**: Issues 1-7 should be merged before CI is meaningful  
**Dependencies**: Issues 1-7 (merged)

### Description
Create the CI/CD pipeline for the monorepo:

1. **`.github/workflows/ci.yml`** — Pull Request checks:
   - `pnpm install --frozen-lockfile`
   - `pnpm lint` (ESLint on both apps)
   - `pnpm typecheck` (tsc on both apps)
   - `pnpm test` (Vitest on backend + frontend)
   - Security scan: `npm audit`, `trivy` (container scan)
   - Build check: `pnpm build`

2. **`.github/workflows/cd.yml`** — Deployment (manual trigger):
   - Build Docker images
   - Push to registry
   - Deploy to staging

3. **`.github/workflows/security.yml`** — Scheduled (weekly):
   - SAST scanning
   - Dependency vulnerability check
   - Secret scanning

### Approach
- Turborepo caching for fast CI
- Parallel jobs: backend tests + frontend tests + lint + typecheck
- Security scan runs in parallel with tests (non-blocking for PR merge)

### Acceptance Criteria
- [ ] CI workflow runs on every PR to `main`
- [ ] All checks pass: lint, typecheck, test, build
- [ ] CD workflow available as manual trigger
- [ ] Security scan runs weekly
- [ ] Pipeline completes under 5 minutes (with Turborepo cache)

---

## Issue 12: E2E Test Foundation + Frontend Test Setup

**Addresses**: Missing E2E coverage, Frontend test gap  
**Effort**: 2 days  
**Blocking**: Issue 7 (routes need to be stable first), Issue 9 (components needed for pages)  
**Dependencies**: Issue 7, Issue 9

### Description
Establish the testing infrastructure for E2E and frontend tests:

1. **Frontend unit tests**:
   - Vitest is already configured (in `package.json`)
   - Add `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
   - Create test configuration: `vitest.config.ts` with jsdom environment
   - Write tests for 3 key components: `client-table`, `invoice-card`, `pix-payment-flow`
   - All tests: render + interaction + state verification

2. **E2E test foundation**:
   - Install Playwright (`npm init playwright@latest`)
   - Create `e2e/` directory at monorepo root
   - Configure: `playwright.config.ts` pointing to local dev environment
   - Write 2 critical path tests:
     - "Create client → see client in dashboard" (full CRUD flow)
     - "Create invoice → pay with PIX → see paid status" (payment flow)
   - Add `docker-compose.e2e.yml` for isolated test environment

### Approach
- Frontend tests use MSW (Mock Service Worker) to mock API calls
- E2E tests run against real backend with test database (isolated)
- E2E tests are smoke tests (2-3 critical flows), not exhaustive
- Tests are idempotent (setup/teardown per test)

### Acceptance Criteria
- [ ] Frontend test config works (`pnpm --filter frontend test` passes)
- [ ] 3 component tests passing (client-table, invoice-card, pix-payment-flow)
- [ ] Playwright installed and configured
- [ ] 2 E2E tests passing in isolated environment
- [ ] Test reports generated (HTML for CI)

---

## Sprint 2 Effort Summary

| # | Issue | Days | Dependencies | Theme |
|---|-------|------|--------------|-------|
| 1 | Domain Layer Foundation (Entity + VOs + DomainError) | 3 | None | Architecture |
| 2 | Application Contracts (Either + Ports + ApplicationError) | 2 | #1 | Architecture |
| 3 | Use Case Implementation (CreateClient + CreateInvoice) | 2 | #1, #2 | Architecture |
| 4 | Infrastructure Ports (Prisma adapters + UoW) | 2 | #2 | Architecture |
| 5 | Prisma Schema Alignment (PaymentProviderConfig, BillingSchedule) | 1.5 | None | Infrastructure |
| 6 | Composition Root (Factory Functions) | 1 | #3, #4 | Architecture |
| 7 | Route Refactor (Delegate to Use Cases) | 2 | #6 | Architecture |
| 8 | HMAC Per-Tenant Config (DB-driven webhook secrets) | 1.5 | #5, #7 | Security |
| 9 | Frontend Design System + Domain Components (8 components) | 3 | None | Frontend |
| 10 | Docker Non-Root User | 0.5 | None | Infrastructure |
| 11 | CI/CD Pipeline (GitHub Actions) | 1 | #1-7 (merged) | Quality |
| 12 | E2E Foundation + Frontend Tests | 2 | #7, #9 | Quality |
| **Total** | | **21.5 days** | | |

**Parallel work streams:**
- **Stream A (Architecture)**: Issues 1 → 2 → 3 → 4 → 6 → 7 (sequential dependencies)
- **Stream B (Infrastructure)**: Issue 5 (parallel with Stream A)
- **Stream C (Frontend)**: Issue 9 (parallel with Stream A)
- **Stream D (Docker)**: Issue 10 (parallel with Stream A)
- **Stream E (Quality)**: Issue 11 (A finished) → Issue 12 (A+C finished)

---

## Definition of Done (Sprint Level)

- [ ] All 12 issues implemented and merged to `main`
- [ ] CTO re-review confirms C-01, C-02, C-03, C-06 conditions satisfied
- [ ] Zero Dependency Rule violations in backend (automated check in CI)
- [ ] `tsc --noEmit` passes on both apps (including test files)
- [ ] All existing 305 tests still pass
- [ ] 80%+ of new code covered by unit tests
- [ ] CI pipeline green
- [ ] Creative Nucleus review confirms 8 domain components delivered
- [ ] Tag `v0.2.0` created

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Prisma schema migration breaks existing data | Low | High | Test migration on staging DB first; rollback script ready |
| Route refactor breaks existing API contracts | Medium | High | Integration tests must pass before merge; backward-compatible DTOs |
| Frontend component build slips schedule | Medium | Medium | Prioritize top 8 components; defer remaining 11 to Sprint 3 |
| CI/CD setup hits GitHub Actions limits | Low | Low | Use self-hosted runner if needed; optimize with Turborepo caching |
| Domain VOs too complex for current entity model | Low | Medium | Keep Zod schemas alongside; migrate incrementally |
