# Sprint 4 Plan — Architecture Completion & Quality Gates

**Theme**: Architecture Completion & Quality Gates  
**Period**: 2026-07-30 to 2026-08-06 (1 week)  
**Target Release**: `v0.4.0`

---

## Pre-Sprint Context

Sprint 3 delivered **12 issues** covering Security Hardening (JWT, Helmet, Rate Limiting, Error Handler), Architecture Debt Remediation (EventBus wiring, Repository mapping, Port extraction, Shared package dedup), Frontend completion (all 23 components), E2E foundation, CI/CD refinement, UUID v7 migration, and Docker Compose polish. The codebase now has **173 backend source files**, **10+ Port interfaces**, **5 Domain Mappers**, **56 test files**, and **zero Dependency Rule violations**.

Three architecture debt items were explicitly deferred from Sprint 3:

| Deferred Item | Sprint 4 Item | Priority |
|---------------|---------------|----------|
| Read routes (`GET /api/clients`, `GET /api/clients/:id`, `GET /api/invoices`) bypass use cases — inline data access in route handlers violates Clean Architecture | **Item 1** | 🔴 High |
| Unit of Work pattern for atomic write operations across multiple tables | **Item 4** | 🔴 High |
| E2E job in CI is commented out — tests only run manually | **Item 3** | 🔴 High |

Additionally, three quality/documentation gaps and one port extraction cleanup remain:

| Gap | Sprint 4 Item | Priority |
|-----|---------------|----------|
| OnboardingService + ReminderService have zero unit tests | **Item 5** | 🟡 Medium |
| Individual SDD specs were never generated for Sprint 3 issues | **Item 6** | 🟡 Medium |
| Frontend E2E test gaps (onboarding flow, dashboard, error states) | **Item 7** | 🟡 Medium |
| WebhookVerifierPort extraction may be incomplete — legacy `hmac-verifier.ts` may still exist | **Item 2** | 🟡 Medium |

---

## Sprint Goal

Complete the Clean Architecture pattern across all read paths, establish transactional integrity with the Unit of Work pattern, activate the E2E CI gate, and close quality gaps (service tests, SDD specs, frontend E2E coverage). At the end of this sprint, every HTTP route must delegate to the application layer, all multi-table write operations must be atomic, the CI pipeline must enforce E2E pass/fail, and all Sprint 3 work must be retrospectively documented in SDD specs.

---

## Dependency Graph

```
                           ┌──────────────────────┐
                           │  Item 6 (SDD Specs)  │ (0.5d, documentation)
                           └──────────┬───────────┘
                                      │ (no deps)
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│   Item 1 (Read UC)   │  │   Item 2 (Webhook)   │  │   Item 7 (Frontend)  │
│   1.5d, Architecture  │  │   0.5d, Architecture │  │   1d, Quality        │
└──────────┬───────────┘  └──────────┬───────────┘  └──────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐  ┌──────────────────────┐
│   Item 5 (Services)  │  │   Item 4 (UoW)       │
│   1d, Quality        │  │   1.5d, Architecture  │
└──────────┬───────────┘  └──────────┬───────────┘
           │                          │
           └────────────┬─────────────┘
                        ▼
              ┌──────────────────────┐
              │   Item 3 (E2E CI)    │
              │   1d, Infrastructure │
              └──────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| Item 6 → Item 1, Item 2, Item 7 | SDD specs are documentation-only, but generating them first ensures the team has written contracts before implementation begins |
| Item 1 → Item 5 | Service tests for `OnboardingService` and `ReminderService` need the read use case pattern to be established (they may depend on read queries via repository ports) |
| Item 2 → Item 4 | WebhookVerifierPort extraction confirms the Port contract pattern — UoW repositories must implement the same Port contract discipline |
| Item 4 → Item 3 | UoW affects how repositories handle transactions; E2E tests must run against the final transaction-aware repository implementation |
| Item 5 → Item 3 | Service tests add to the test suite that E2E CI must validate |
| Item 7 → Item 3 | Frontend E2E tests are part of the E2E suite that CI will activate |

---

## Item 1: Read Use Cases (ListClients, GetClient, ListInvoices)

**Effort**: 1.5 days  
**Theme**: Architecture  
**Blocking**: Item 5  
**Dependencies**: Item 6 (light — SDD specs provide contract template, can start after Item 6 is drafted)

### Description

Currently, `GET /api/clients`, `GET /api/clients/:id`, and `GET /api/invoices` bypass the application layer and call repositories/data-access helpers directly from route handlers. This violates Clean Architecture — routes should delegate to use cases.

**What exists**:
- Route files (`client.routes.ts`, `invoice.routes.ts`) with inline data access
- `CreateClientUseCase` and `CreateInvoiceUseCase` already exist in `application/usecases/` as reference patterns
- Repository Ports (`ClientRepositoryPort`, `InvoiceRepositoryPort`) are already defined with `findAll()` and `findById()` methods
- Factory pattern (`presentation/factories/`) is established with 9 existing factories

**What's needed**:
- `ListClientsUseCase` — accepts optional filters (status, page, limit), returns paginated list of clients
- `GetClientUseCase` — accepts `clientId`, returns single client or throws `NotFoundError`
- `ListInvoicesUseCase` — accepts optional filters (status, clientId, dateRange), returns paginated list of invoices
- Test files for each new use case (unit tests with mocked repository ports)
- Route handler refactoring in `client.routes.ts` and `invoice.routes.ts` to delegate to factories
- Factory singletons for each read use case

### Contract

```typescript
// application/usecases/list-clients.usecase.ts
export interface ListClientsInput {
  tenantId: string;
  status?: ClientStatus;
  page?: number;    // default 1
  limit?: number;   // default 20, max 100
}

export interface ListClientsOutput {
  clients: ClientProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListClientsUseCase {
  constructor(private readonly clientRepo: ClientRepositoryPort) {}
  async execute(input: ListClientsInput): Promise<Either<ApplicationError, ListClientsOutput>>;
}

// application/usecases/get-client.usecase.ts
export interface GetClientInput {
  tenantId: string;
  clientId: string;
}

export class GetClientUseCase {
  constructor(private readonly clientRepo: ClientRepositoryPort) {}
  async execute(input: GetClientInput): Promise<Either<ApplicationError, ClientProfile>>;
}

// application/usecases/list-invoices.usecase.ts
export interface ListInvoicesInput {
  tenantId: string;
  clientId?: string;
  status?: InvoiceStatus;
  startDate?: string;  // ISO date
  endDate?: string;    // ISO date
  page?: number;
  limit?: number;
}

export interface ListInvoicesOutput {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListInvoicesUseCase {
  constructor(private readonly invoiceRepo: InvoiceRepositoryPort) {}
  async execute(input: ListInvoicesInput): Promise<Either<ApplicationError, ListInvoicesOutput>>;
}
```

### Acceptance Criteria

- [ ] `ListClientsUseCase`, `GetClientUseCase`, and `ListInvoicesUseCase` exist in `application/usecases/` with typed input/output interfaces
- [ ] Each use case returns `Either<ApplicationError, Output>` — `NotFoundError` when entity does not exist
- [ ] Use cases support pagination (page/limit) and filtering (status, date range)
- [ ] Factory singletons created for all three use cases in `presentation/factories/`
- [ ] `client.routes.ts` `GET /` delegates to `ListClientsUseCase` (not inline data access)
- [ ] `client.routes.ts` `GET /:id` delegates to `GetClientUseCase` (not inline data access)
- [ ] `invoice.routes.ts` `GET /` delegates to `ListInvoicesUseCase` (not inline data access)
- [ ] Unit tests for each use case: success path, empty results, not-found, pagination, filtering, error handling
- [ ] All existing tests continue to pass (behavioral equivalence)
- [ ] Zero new Dependency Rule violations

---

## Item 2: WebhookVerifierPort — Extract from PerTenantHmacVerifier

**Effort**: 0.5 day  
**Theme**: Architecture  
**Blocking**: Item 4  
**Dependencies**: Item 6 (light — can start after SDD specs are drafted)

### Description

The `WebhookVerifierPort` interface exists in `application/ports/gateways/` and `PerTenantHmacVerifier` exists in `infrastructure/payment/`, but the extraction may not be complete. Additionally, a legacy `hmac-verifier.ts` with standalone functions may still be referenced. This item audits, verifies, and cleans up the webhook verification layer.

**What exists**:
- `application/ports/gateways/webhook-verifier.port.ts` — interface defining `verify(payload, signature, tenantId): boolean`
- `infrastructure/payment/per-tenant-hmac-verifier.ts` — concrete implementation that looks up per-tenant webhook secrets
- `infrastructure/payment/hmac-verifier.ts` — legacy standalone verifier functions (may be unreferenced)

**What's needed**:
1. Audit that `PerTenantHmacVerifier` fully implements `WebhookVerifierPort` — method signature, return type, error handling
2. Verify the `verify()` method uses `tenantId` to look up per-tenant webhook secrets from database — NOT global env vars
3. Remove legacy `hmac-verifier.ts` if no longer referenced anywhere in the codebase
4. Add contract tests: `PerTenantHmacVerifier` satisfies `WebhookVerifierPort` (type-level test)
5. Add unit tests: correct signature verification, wrong signature rejection, missing secret handling, malformed payload handling
6. Update the `payment-provider.factory.ts` if it references the legacy verifier

### Acceptance Criteria

- [ ] `PerTenantHmacVerifier` is confirmed to implement `WebhookVerifierPort` (type check passes)
- [ ] `hmac-verifier.ts` removed if unreferenced (or explicitly kept if still in use — with comment explaining why)
- [ ] `verify()` method uses `tenantId` to look up per-tenant secrets (not global env vars)
- [ ] Contract type test: `const verifier: WebhookVerifierPort = new PerTenantHmacVerifier(...)` compiles
- [ ] Unit tests: valid signature accepted, invalid signature rejected, missing tenant secret returns false, malformed payload doesn't throw
- [ ] `payment-provider.factory.ts` (or equivalent) uses `PerTenantHmacVerifier` through `WebhookVerifierPort` interface
- [ ] Zero new Dependency Rule violations

---

## Item 3: Active E2E Job in CI (Currently Commented Out)

**Effort**: 1 day  
**Theme**: Infrastructure  
**Blocking**: Nothing (last item in critical path)  
**Dependencies**: Item 4, Item 5, Item 7

### Description

The E2E job in `.github/workflows/ci.yml` (lines 75-135) is entirely commented out. E2E tests exist in `e2e/tests/` (client-flow and invoice-flow) but only run manually. This item uncomments the job, fixes any issues, and makes the E2E gate active.

**What exists**:
- `e2e/playwright.config.ts` configured with chromium project
- `e2e/tests/client-flow.spec.ts` and `e2e/tests/invoice-flow.spec.ts`
- `docker-compose.e2e.yml` with isolated PostgreSQL + Redis
- CI already has postgres and redis service definitions in the `test` and `coverage` jobs

**What's needed**:
1. **Uncomment and fix the E2E job** in `ci.yml` — ensure correct `working-directory`, environment variables, and service dependencies
2. **Fix Playwright browser installation** — the commented job installs browsers under `apps/frontend` but the Playwright config is at monorepo root `e2e/`
3. **Handle backend runtime** — E2E tests need the backend running. Options:
   - Start backend as a background step before running tests
   - Use `docker compose -f docker/docker-compose.e2e.yml up -d` to spin up the full stack
   - Start backend with `npx tsx apps/backend/src/index.ts &` and wait for health check
4. **Add proper environment configuration** — test database URL, test JWT secret, test API keys
5. **Add smoke health check step** — ensure backend is reachable before running tests
6. **Ensure Playwright HTML report uploads on failure** — the `if: failure()` condition should catch test failures AND infrastructure failures

### Acceptance Criteria

- [ ] E2E job in `ci.yml` is uncommented and runs on `pull_request` events
- [ ] Playwright browsers are installed at monorepo root (where `e2e/` config lives)
- [ ] Backend is running before E2E tests execute (health-check step ensures readiness)
- [ ] Environment variables for E2E are configured (test DB, JWT secret, API keys)
- [ ] `client-flow.spec.ts` passes end-to-end in CI
- [ ] `invoice-flow.spec.ts` passes end-to-end in CI
- [ ] E2E job failure blocks the PR from merging (required check)
- [ ] Playwright HTML report is uploaded as artifact on any failure (including setup failure)
- [ ] E2E job completes in under 10 minutes

---

## Item 4: Unit of Work Pattern for Atomic Operations

**Effort**: 1.5 days  
**Theme**: Architecture  
**Blocking**: Item 3  
**Dependencies**: Item 2

### Description

Multiple use cases perform writes across multiple tables (e.g., `ProcessPaymentWebhookUseCase` updates invoice status + creates payment record + publishes event) without a transaction boundary. If a write fails mid-operation, the system can be left in an inconsistent state.

**What exists**:
- `application/ports/adapters/unit-of-work.port.ts` — interface exists with `beginTransaction()`, `commit()`, `rollback()` methods
- No concrete `PrismaUnitOfWork` implementation
- Repositories use their own Prisma client instance (not a scoped transaction client)

**What's needed**:

#### 4A: Transaction Context Infrastructure

```typescript
// infrastructure/database/transaction-context.ts
import { PrismaClient, Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export const transactionStorage = new AsyncLocalStorage<PrismaTransactionClient>();

export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$use' | '$transaction' | '$extends'
>;

export function getTransaction(): PrismaTransactionClient | undefined {
  return transactionStorage.getStore();
}
```

#### 4B: Unit of Work Implementation

```typescript
// infrastructure/database/unit-of-work.ts
import { PrismaClient } from '@prisma/client';
import { UnitOfWorkPort } from '@/application/ports/adapters/unit-of-work.port';
import { transactionStorage, PrismaTransactionClient } from './transaction-context';

export class PrismaUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly prisma: PrismaClient) {}

  async beginTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return transactionStorage.run(tx as unknown as PrismaTransactionClient, () => fn());
    });
  }
}
```

#### 4C: Repository Update

Each repository must check for a transaction-scoped Prisma client before using its own:

```typescript
// infrastructure/database/repositories/client.repository.ts
import { getTransaction } from '../transaction-context';

export class PrismaClientRepository implements ClientRepositoryPort {
  private get client(): PrismaClient | PrismaTransactionClient {
    return getTransaction() ?? this.prisma;
  }
  // All methods use this.client instead of this.prisma directly
}
```

#### 4D: Wiring

- Initialize `PrismaUnitOfWork` in factories that create write use cases
- Pass `UnitOfWorkPort` to use cases that perform multi-table writes
- Initialize transaction storage context in the request lifecycle (Fastify hook or factory)

### Design Pattern: Unit of Work

The `UnitOfWorkPort` interface defines the transaction boundary contract. `PrismaUnitOfWork` is the concrete strategy using Prisma's `$transaction` + `AsyncLocalStorage`. This follows the **Strategy Pattern** — the use case depends only on the Port interface, not on Prisma specifics. The `AsyncLocalStorage` approach ensures repositories automatically participate in the active transaction without needing the transaction handle passed explicitly through every method call.

### Acceptance Criteria

- [ ] `transaction-context.ts` exists with `AsyncLocalStorage`-backed transaction storage
- [ ] `PrismaUnitOfWork` class exists implementing `UnitOfWorkPort` using Prisma `$transaction`
- [ ] `beginTransaction()` method creates a Prisma transaction and runs the callback within it
- [ ] All repositories (Client, Invoice, Tenant, Event) use `getTransaction()` for scoped client when a transaction is active
- [ ] At least one write use case (e.g., `ProcessPaymentWebhookUseCase`) is wired with `UnitOfWorkPort`
- [ ] Unit tests: transaction commits all writes on success, rolls back all writes on failure (use in-memory or test DB)
- [ ] Integration test: multi-table write succeeds atomically; if one write fails, no writes persist
- [ ] Existing tests continue to pass (non-transactional paths unchanged)

---

## Item 5: Add Service Tests for OnboardingService, ReminderService

**Effort**: 1 day  
**Theme**: Quality  
**Blocking**: Item 3  
**Dependencies**: Item 1

### Description

`application/services/onboarding.service.ts` and `application/services/reminder.service.ts` contain critical business logic for client onboarding flows and reminder scheduling but have **zero unit tests**. These services were refactored in Sprint 3 to use constructor DI, making them testable with mocked repository ports.

**What exists**:
- `OnboardingService` — manages client onboarding wizard state, preferences, communication channel setup
- `ReminderService` — schedules WhatsApp reminder messages based on invoice due dates and client preferences
- Both services accept dependencies via constructor injection (Port interfaces)
- Repository Ports are available for mocking

**What's needed**:

#### 5A: OnboardingService Tests

| Test Case | Description |
|-----------|-------------|
| Creates wizard state | Verify creating onboarding wizard with valid preferences returns success |
| Missing preferences | Verify onboarding fails gracefully when client preferences are incomplete/invalid |
| Duplicate onboarding | Verify re-onboarding an already-onboarded client returns an appropriate error |
| Channel selection | Verify communication channel is set correctly based on preferences |
| Edge case: invalid channel | Verify invalid channel value returns validation error |

#### 5B: ReminderService Tests

| Test Case | Description |
|-----------|-------------|
| Schedule reminder | Verify reminder is scheduled for an invoice 3 days before due date |
| No reminder for paid invoice | Verify paid invoices do not trigger reminders |
| Invalid due date | Verify past due date returns appropriate error |
| Client unsubscribed | Verify client with messaging opt-out does not receive reminders |
| Edge case: today is due date | Verify due-date reminders are still scheduled (same-day allowed) |

### Acceptance Criteria

- [ ] `__tests__/application/services/onboarding.service.test.ts` exists with ≥5 test cases
- [ ] `__tests__/application/services/reminder.service.test.ts` exists with ≥5 test cases
- [ ] All tests use mocked repository ports (no real database)
- [ ] Tests cover: success paths, validation errors, edge cases (missing data, invalid input, already-onboarded)
- [ ] All tests pass consistently (no flakiness, no shared mutable state)
- [ ] Existing services are NOT modified unless a bug is discovered during testing (and any such fix has its own test)

---

## Item 6: Retroactive SDD Spec Generation for Sprint 3 Issues

**Effort**: 0.5 day  
**Theme**: Documentation  
**Blocking**: Item 1, Item 2, Item 7 (light — provides contract templates)  
**Dependencies**: None

### Description

Sprint 3 issues were implemented from the sprint plan, but individual SDD specs were never generated for each issue. The `specs/` directory currently only contains `clean-architecture-refactor.spec.md`. This item retroactively generates a `.spec.md` file for each of the 12 Sprint 3 issues.

**What exists**:
- `specs/clean-architecture-refactor.spec.md` — from Sprint 2
- Sprint 3 plan (`docs/sprint-3-plan.md`) — detailed plan with all 12 issues documented
- Each issue in Sprint 3 has a well-defined description, approach, and acceptance criteria

**What's needed**:
Generate individual `.spec.md` files for each Sprint 3 issue:

```
specs/
├── s3-issue-01-jwt-verification.spec.md
├── s3-issue-02-security-headers-error-handler.spec.md
├── s3-issue-03-rate-limiting.spec.md
├── s3-issue-04-eventbus-handlers.spec.md
├── s3-issue-05-repository-mapping.spec.md
├── s3-issue-06-shared-package-dedup.spec.md
├── s3-issue-07-frontend-components.spec.md
├── s3-issue-08-frontend-tests.spec.md
├── s3-issue-09-e2e-tests.spec.md
├── s3-issue-10-ci-cd-refinement.spec.md
├── s3-issue-11-uuid-v7.spec.md
└── s3-issue-12-docker-compose.spec.md
```

Each spec should follow the SDD template used in `clean-architecture-refactor.spec.md`:
- **Context of Business** — why this issue exists
- **Scope** — included and excluded items
- **Acceptance Criteria** — directly from the Sprint 3 plan
- **Contracts between Layers** — interfaces, types, method signatures
- **Non-Functional Requirements** — performance, security (where applicable)
- **Design Patterns** — documented patterns used (Mapper, EventBus, etc.)
- **Definition of Done** — what constitutes completion

### Approach

- Use the Sprint 3 plan as the source document for each spec
- Load `skill: to-spec` to synthesize each issue into a spec file
- Review each spec for accuracy against the actual implementation (check via `git diff v0.2.0..v0.3.0`)
- Specs are documentation-only — no behavioral changes

### Acceptance Criteria

- [ ] 12 `.spec.md` files generated in `specs/` for each Sprint 3 issue
- [ ] Each spec includes Context, Scope, ACs, Contracts, and DoD sections
- [ ] Each spec accurately reflects what was actually implemented (verified against code)
- [ ] `specs/` directory is organized — all Sprint 3 specs are clearly named and grouped
- [ ] No behavioral changes — specs are retroactive documentation

---

## Item 7: Frontend E2E Test Improvements

**Effort**: 1 day  
**Theme**: Quality  
**Blocking**: Item 3  
**Dependencies**: Item 6 (light — can start after SDD specs are drafted)

### Description

E2E tests exist but have gaps in coverage and reliability. Currently only the client creation and invoice creation flows are tested. Tests also lack proper error-state coverage and the Playwright report upload is not consistently triggered.

**What exists**:
- `e2e/tests/client-flow.spec.ts` — create client → verify in dashboard
- `e2e/tests/invoice-flow.spec.ts` — create invoice → verify in billing page
- Playwright HTML report generated on test failure but not consistently uploaded
- `docker-compose.e2e.yml` provides isolated test infrastructure

**What's needed**:

#### 7A: New E2E Tests

| Test | Description | Priority |
|------|-------------|----------|
| **Onboarding flow** | Navigate onboarding wizard, complete all 3 steps, verify success state | High |
| **Dashboard navigation** | Navigate between dashboard, billing, clients pages — verify each renders | High |
| **Error state: invalid form** | Submit empty form, verify validation errors displayed | Medium |
| **Error state: API failure** | Submit with invalid data, verify error toast/alert | Medium |

#### 7B: Playwright Report Reliability

- Ensure `upload-artifact` step triggers on `failure()` for any failure (not just test failures)
- Add `continue-on-error: false` for the test step so failure is properly reported
- Consider adding Playwright trace viewer configuration

#### 7C: Test Data Seeding

- Add a test data seeding script (or setup hook) that populates test data before tests run
- Make tests hermetic — each test creates its own data and cleans up (or uses unique identifiers)

### Acceptance Criteria

- [ ] Onboarding flow E2E test created and passing
- [ ] Dashboard navigation E2E test created and passing
- [ ] At least one error-state E2E test created and passing (invalid form or API failure)
- [ ] All 5 E2E tests (2 existing + 3 new) pass consistently in local environment
- [ ] Playwright HTML report uploads on any failure
- [ ] Tests are hermetic — no shared state between test files
- [ ] Test data seeding works reliably (data exists before tests run)

---

## Effort Summary Table

| Item | Description | Days | Theme | Depends On | Blocks |
|------|-------------|------|-------|------------|--------|
| 6 | Retroactive SDD Spec Generation | 0.5 | Documentation | — | 1, 2, 7 |
| 1 | Read Use Cases (ListClients, GetClient, ListInvoices) | 1.5 | Architecture | 6 | 5 |
| 2 | WebhookVerifierPort Extraction | 0.5 | Architecture | 6 | 4 |
| 7 | Frontend E2E Test Improvements | 1.0 | Quality | 6 | 3 |
| 5 | Service Tests (Onboarding, Reminder) | 1.0 | Quality | 1 | 3 |
| 4 | Unit of Work Pattern | 1.5 | Architecture | 2 | 3 |
| 3 | Active E2E Job in CI | 1.0 | Infrastructure | 4, 5, 7 | — |
| **Total** | | **7.0 days** | | | |

### Parallel Work Streams

```
Week 1 (Jul 30 - Aug 6):
┌─────────────────────────────────────────────────────────────────────────────┐
│ Day 1 (Jul 30)                                                              │
│   Stream A (Docs):    #6(0.5d) ─────────────────────────                    │
│                                                                             │
│ Day 2-3 (Jul 31 - Aug 1):                                                   │
│   Stream B (Arch 1):  #1(1.5d) ─────────────────────                        │
│   Stream C (Arch 2):  #2(0.5d) ──────                                      │
│   Stream D (Quality): #7(1d) ───────────────────────                        │
│                                                                             │
│ Day 3-4 (Aug 1 - Aug 2):                                                    │
│   Stream B (cont):    #1 done → #5(1d) ──────────                           │
│   Stream C (cont):    #2 done → #4(1.5d) ─────────────                      │
│   Stream D (cont):    #7 done (no downstream dep yet)                       │
│                                                                             │
│ Day 5-6 (Aug 3 - Aug 5):                                                    │
│   Stream B:           #5 done (ready for #3)                                │
│   Stream C:           #4 done (ready for #3)                                │
│                                                                             │
│ Day 6-7 (Aug 5 - Aug 6):                                                    │
│   Stream E (Infra):   #3(1d) ────────────────────                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Critical Path**: #6 (0.5d) → #1 (1.5d) → #5 (1d) → #3 (1d) = **4 days**  
**Total calendar time**: 7 days (fits within 1-week sprint with 3-day buffer for review, fixes, and release)

### Effort Distribution by Role

| Role | Items | Total Days |
|------|-------|-----------|
| Architecture | 1, 2, 4 | 3.5 days |
| Quality | 5, 7 | 2.0 days |
| Documentation | 6 | 0.5 day |
| Infrastructure | 3 | 1.0 day |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Read use cases (Item 1) touch 7+ files — merge conflicts if done in parallel with other route changes | Medium | Medium | Do Item 1 early in sprint (first item after #6); minimize parallel changes to routes |
| Unit of Work (Item 4) conflicts with existing repository pattern — repos use their own Prisma client instance, not `getTransaction()` | Medium | High | Audit all repositories first to confirm they use `this.prisma` from the constructor; the `getTransaction()` pattern is additive (fallback to `this.prisma` when no transaction active) |
| E2E CI job unblocks but tests fail due to missing backend runtime | Medium | High | Use `docker compose -f docker/docker-compose.e2e.yml up -d` in CI; add health-check step with retries before running tests |
| `PerTenantHmacVerifier` still uses global env vars instead of DB lookup | Medium | High | Audit implementation during Item 2 — check `findTenantById()` or equivalent is called to fetch webhook secret |
| SDD specs (Item 6) are generated from Sprint 3 plan but may not match actual implementation | Low | Low | Verify each spec against actual code using `git diff v0.2.0..v0.3.0`; mark discrepancies explicitly |
| Service tests (Item 5) reveal coupling issues in OnboardingService/ReminderService | Low | Medium | Accept as discovery — better to find coupling now than later; refactor only if critical |
| Frontend E2E tests (Item 7) may not work with current mock/seed data strategy | Medium | Medium | Add test data seeding step in E2E setup; make tests hermetic with unique identifiers |
| Playwright browser installation fails in CI | Low | High | Pin Playwright version in `package.json`; use `npx playwright install --with-deps chromium` with retry |
| UoW `AsyncLocalStorage` may not be available in all Node.js versions | Low | Low | `AsyncLocalStorage` is available since Node.js 12.17.0 — project uses Node 20; no issue |
| Removing `hmac-verifier.ts` (Item 2) breaks import in another file not caught by audit | Low | Medium | Search all files for `hmac-verifier` imports before removal; run full test suite after removal |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] Item 1: All 3 read use cases implemented, factories created, routes refactored, tests passing
- [ ] Item 2: `WebhookVerifierPort` contract confirmed, legacy verifier cleaned up, contract tests passing
- [ ] Item 3: E2E CI job uncommented and passing on `pull_request` events
- [ ] Item 4: `PrismaUnitOfWork` implemented, repositories transaction-aware, at least one use case wired
- [ ] Item 5: `OnboardingService` and `ReminderService` unit tests passing (≥10 total test cases)
- [ ] Item 6: 12 SDD spec files generated in `specs/` for all Sprint 3 issues
- [ ] Item 7: 5 E2E tests (2 existing + 3 new) passing, Playwright report upload working

### Quality Gates

- [ ] Zero Dependency Rule violations in backend (automated check or manual review of new files)
- [ ] `tsc --noEmit` passes on both apps (backend + frontend)
- [ ] All existing 600+ tests still pass
- [ ] All new code has ≥80% line coverage
- [ ] E2E tests pass in CI (not just locally)
- [ ] No `console.log` or debugging artifacts in production code
- [ ] No hardcoded secrets, URLs, or environment-specific values

### Architecture Checks

- [ ] All read routes (`GET /api/clients`, `GET /api/clients/:id`, `GET /api/invoices`) delegate to use cases
- [ ] `UnitOfWorkPort` is injected into write use cases (not instantiated inside)
- [ ] `WebhookVerifierPort` is used for all webhook verification (no direct HMAC calls)
- [ ] Zero new global singletons (all dependencies injected via factories)
- [ ] No infrastructure imports in application layer (verified by grep)

### Release

- [ ] Tag `v0.4.0` created
- [ ] Release notes written (Sprint 4 summary + all delivered items)
- [ ] `.env.example` updated with any new environment variables
- [ ] All specs committed and pushed

---

## Artifact Checklist

| Item | Artifacts |
|------|-----------|
| 1 | `application/usecases/list-clients.usecase.ts`, `get-client.usecase.ts`, `list-invoices.usecase.ts` + factory files + updated route files + test files |
| 2 | Updated `per-tenant-hmac-verifier.ts` (if needed), removed `hmac-verifier.ts` (if unreferenced), contract test file |
| 3 | Updated `.github/workflows/ci.yml` (E2E job uncommented and fixed) |
| 4 | `infrastructure/database/transaction-context.ts`, `infrastructure/database/unit-of-work.ts`, updated repository files, updated factory files |
| 5 | `__tests__/application/services/onboarding.service.test.ts`, `reminder.service.test.ts` |
| 6 | 12 `.spec.md` files in `specs/` directory |
| 7 | `e2e/tests/onboarding-flow.spec.ts`, `e2e/tests/dashboard-navigation.spec.ts`, `e2e/tests/error-states.spec.ts` |

---

## Release v0.4.0 Checklist

### Pre-Release

- [ ] All 7 items merged to `main`
- [ ] Full test suite passes: `pnpm test` (backend + frontend + e2e)
- [ ] `pnpm build` succeeds on both apps
- [ ] `docker compose -f docker/docker-compose.prod.yml up` works
- [ ] E2E CI job passes on a PR against `main`
- [ ] Zero Dependency Rule violations confirmed

### Release

- [ ] Tag `v0.4.0` created
- [ ] Release notes written (Sprint 4 summary + all delivered items)
- [ ] `.env.example` committed with any new variables
- [ ] All SDD specs committed to `specs/`

---

*Plan prepared by: Architect Agent*  
*Date: 2026-07-30*  
*Related documents: `docs/sprint-3-plan.md`, `docs/sdd.md`, `docs/review-cto.md`, `docs/review-tech-nucleus.md`, `specs/clean-architecture-refactor.spec.md`*
