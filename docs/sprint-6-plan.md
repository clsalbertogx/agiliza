# Sprint 6 Plan — Subscription Module, Payment Recording & Quality Hardening

**Theme**: Platform Core: Subscription Module + Payment Recording + Quality Hardening  
**Period**: 2026-07-30 to 2026-08-06 (1 week)  
**Target Release**: `v0.6.0`

---

## Pre-Sprint Context

Sprint 5 delivered **8 items** — ProcessPaymentUseCase, Real Decision Engine, Webhook Payment Processing, Frontend Component Tests (138 tests), BullMQ Worker Activation, Onboarding Auto-Trigger Bug Fix, Frontend TypeScript Fix, and E2E Local Setup Script. The codebase now has **~200 backend source files**, **12 active Port interfaces**, **11 use cases**, **63 backend test files (708 tests passing)**, **8 frontend test files (138 tests passing)**, **zero Dependency Rule violations**, a fully active CI pipeline with E2E, and a BullMQ worker processing reminder jobs.

Three critical architecture gaps remain from Sprint 5 (identified in `/tmp/handoff-sprint6.md` as Gaps A, B, C):

| Gap | Sprint 6 Item | Priority |
|-----|---------------|----------|
| `Subscription`, `BillingSchedule`, and `Payment` Prisma models exist but have zero application code — no use cases, no repositories, no API endpoints | **Item 2** | 🔴 High |
| `ProcessPaymentUseCase` does not persist `Payment` records — no `PaymentRepositoryPort` exists. The `PaymentMapper` is orphaned. Payment history is non-existent. | **Item 1** | 🔴 High |
| `POST /api/invoices/:id/pay` stores PIX data inline, `ProcessPaymentWebhookUseCase` updates invoice status but never records a `Payment` entity | **Item 1** | 🔴 High |

Additionally, three medium-priority gaps address feature completeness and quality:

| Gap | Sprint 6 Item | Priority |
|-----|---------------|----------|
| Frontend `payment-history` component (27 tests) has no real API to consume — no `GET /api/invoices/:id/payments` endpoint | **Item 3** | 🟡 Medium |
| EventBus + handlers have unit tests but zero end-to-end integration tests (publish → verify handler execution, error isolation, multi-handler scenarios) | **Item 4** | 🟡 Medium |
| Frontend dashboard uses hardcoded `demoInvoices` mock data fallback instead of real API calls | **Item 6** | 🟡 Medium |
| 15 frontend components still untested (33% coverage: 138 of ~420 expected tests) | **Item 5** | 🟡 Medium |

---

## Sprint Goal

Launch the subscription/recurring billing module — create the domain model, use cases, repositories, and API endpoints for subscription management. Simultaneously close the `PaymentRepositoryPort` gap to enable payment persistence, wire the payment history API, and harden quality through EventBus integration tests, expanded frontend component coverage, and dashboard real data wiring.

---

## Dependency Graph

```
┌───────────────────┐  ┌──────────────────┐  ┌───────────────────────┐
│ Item 1: Payment   │  │ Item 2:          │  │ Item 4: EventBus      │
│ RepositoryPort   │  │ Subscription     │  │ Integration Tests     │
│ + Recording       │  │ Module           │  │ 1d                    │
│ 1.5d              │  │ 4d               │  └───────────────────────┘
└───────┬───────────┘  └────────┬─────────┘
        │                       │               ┌───────────────────────┐
        ▼                       ▼               │ Item 5: Frontend      │
┌───────────────────┐  ┌──────────────────┐     │ Remaining Tests       │
│ Item 3: Payment   │  │  (Recurring      │     │ 2d                    │
│ History API       │  │   Invoice Gen)   │     └───────────────────────┘
│ 1d                │  │   Sprint 7 item  │     
└───────────────────┘  └──────────────────┘     ┌───────────────────────┐
                                                │ Item 6: Dashboard     │
                                                │ Real Data             │
                                                │ 1d                    │
                                                └───────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| Item 1 → Item 3 | `PaymentRepositoryPort` must exist before `ListPaymentsForInvoiceUseCase` can query payments. Item 3 cannot start until Item 1's port interface is defined and implemented |
| Item 2 → Sprint 7 | Recurring Invoice Generation (BullMQ repeatable job) is deferred — the subscription module (create/cancel) is the core deliverable; auto-billing arrives in Sprint 7 |
| Items 4, 5, 6 | Fully parallel — no code dependencies on Items 1-3. EventBus tests touch domain events, frontend tests touch components, dashboard real data touches API wiring |

---

## Item 1: PaymentRepositoryPort + Payment Recording (🔴 High, 1.5d)

**Effort**: 1.5 days  
**Theme**: Architecture  
**Blocking**: Item 3  
**Dependencies**: None  

### Description

Create a `PaymentRepositoryPort` interface and `PrismaPaymentRepository` implementation, then wire payment recording into both `ProcessPaymentUseCase` (PIX charge creation) and `ProcessPaymentWebhookUseCase` (webhook confirmation). This closes the critical architecture gap where the `Payment` Prisma table is never written to.

**What exists:**
- `Payment` Prisma model in `schema.prisma` — all fields defined: `id`, `invoiceId`, `amount`, `method`, `provider`, `providerPaymentId`, `status`, `fee`, `netAmount`, `webhookReceivedAt`, `createdAt`, `updatedAt`
- `PaymentMapper` in `infrastructure/database/mappers/payment.mapper.ts` — exists but is **orphaned** (never imported or used)
- `Payment` domain entity in `domain/entities/payment.ts`
- `ProcessPaymentUseCase` creates PIX charge via `PaymentGatewayPort` but does NOT persist a `Payment` record
- `ProcessPaymentWebhookUseCase` updates invoice status via `invoiceRepo.update()` but does NOT create a `Payment` record
- No `PaymentRepositoryPort` in `application/ports/repositories/`

**What's needed:**

#### 1A: PaymentRepositoryPort Interface

```typescript
// application/ports/repositories/payment.repository.port.ts
export interface PaymentRepositoryPort {
  save(payment: Payment): Promise<Payment>;
  findByInvoiceId(invoiceId: string): Promise<Payment[]>;
  findById(paymentId: string): Promise<Payment | null>;
}
```

#### 1B: PrismaPaymentRepository

- Implement `PaymentRepositoryPort` in `infrastructure/database/repositories/prisma-payment.repository.ts`
- Reuse existing `PaymentMapper` (currently orphaned) for `toDomain()` / `toPersistence()` conversions
- Follow the same pattern as `PrismaInvoiceRepository` — `PrismaUnitOfWork` for transactional scope

#### 1C: Wire into ProcessPaymentUseCase

- Inject `PaymentRepositoryPort` into `ProcessPaymentUseCase` constructor
- After successful PIX charge creation via `PaymentGatewayPort`, call `this.paymentRepo.save(payment)` to persist the `Payment` record
- Payment record captures: `amount`, `method: 'PIX'`, `provider`, `providerPaymentId` (from gateway response), `status: 'PENDING'`, `fee`, `netAmount`

#### 1D: Wire into ProcessPaymentWebhookUseCase

- Inject `PaymentRepositoryPort` into `ProcessPaymentWebhookUseCase` constructor
- On `PAYMENT_CONFIRMED`, look up existing `Payment` record by `providerPaymentId` or `invoiceId`
- Update payment status to `'CONFIRMED'`, record `webhookReceivedAt`, update `fee`/`netAmount` from webhook payload
- If no payment record exists (e.g., payment was created outside Agiliza), create a new `Payment` record

#### 1E: Update Factories

- Update `create-process-payment.factory.ts` to inject `PrismaPaymentRepository`
- Update `create-process-payment-webhook.factory.ts` to inject `PrismaPaymentRepository`

### Design Patterns

- **Repository Pattern**: `PaymentRepositoryPort` abstracts Prisma implementation behind a clean interface
- **DomainMapper Pattern**: Reuse `PaymentMapper.toDomain()` / `toPersistence()` — zero `as any` casts
- **Unit of Work**: Both use cases run inside `UnitOfWorkPort` transactions — payment creation + invoice update are atomic

### Acceptance Criteria

- [ ] `PaymentRepositoryPort` interface created in `application/ports/repositories/` with `save()`, `findByInvoiceId()`, `findById()`
- [ ] `PrismaPaymentRepository` implements the port — uses existing `PaymentMapper` for domain mapping
- [ ] `ProcessPaymentUseCase.save()` creates a `Payment` record after successful PIX charge creation (status = `PENDING`)
- [ ] `ProcessPaymentWebhookUseCase` updates existing `Payment` record to `CONFIRMED` with `webhookReceivedAt`, `fee`, `netAmount`
- [ ] `ProcessPaymentWebhookUseCase` creates a `Payment` record if none exists for the incoming webhook
- [ ] No orphaned PIX charges — if invoice update fails after PIX creation, the `Payment` record is still persisted (write ahead)
- [ ] Factories updated to inject `PrismaPaymentRepository`
- [ ] Unit tests: save payment on PIX creation, save payment on webhook confirmed, update existing payment, find by invoice ID, find by ID, invoice not found
- [ ] All existing tests continue to pass (708 backend + 138 frontend)
- [ ] Zero new Dependency Rule violations

---

## Item 2: Subscription Module (🔴 High, 4d)

**Effort**: 4 days  
**Theme**: Core Feature  
**Blocking**: None (deferred: Recurring Invoice Gen → Sprint 7)  
**Dependencies**: None  

### Description

Build the subscription/recurring billing module from scratch. The Prisma schema already has `Subscription`, `BillingSchedule`, and `Invoice.subscriptionId` — but there is zero application code. This item delivers the domain model, use cases (create + cancel), repositories, and API endpoints.

**What exists:**
- `Subscription` Prisma model: `id`, `clientId`, `tenantId`, `planName`, `amount`, `frequency` (MONTHLY/WEEKLY/YEARLY), `status` (ACTIVE/PAUSED/CANCELLED/EXPIRED), `nextBilling`, `startDate`, `cancelledAt`, `createdAt`, `updatedAt`
- `BillingSchedule` Prisma model: `id`, `tenantId`, `frequency`, `dayOfMonth`, `dayOfWeek`, `amount`, `nextBillingDate`, `isActive`
- `Invoice.subscriptionId` — invoices can be linked to subscriptions
- `Client.subscriptions` — clients can have multiple subscriptions
- Clean Architecture patterns from 11 existing use cases (reference: `CreateClientUseCase`, `CreateInvoiceUseCase`)

**What's needed:**

#### 2A: Domain Entities & Value Objects

```typescript
// domain/entities/subscription.ts
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
export type SubscriptionFrequency = 'MONTHLY' | 'WEEKLY' | 'YEARLY';

export class Subscription extends BaseEntity {
  constructor(
    public readonly id: string,
    public readonly clientId: string,
    public readonly tenantId: string,
    public readonly planName: string,
    public readonly amount: Money,
    public readonly frequency: SubscriptionFrequency,
    public readonly status: SubscriptionStatus,
    public readonly nextBilling: Date,
    public readonly startDate: Date,
    public readonly cancelledAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }
}
```

```typescript
// domain/value-objects/billing-cycle.ts
export enum BillingCycleUnit {
  MONTHLY = 'MONTHLY',
  WEEKLY = 'WEEKLY',
  YEARLY = 'YEARLY',
}

export class BillingCycle {
  constructor(
    public readonly unit: BillingCycleUnit,
    public readonly amount: Money,
  ) {}

  /** Calculate the next billing date from a start date */
  calculateNextBilling(from: Date): Date {
    // Add 1 month / 1 week / 1 year to `from`
  }
}
```

```typescript
// domain/entities/plan.ts (or value object if simple)
export interface Plan {
  name: string;
  amount: Money;
  frequency: SubscriptionFrequency;
  description?: string;
}
```

#### 2B: Application Use Cases

##### CreateSubscriptionUseCase

```typescript
// application/usecases/create-subscription.usecase.ts
import { Either } from '@/application/types/either';
import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { UnitOfWorkPort } from '@/application/ports/adapters/unit-of-work.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { ApplicationError } from '@/application/errors';

export interface CreateSubscriptionInput {
  tenantId: string;
  clientId: string;
  planName: string;
  amount: number;
  frequency: SubscriptionFrequency;
  startDate?: Date;  // defaults to today
}

export interface CreateSubscriptionOutput {
  id: string;
  clientId: string;
  planName: string;
  amount: number;
  frequency: SubscriptionFrequency;
  status: 'ACTIVE';
  nextBilling: Date;
  startDate: Date;
}

export class CreateSubscriptionUseCase {
  constructor(
    private readonly clientRepo: ClientRepositoryPort,
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<Either<ApplicationError, CreateSubscriptionOutput>>;
}
```

**Flow:**
1. Validate client exists via `clientRepo.findById(input.clientId, input.tenantId)` → return `NotFoundError` if missing
2. Generate new subscription ID via `idGenerator.generate()`
3. Create `Subscription` domain entity with `status: 'ACTIVE'`, `nextBilling` calculated from frequency
4. Save via `subscriptionRepo.save(subscription)` inside unit of work
5. Return output with subscription details

##### CancelSubscriptionUseCase

```typescript
// application/usecases/cancel-subscription.usecase.ts
export interface CancelSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export interface CancelSubscriptionOutput {
  id: string;
  status: 'CANCELLED';
  cancelledAt: Date;
}

export class CancelSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: CancelSubscriptionInput): Promise<Either<ApplicationError, CancelSubscriptionOutput>>;
}
```

**Flow:**
1. Find subscription by ID + tenantId via `subscriptionRepo.findById()` → return `NotFoundError` if missing
2. Validate subscription is not already cancelled or expired → return `ConflictError` if already cancelled
3. Set `status = 'CANCELLED'`, `cancelledAt = now`, clear `nextBilling`
4. Save via `subscriptionRepo.update(subscription)` inside unit of work
5. Publish `subscription.cancelled` domain event (for future handlers: notify tenant, stop billing)
6. Return output

#### 2C: Repository Port Interface

```typescript
// application/ports/repositories/subscription.repository.port.ts
export interface SubscriptionRepositoryPort {
  save(subscription: Subscription): Promise<Subscription>;
  update(subscription: Subscription): Promise<Subscription>;
  findById(id: string, tenantId: string): Promise<Subscription | null>;
  findByClientId(clientId: string, tenantId: string): Promise<Subscription[]>;
  findByTenantId(tenantId: string): Promise<Subscription[]>;
  findActiveByNextBillingBefore(date: Date): Promise<Subscription[]>;  // for future recurring invoice cron
}
```

#### 2D: Infrastructure

- `PrismaSubscriptionRepository` — implements `SubscriptionRepositoryPort` using Prisma
- `SubscriptionMapper` — `toDomain()` / `toPersistence()` following the existing `DomainMapper<TPersistence, TDomain>` pattern
- `PrismaPlanRepository` (simplified: plans are value objects, not separate tables initially — stored as `planName` + `amount` on the subscription)

#### 2E: Routes

```typescript
// POST /api/subscriptions
// Body: { clientId, planName, amount, frequency }
// Response 201: { id, clientId, planName, amount, frequency, status, nextBilling, startDate }
// Errors: 404 (client not found), 400 (validation), 500

// DELETE /api/subscriptions/:id
// Response 200: { id, status: 'CANCELLED', cancelledAt }
// Errors: 404 (subscription not found), 409 (already cancelled)
```

#### 2F: Factories

- `presentation/factories/create-subscription.factory.ts`
- `presentation/factories/cancel-subscription.factory.ts`

### Design Patterns

- **Repository Pattern**: `SubscriptionRepositoryPort` abstracts Prisma — domain and application layers never import Prisma
- **DomainMapper Pattern**: `SubscriptionMapper` with `toDomain()` / `toPersistence()` — unit testable, zero casts
- **Unit of Work**: Both create and cancel use cases run inside atomic transactions
- **Observer Pattern / Domain Events**: `subscription.cancelled` event emitted on cancellation (consumers: future handlers for notification, billing stop, etc.)

### Edges & Deferred Scope

| Aspect | In Scope (Sprint 6) | Deferred (Sprint 7+) |
|--------|---------------------|---------------------|
| Create subscription | ✅ | — |
| Cancel subscription | ✅ | — |
| Pause/resume subscription | — | Sprint 7 |
| Upgrade/downgrade/proration | — | Sprint 8 |
| Recurring invoice generation | — | Sprint 7 (BullMQ repeatable) |
| Subscription lifecycle (auto-renew, expiry) | — | Sprint 7 |
| Frontend subscription UI | — | Sprint 7 |
| Plan catalog/pricing tiers | — | Sprint 7 |

### Acceptance Criteria

- [ ] `Subscription` domain entity created with all fields (id, clientId, tenantId, planName, amount, frequency, status, nextBilling, startDate, cancelledAt)
- [ ] `BillingCycle` value object created with `calculateNextBilling()` method
- [ ] `SubscriptionRepositoryPort` created with `save()`, `update()`, `findById()`, `findByClientId()`, `findByTenantId()`, `findActiveByNextBillingBefore()`
- [ ] `PrismaSubscriptionRepository` implements the port — uses `SubscriptionMapper` for domain mapping
- [ ] `SubscriptionMapper` with `toDomain()` / `toPersistence()` — unit tested
- [ ] `CreateSubscriptionUseCase` creates a subscription, validates client exists, sets next billing date, publishes no event (deferred)
- [ ] `CancelSubscriptionUseCase` cancels an active subscription, returns error if already cancelled, publishes `subscription.cancelled` event
- [ ] `POST /api/subscriptions` returns 201 with subscription payload
- [ ] `DELETE /api/subscriptions/:id` returns 200 with cancellation payload
- [ ] Error: 404 when client (create) or subscription (cancel) not found
- [ ] Error: 409 when subscription already cancelled (cancel)
- [ ] Error: 400 for validation failures (missing fields, negative amount, invalid frequency)
- [ ] Both routes use Zod schema validation (consistent with existing pattern)
- [ ] Factory singletons created for both use cases
- [ ] Unit tests: domain entities (subscription creation, billing cycle calculation), mapper round-trip, use cases (create success, cancel success, not found, already cancelled, tenant isolation)
- [ ] Tenant isolation verified — subscriptions from tenant A not visible to tenant B
- [ ] All existing tests continue to pass (708 backend + 138 frontend)
- [ ] Zero new Dependency Rule violations

---

## Item 3: Payment History API (🟡 Medium, 1d)

**Effort**: 1 day  
**Theme**: Feature  
**Blocking**: None  
**Dependencies**: Item 1 (PaymentRepositoryPort must exist)

### Description

Create `GET /api/invoices/:id/payments` endpoint that returns payment records for a given invoice. Wire the frontend `payment-history` component to consume this real data instead of mock data.

**What exists:**
- Frontend `payment-history` component with 27 tests (happy path, empty state, error state, loading, pagination)
- Frontend `lib/api.ts` for HTTP calls
- `PaymentRepositoryPort.findByInvoiceId()` (from Item 1)
- `InvoiceRepositoryPort.findById()` (existing)

**What's needed:**

#### 3A: ListPaymentsForInvoiceUseCase

```typescript
// application/usecases/list-payments-for-invoice.usecase.ts
import { Either } from '@/application/types/either';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { ApplicationError } from '@/application/errors';

export interface ListPaymentsForInvoiceInput {
  invoiceId: string;
  tenantId: string;
}

export interface PaymentResponse {
  id: string;
  amount: number;
  method: string;
  provider: string;
  providerPaymentId: string | null;
  status: string;
  fee: number | null;
  netAmount: number | null;
  createdAt: Date;
}

export interface ListPaymentsForInvoiceOutput {
  payments: PaymentResponse[];
  total: number;
}

export class ListPaymentsForInvoiceUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly paymentRepo: PaymentRepositoryPort,
  ) {}

  async execute(input: ListPaymentsForInvoiceInput): Promise<Either<ApplicationError, ListPaymentsForInvoiceOutput>>;
}
```

#### 3B: Route

```typescript
// GET /api/invoices/:id/payments
// Query params: none (pagination deferred)
// Response 200: { payments: PaymentResponse[], total: number }
// Errors: 404 (invoice not found)
```

#### 3C: Factory

- `presentation/factories/create-list-payments.factory.ts`

#### 3D: Frontend Wiring

- Update `payment-history` component (or its data-fetching hook) to call `GET /api/invoices/:id/payments`
- Remove any mock/hardcoded payment data in the frontend
- Preserve the component's existing test coverage (27 tests should pass with real API contract)

### Acceptance Criteria

- [ ] `ListPaymentsForInvoiceUseCase` exists — fetches invoice, fetches payments, returns typed output
- [ ] `GET /api/invoices/:id/payments` returns 200 with `{ payments: [], total: 0 }` when no payments exist
- [ ] `GET /api/invoices/:id/payments` returns 200 with payment records when payments exist
- [ ] `GET /api/invoices/:id/payments` returns 404 when invoice not found
- [ ] Tenant isolation — payments from other tenant's invoices are not visible
- [ ] Frontend `payment-history` component fetches real data from `/api/invoices/:id/payments`
- [ ] All 27 existing `payment-history` tests continue to pass (or updated for API contract)
- [ ] Factory singleton created
- [ ] Unit tests: success (with payments), success (empty list), invoice not found

---

## Item 4: EventBus Integration Tests (🟡 Medium, 1d)

**Effort**: 1 day  
**Theme**: Quality  
**Blocking**: None  
**Dependencies**: None  

### Description

Write end-to-end integration tests for the EventBus + handler ecosystem. Currently the 3 event handlers (SendReceipt, UpdateRiskScore, NotifyOutbound) have unit tests, and `InMemoryEventBus` has unit tests, but there is no end-to-end verification that:
- Publishing an event triggers the correct handlers
- Multiple handlers execute for the same event
- One failing handler does not block other handlers

**What exists:**
- `InMemoryEventBus` in `infrastructure/event-bus/` — implements `EventBusPort`
- `SendReceiptHandler` — subscribed to `payment.confirmed`
- `UpdateRiskScoreHandler` — subscribed to `payment.confirmed`, `payment.failed`, `invoice.overdue`, `message.read`, `message.clicked`
- `NotifyOutboundHandler` — subscribed to `client.created`, `payment.confirmed`, `invoice.overdue`, `decision.made`
- Event registration in `presentation/factories/register-event-handlers.ts`

**What's needed:**

#### Test Scenarios

| Test | Description | Verification |
|------|-------------|-------------|
| **E2E Publish → Handlers Execute** | Publish `payment.confirmed` event via EventBus | Verify `SendReceiptHandler`, `UpdateRiskScoreHandler`, and `NotifyOutboundHandler` are each called exactly once |
| **Multi-Handler Scenario** | Publish `invoice.overdue` event | Verify `UpdateRiskScoreHandler` and `NotifyOutboundHandler` both execute (2 handlers for same event) |
| **Error Isolation** | Publish event where one handler throws, others should still execute | Inject a handler that throws; verify remaining handlers still execute and event bus does not crash |
| **Handler Not Found** | Publish event type with no subscribers | Verify no error is thrown — event is silently ignored |
| **Handler Registration Idempotency** | Subscribe same handler twice for same event | Verify handler is executed only once per published event (or define behavior: duplicate registration throws) |

#### Test Infrastructure

- Use real `InMemoryEventBus` instance (no mocks)
- Use spy handlers (jest.fn()) that record calls
- Run tests without any infrastructure dependencies (pure unit/integration tests)

### Acceptance Criteria

- [ ] Test: publish `payment.confirmed` → all 3 handlers execute (SendReceipt, UpdateRiskScore, NotifyOutbound)
- [ ] Test: publish `invoice.overdue` → both UpdateRiskScore and NotifyOutbound execute
- [ ] Test: one failing handler → other handlers still execute, event bus does not throw
- [ ] Test: publish event with no subscribers → no error, silently ignored
- [ ] Test: handler registration idempotency (or documented behavior)
- [ ] All tests use real `InMemoryEventBus` — no mocked EventBus
- [ ] All existing tests continue to pass

---

## Item 5: Frontend Remaining Component Tests (🟡 Medium, 2d)

**Effort**: 2 days  
**Theme**: Quality  
**Blocking**: None  
**Dependencies**: None  

### Description

Expand frontend component test coverage from 8 tested components to 15+ tested components. Target 7+ new test files with 80+ new tests, covering the remaining untested components.

**What exists:**
- 8 component test files (138 tests) — covering: payment-history (27), invoice-form (25), onboarding-wizard (22), pix-payment-flow (21), kanban-board (17), notification-banner (12), kpi-card (7), risk-badge (7)
- Vitest + @testing-library/react + jest-dom configured
- `data-testid` patterns used in existing tests

**15 components still without tests:**

| Priority | Component | Rationale | Minimum Test Cases |
|----------|-----------|-----------|-------------------|
| P0 | `sidebar.tsx` | Navigation — every page depends on it | Render nav links, highlight active, collapse state |
| P0 | `status-badge.tsx` | Ubiquitous status display | Render each status variant (PAID, PENDING, OVERDUE, CANCELLED) |
| P0 | `loading-skeleton.tsx` | Reusable loading state | Render different skeleton variants (card, table, text) |
| P1 | `client-card.tsx` | Frequently used client display | Happy path, loading skeleton, error fallback |
| P1 | `client-detail-card.tsx` | Detail view with conditional rendering | Happy path, missing data, loading state |
| P1 | `collection-timeline.tsx` | Collection pipeline visualization | Render steps, active step highlight, empty timeline |
| P1 | `empty-state.tsx` | Reusable empty state | Default message, custom message, with action button |
| P1 | `error-state.tsx` | Reusable error state | Default error, custom message, retry button callback |
| P2 | `exception-panel.tsx` | Exception handling display | Render exception details, dismiss action |
| P2 | `invoice-table.tsx` | Invoice data table | Render rows, sort columns, empty state, loading state |
| P2 | `message-tracking.tsx` | WhatsApp message status tracking | Sent, delivered, read, failed states |
| P2 | `payment-status.tsx` | Payment status indicator | Pending, confirmed, failed, refunded states |
| P2 | `report-chart.tsx` | Analytics chart | Render with data, empty state, loading state |
| P2 | `stat-card.tsx` | Statistics display card | Value rendering, label, trend up/down, loading state |
| P2 | 8 UI primitives | badge, button, card, input, label, skeleton, table, textarea | Render without crashing, props reflected in DOM |

### Testing Patterns (consistent with Sprint 5)

```typescript
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/sidebar';

describe('Sidebar', () => {
  it('renders navigation links', () => {
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /invoices/i })).toBeInTheDocument();
  });

  it('highlights active link', () => {
    render(<Sidebar currentPath="/invoices" />);
    expect(screen.getByRole('link', { name: /invoices/i })).toHaveClass('active');
  });
});
```

### Acceptance Criteria

- [ ] ≥7 new test files created in `apps/frontend/src/__tests__/components/`
- [ ] ≥80 new test cases across all new files
- [ ] All 3 P0 components (sidebar, status-badge, loading-skeleton) have tests
- [ ] At least 4 P1 components have tests
- [ ] At least 3 additional components (P2 or UI primitives) have tests
- [ ] Tests cover: happy path, loading state, error state, empty state where applicable
- [ ] Tests use `@testing-library/react` user-centric queries (`getByRole`, `getByText`, `findByTestId`)
- [ ] All 138 existing frontend tests continue to pass
- [ ] `npm test` passes in `apps/frontend/`

---

## Item 6: Dashboard Real Data (🟢 Low, 1d)

**Effort**: 1 day  
**Theme**: Feature  
**Blocking**: None  
**Dependencies**: None  

### Description

Remove the hardcoded `demoInvoices` mock data array and fallback stats from the frontend dashboard page. Wire all dashboard KPI cards and invoice lists to real API calls with proper loading and error states. Add a `NEXT_PUBLIC_DEMO_MODE` flag to conditionally restore demo data in demo/development mode.

**What exists:**
- `apps/frontend/src/app/dashboard/page.tsx` — makes API call to `/api/invoices/stats`
- Falls back to hardcoded `demoInvoices` array (5 fake invoices) when API call fails
- Falls back to hardcoded KPI values: `totalInvoiced: 15990`, `totalCollected: 12450`, etc.
- `lib/api.ts` for HTTP calls

**What's needed:**

#### 6A: Real Data Fetching

- Replace mock data fallback with real API response
- Ensure all dashboard sections use real data:
  - KPI cards → `GET /api/invoices/stats`
  - Recent invoices list → `GET /api/invoices?limit=5`
  - Collection timeline → (if data available from stats endpoint)

#### 6B: Loading & Error States

- Add loading skeleton while data is being fetched
- Add error state with retry button when API call fails
- Graceful degradation: if stats endpoint fails, show error banner but don't crash dashboard

#### 6C: Demo Mode Flag

```typescript
// lib/config.ts or .env.local
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// In dashboard/page.tsx:
if (DEMO_MODE && response.error) {
  // use mock data
} else if (response.error) {
  // show error state
} else {
  // render real data
}
```

### Acceptance Criteria

- [ ] Dashboard KPI cards fetch real data from `/api/invoices/stats` — no mock fallback in production mode
- [ ] Dashboard recent invoices list fetches real data from `/api/invoices?limit=5` (or existing list endpoint)
- [ ] Loading skeleton shown while data is being fetched
- [ ] Error state with retry button shown when API call fails (and demo mode is off)
- [ ] `NEXT_PUBLIC_DEMO_MODE` env var controls mock data fallback behavior
- [ ] No hardcoded invoice data or KPI values in production code path
- [ ] All existing dashboard and component tests continue to pass

---

## Parallel Work Streams

### Stream Diagram

```
Week 1 (Jul 30 - Aug 6):
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Day 1-2 (Jul 30-31):                                                                         │
│   Stream A (Payments):    #1(1.5d) ──────────────────                                         │
│   Stream B (Subs):        #2(4d) ─────────────────────────────────────────────────────         │
│   Stream C (Quality):     #4(1d) + #5(2d) + #6(1d) ──────────────────                        │
│                                                                                               │
│ Day 3-4 (Aug 1-2):                                                                           │
│   Stream A (Payments):    #1 done → #3(1d) ──────                                            │
│   Stream B (Subs):        #2(continues) ─────────────                                       │
│   Stream C (Quality):     #4 done + #5(continues) + #6 done                                  │
│                                                                                               │
│ Day 5-7 (Aug 3-6):                                                                           │
│   Stream A (Payments):    #3 done ✅                                                          │
│   Stream B (Subs):        #2 done ✅                                                          │
│   Stream C (Quality):     #5 done ✅                                                          │
│                                                                                               │
│   Buffer: Review, bug fixes, TypeScript check, release prep                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Parallelism Rationale

| Stream | Items | Total Effort | Dependency |
|--------|-------|-------------|------------|
| **Stream A (Payments)** | #1 → #3 | 2.5 days | Sequential (Item 1 `PaymentRepositoryPort` is prerequisite for Item 3 Payment History API) |
| **Stream B (Subscriptions)** | #2 | 4 days | Fully parallel with Stream A (no shared files — subscription domain is independent) |
| **Stream C (Quality)** | #4 + #5 + #6 | 4 days | Fully parallel with Stream A+B (EventBus tests, frontend tests, dashboard are independent) |

### Critical Path

**#1 (1.5d) → #3 (1d) = 2.5 days** (Stream A)  
**#2 (4d) = 4 days** (Stream B — longest single item, starts day 1)  

Total calendar time: ~6 days (fits within 1-week sprint with 1-day buffer for review, fixes, and release).

---

## Effort Summary Table

| Item | Description | Days | Theme | Stream | Depends On | Blocks |
|------|-------------|------|-------|--------|------------|--------|
| 1 | **PaymentRepositoryPort + Recording** | 1.5 | Architecture | A | — | 3 |
| 2 | **Subscription Module** | 4.0 | Core Feature | B | — | — |
| 3 | **Payment History API** | 1.0 | Feature | A | 1 | — |
| 4 | **EventBus Integration Tests** | 1.0 | Quality | C | — | — |
| 5 | **Frontend Remaining Tests** | 2.0 | Quality | C | — | — |
| 6 | **Dashboard Real Data** | 1.0 | Feature | C | — | — |
| | **Total** | **10.5 days** | | | **(3 parallel streams)** | |

### Effort Distribution by Theme

| Theme | Items | Total Days |
|-------|-------|-----------|
| Architecture | 1 | 1.5 days |
| Core Feature | 2 | 4.0 days |
| Feature | 3, 6 | 2.0 days |
| Quality | 4, 5 | 3.0 days |

### Sprint Capacity

- **Total effort**: 10.5 days
- **Sprint duration**: 1 week (5 working days)
- **Team size**: 3 parallel streams (Payments, Subscriptions, Quality)
- **Calendar time with parallelism**: Items 1 (1.5d) + 2 (4d) + 4 (1d) + 5 (2d) + 6 (1d) = 4 days max parallel → Item 3 (1d) after Item 1 = 5 days total
- **Feasibility**: ✅ Fits within 1-week sprint with 2-day buffer for review, fixes, and release

### Trade-offs

| If | Then |
|----|------|
| Item 2 (Subscription Module) overruns beyond 4 days | Defer pause/resume and plan catalog to Sprint 7; deliver create + cancel only |
| Item 1 + 3 overruns | Defer Payment History API to Sprint 7 (Item 1 is higher priority — persistence is the gap) |
| Item 5 (Frontend Tests) overruns | Defer low-priority components (UI primitives, report-chart, message-tracking) |
| CI/Regression issues surface | Cut Item 6 (Dashboard — lowest priority) to free 1 day for fixes |

---

## Risk Register

### 🔴 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Subscription module (Item 2) is the largest single item at 4 days — scope creep could push it past sprint boundary | Medium | High | Strict scope: create + cancel only. Defer pause/resume, upgrade/downgrade, proration, plan catalog to Sprint 7. No frontend UI. |
| No `PaymentRepositoryPort` exists — Item 1 creates it from scratch. If Prisma schema mismatch is found, migration may be needed | Medium | Medium | Audit Prisma `Payment` model on sprint day 1; confirm it matches `PaymentMapper`'s `toPersistence()` shape. Run `prisma migrate dev` to verify. |
| Payment webhook processing currently does NOT create `Payment` records — retrofitting persistence into `ProcessPaymentWebhookUseCase` may break existing behavior | Medium | High | Write integration test FIRST that covers existing webhook flow; then add payment recording. Ensure existing 14 webhook tests still pass. |

### 🟡 Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Payment history API (Item 3) depends on Item 1 — if Item 1 is delayed, Item 3 cannot start | Medium | Medium | Item 1 is only 1.5 days; start it on sprint day 1. Item 3 team can write the use case interface and frontend wiring against the `PaymentRepositoryPort` contract before implementation is complete. |
| Frontend component tests (Item 5) may uncover components that are hard to test due to missing `data-testid` attributes or deep prop drilling | Medium | Medium | Add `data-testid` attributes during test writing (acceptable pattern). Prefer semantic queries first (`getByRole`, `getByText`). |
| Dashboard real data (Item 6) removal may break demo experience for potential customers | Medium | Low | `NEXT_PUBLIC_DEMO_MODE` flag preserves mock data in demo mode — production mode gets real data. Document the flag in `.env.example`. |
| E2E CI job may fail due to unverified E2E setup — E2E tests were uncommented in Sprint 4 but never verified in CI | Medium | High | Run E2E locally via `scripts/e2e-setup.sh` before sprint end. Fix any failures. If E2E is red, document known failure and defer to Sprint 7. |

### 🟢 Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `SubscriptionMapper` to `PrismaSubscriptionRepository` mapping may have field type mismatches (e.g., `Decimal` vs `number`, enum mismatch) | Low | Medium | Run mapper unit tests with real Prisma schema. `SubscriptionMapper.toDomain()` and `toPersistence()` must round-trip. |
| Frontend test count increase may slow CI test job | Low | Low | Vitest is fast; 80 new tests add ~5-10s to CI. Acceptable. |
| `payment.confirmed` event handlers (SendReceipt, UpdateRiskScore, NotifyOutbound) may not fire correctly when EventBus is used in integration tests | Low | Medium | Mock external dependencies (Evolution API, outbound HTTP) in integration tests. Use real `InMemoryEventBus`. |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] Item 1: `PaymentRepositoryPort` created, `PrismaPaymentRepository` implemented, wired into `ProcessPaymentUseCase` and `ProcessPaymentWebhookUseCase`, unit tests passing
- [ ] Item 2: `Subscription` domain entity, `BillingCycle` value object, `CreateSubscriptionUseCase`, `CancelSubscriptionUseCase`, `PrismaSubscriptionRepository`, `SubscriptionMapper`, `POST /api/subscriptions`, `DELETE /api/subscriptions/:id`, unit tests passing
- [ ] Item 3: `ListPaymentsForInvoiceUseCase`, `GET /api/invoices/:id/payments` endpoint, frontend `payment-history` wired to real API, tests passing
- [ ] Item 4: EventBus integration tests covering publish→handlers, multi-handler, error isolation, no-subscriber, handler registration — all passing
- [ ] Item 5: ≥7 new frontend test files, ≥80 new tests across remaining untested components, all tests passing
- [ ] Item 6: Dashboard fetches real data, loading/error states added, `NEXT_PUBLIC_DEMO_MODE` flag implemented

### Quality Gates

- [ ] Zero Dependency Rule violations in backend (automated check or manual review of new files)
- [ ] `tsc --noEmit` passes on both apps (backend + frontend)
- [ ] All existing 708 backend tests still pass
- [ ] All existing 138 frontend tests still pass
- [ ] All new tests (Items 1-6) pass
- [ ] No `console.log` or debugging artifacts in production code
- [ ] No hardcoded secrets, URLs, or environment-specific values
- [ ] All new use cases have ≥80% line coverage

### Architecture Checks

- [ ] `UnitOfWorkPort` is injected into write use cases (create subscription, cancel subscription) — not instantiated inside
- [ ] `PaymentRepositoryPort` is injected into both `ProcessPaymentUseCase` and `ProcessPaymentWebhookUseCase`
- [ ] `SubscriptionRepositoryPort` is the only subscription data dependency in application layer (no Prisma imports)
- [ ] `PaymentMapper` is no longer orphaned — imported by `PrismaPaymentRepository`
- [ ] `SubscriptionMapper` follows the same `toDomain()` / `toPersistence()` pattern as existing mappers
- [ ] Tenant isolation verified: subscriptions and payments from tenant A not visible to tenant B
- [ ] Zero new global singletons (all dependencies injected via factories)
- [ ] No infrastructure imports in application layer (verified by grep)
- [ ] `process.env.NEXT_PUBLIC_DEMO_MODE` is the only env var added (dashboard demo flag)

### Release

- [ ] Tag `v0.6.0` created
- [ ] Release notes written (Sprint 6 summary + all delivered items)
- [ ] `.env.example` updated with any new environment variables (`NEXT_PUBLIC_DEMO_MODE`)
- [ ] Prisma migrations committed (if `Subscription`, `BillingSchedule`, or `Payment` schema was modified)
- [ ] All new specs committed to `specs/` directory

---

## Artifact Checklist

| Item | Artifacts |
|------|-----------|
| **1** | `application/ports/repositories/payment.repository.port.ts`, `infrastructure/database/repositories/prisma-payment.repository.ts`, updated `ProcessPaymentUseCase` (inject + save), updated `ProcessPaymentWebhookUseCase` (inject + save/update), updated factories, test file |
| **2** | `domain/entities/subscription.ts`, `domain/value-objects/billing-cycle.ts`, `application/usecases/create-subscription.usecase.ts`, `application/usecases/cancel-subscription.usecase.ts`, `application/ports/repositories/subscription.repository.port.ts`, `infrastructure/database/repositories/prisma-subscription.repository.ts`, `infrastructure/database/mappers/subscription.mapper.ts`, `routes/subscription.routes.ts`, `presentation/factories/create-subscription.factory.ts`, `presentation/factories/cancel-subscription.factory.ts`, test files (domain, mapper, use cases) |
| **3** | `application/usecases/list-payments-for-invoice.usecase.ts`, `presentation/factories/create-list-payments.factory.ts`, `routes/payment.routes.ts` (or extended invoice routes), updated frontend `payment-history` component, test files |
| **4** | Test file(s) in `apps/backend/src/__tests__/events/` covering: publish→handlers, multi-handler, error isolation, no-subscriber, handler registration |
| **5** | ≥7 new test files in `apps/frontend/src/__tests__/components/` covering sidebar, status-badge, loading-skeleton, client-card, client-detail-card, collection-timeline, empty-state, error-state, and others |
| **6** | Updated `apps/frontend/src/app/dashboard/page.tsx`, `lib/config.ts` (or env config), loading/error states, `.env.example` update for `NEXT_PUBLIC_DEMO_MODE` |

---

## Release v0.6.0 Checklist

### Pre-Release

- [ ] All committed items merged to `main`
- [ ] Full test suite passes: `npm test` (backend + frontend)
- [ ] `npm run build` succeeds on both apps
- [ ] E2E tests pass locally via `scripts/e2e-setup.sh` (or known-failure documented)
- [ ] Zero Dependency Rule violations confirmed
- [ ] `.env.example` committed with `NEXT_PUBLIC_DEMO_MODE` variable
- [ ] Prisma migrations up-to-date and committed

### Release

- [ ] Tag `v0.6.0` created
- [ ] Release notes written (Sprint 6 summary + all delivered items)

---

## Sprint 6 Specs to Generate

Beyond this plan, the following SDD specs should be created for the new features:

| Spec | Domain | Priority |
|------|--------|----------|
| `specs/payment-repository-port.spec.md` | PaymentRepositoryPort + recording | High (before Item 1 implementation) |
| `specs/subscription-module.spec.md` | Subscription domain, use cases, routes | High (before Item 2 implementation) |
| `specs/payment-history-api.spec.md` | Payment History API + frontend wiring | Medium |
| `specs/eventbus-integration-tests.spec.md` | EventBus e2e test scenarios | Medium |

---

*Plan prepared by: Architect Agent*  
*Date: 2026-07-30*  
*Related documents: `docs/sprint-5-plan.md`, `/tmp/handoff-sprint6.md`, `docs/sdd.md`, `docs/review-cto.md`, `specs/clean-architecture-refactor.spec.md`*
