# Sprint 7 Plan — Recurring Billing: Automated Invoice Generation & Subscription Lifecycle

**Theme**: Recurring Billing — Complete the subscription module with automated recurring invoice generation  
**Period**: 2026-08-06 to 2026-08-13 (1 week)  
**Target Release**: `v0.7.0`

---

## Pre-Sprint Context

Sprint 6 delivered the subscription module foundation: `Subscription` domain entity, `CreateSubscriptionUseCase`, `CancelSubscriptionUseCase`, `SubscriptionRepositoryPort`, `PrismaSubscriptionRepository`, `POST/GET/DELETE /api/subscriptions` endpoints, and unit tests. Sprint 6.1 (hotfix) resolved 15 audit findings across architecture (Dependency Rule, UUID v7), packaging (`@agiliza/shared`), config gaps, frontend cleanup, and CI hardening.

**What exists now (after Sprint 6.1):**

| Capability | Status |
|-----------|--------|
| Subscription domain entity (create, cancel, statuses) | ✅ Delivered in Sprint 6 |
| `SubscriptionRepositoryPort` + `PrismaSubscriptionRepository` | ✅ Delivered in Sprint 6 |
| `CreateSubscriptionUseCase` + `CancelSubscriptionUseCase` | ✅ Delivered in Sprint 6 |
| `POST/GET/DELETE /api/subscriptions` routes | ✅ Delivered in Sprint 6 |
| `PaymentRepositoryPort` + payment recording | ✅ Delivered in Sprint 6 |
| `PaymentHistory API` (`GET /api/invoices/:id/payments`) | ✅ Delivered in Sprint 6 |
| BullMQ queue infrastructure (queue-manager, worker, definitions) | ✅ Delivered in Sprint 5/6 |
| EventBus + 3 handlers (SendReceipt, UpdateRiskScore, NotifyOutbound) | ✅ Delivered in Sprint 5/6 |
| EventBus integration tests | ✅ Delivered in Sprint 6 |
| Prisma `Subscription` model (nextBilling, status, endDate, etc.) | ✅ Exists |

**Three critical gaps remain (the scope of Sprint 7):**

| Gap | Sprint 7 Item | Priority |
|-----|---------------|----------|
| No recurring invoice generation — subscriptions are created but never bill automatically | **A.1** | 🔴 High |
| No subscription lifecycle management — expire, renew, pause use cases don't exist | **A.2** | 🔴 High |
| No auto-pay for recurring invoices — `subscription.invoice.created` event has no handler, no payment recording | **A.3** | 🔴 High |
| Zero end-to-end integration tests for the subscription → recurring invoice → payment flow | **A.4** | 🟡 Medium |

---

## Sprint Goal

Complete the recurring billing module. By end of sprint, subscriptions automatically generate invoices based on their billing cycle, expired subscriptions are marked EXPIRED, renewal extends the billing period, pause/resume works, and auto-pay records payments for recurring invoices — all validated by end-to-end integration tests.

---

## Dependency Graph

```
┌──────────────────────────────────────────────────┐
│ A.1: BullMQ Invoice Generator Worker (1.5d)      │
│   - CreateInvoiceForSubscriptionUseCase          │
│   - RecurringInvoiceWorker (BullMQ repeatable)   │
│   - Wire into index.ts startup                   │
└────────────┬─────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────┐
│ A.2: Subscription Lifecycle (1d)                  │
│   - ExpireSubscriptionUseCase                     │
│   - RenewSubscriptionUseCase                      │
│   - PauseSubscriptionUseCase                      │
│   - SubscribeToPlanUseCase (with recurring flag)  │
└────────────┬─────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────┐
│ A.3: Payment Repo + Auto-Pay (1d)                 │
│   - Wire PaymentRepository in recurring flow      │
│   - Auto-pay for subscriptions with saved method  │
│   - Event handler for subscription.invoice.created│
└────────────┬─────────────────────────────────────┘
             ▼
┌──────────────────────────────────────────────────┐
│ A.4: Integration Test (1d)                        │
│   - End-to-end: subscription → recurring invoice  │
│     → payment → webhook → event handlers          │
└──────────────────────────────────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| A.1 → A.2 | `CreateInvoiceForSubscriptionUseCase` defines the invoice generation contract that `RenewSubscriptionUseCase` triggers after renewal. The `subscription.invoice.created` domain event must exist before auto-pay (A.3) can subscribe to it |
| A.2 → A.3 | Subscription lifecycle use cases (expire, renew, pause) are prerequisites for auto-pay — auto-pay only applies to active subscriptions. `RenewSubscriptionUseCase` updates `nextBilling`, which the auto-pay handler needs |
| A.3 → A.4 | End-to-end test requires auto-pay to be wired. A.4 cannot start until A.1→A.3 are implemented |
| A.4 | Fully sequential after A.1→A.3 — integration test validates the complete flow |

---

## Item A.1: BullMQ Invoice Generator Worker (🔴 High, 1.5d)

**Effort**: 1.5 days  
**Theme**: Core Feature  
**Blocking**: A.2, A.3  
**Dependencies**: None (subscription module + PaymentRepositoryPort exist)

### Description

Create the recurring invoice generation engine. A BullMQ repeatable (daily) worker scans all active subscriptions where `nextBilling <= today` and generates an invoice for each. This is the heart of the recurring billing module.

**What exists:**
- `SubscriptionRepositoryPort` with `findById()`, `update()`, `findByClientId()`, `findByTenantId()` — but **no `findActiveByNextBillingBefore(date)`** method
- `CreateSubscriptionUseCase` — creates subscriptions with `nextBilling` set
- `Invoice` domain entity and `InvoiceRepositoryPort`
- `CreateInvoiceUseCase` — creates single invoices manually
- BullMQ queue infrastructure: `queue-manager.ts`, `queue-definitions.ts`, existing worker pattern (`startReminderWorker`)
- `index.ts` starts the reminder worker in `buildApp()`
- `PaymentRepositoryPort.create()` exists
- `EventBusPort.publish()` exists with `subscription.created`, `subscription.cancelled`, `subscription.expired` events registered
- **No** `subscription.invoice.created` domain event type

**What's needed:**

#### 1A: Add `findActiveByNextBillingBefore` to SubscriptionRepositoryPort

```typescript
// application/ports/repositories/subscription.repository.port.ts — add method
export interface SubscriptionRepositoryPort {
  // ... existing methods
  findActiveByNextBillingBefore(date: Date, tenantId?: string): Promise<Subscription[]>;
}
```

Implement in `PrismaSubscriptionRepository`:
```typescript
async findActiveByNextBillingBefore(date: Date, tenantId?: string): Promise<Subscription[]> {
  const where: any = {
    status: 'ACTIVE',
    nextBilling: { lte: date },
  };
  if (tenantId) where.tenantId = tenantId;
  const results = await this.txClient.subscription.findMany({ where });
  return results.map((r) => this.mapper.toDomain(r as unknown as PersistenceSubscription));
}
```

#### 1B: Add Domain Event Type

```typescript
// domain/events/domain-events.ts — add to DomainEventType union
export type DomainEventType = 
  | /* ... existing ... */
  | 'subscription.invoice.created'
  | 'subscription.renewed'
  | 'subscription.paused';
```

Add corresponding `EventType` enum value in Prisma schema:
```prisma
enum EventType {
  // ... existing ...
  SUBSCRIPTION_RENEWED
  SUBSCRIPTION_PAUSED
  SUBSCRIPTION_INVOICE_CREATED
}
```

#### 1C: CreateInvoiceForSubscriptionUseCase

```typescript
// application/usecases/create-invoice-for-subscription.usecase.ts
import { Either } from '@/domain/types/either';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { UnitOfWorkPort } from '@/application/ports/adapters/unit-of-work.port';
import { ApplicationError } from '@/application/errors';

export interface CreateInvoiceForSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
  referenceMonth: Date;  // the month/year this invoice is for
}

export interface CreateInvoiceForSubscriptionOutput {
  invoiceId: string;
  subscriptionId: string;
  amount: number;
  dueDate: Date;
  status: string;
}

export class CreateInvoiceForSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: CreateInvoiceForSubscriptionInput): Promise<Either<ApplicationError, CreateInvoiceForSubscriptionOutput>>;
}
```

**Flow:**
1. Find subscription by ID + tenantId → return `NotFoundError` if missing
2. Validate subscription is `ACTIVE` (not CANCELLED/EXPIRED/PAUSED) → return `ConflictError` if not active
3. Validate no invoice already exists for this subscription + reference month (idempotency guard) → skip if duplicate
4. Calculate `dueDate` based on billing cycle from `nextBilling` (default: due on `nextBilling` date)
5. Create `Invoice` entity with `subscriptionId`, `amount` from subscription, `description` = `"Fatura {plan} - {referenceMonth}"`
6. Save via `invoiceRepo.create(invoice)` inside unit of work
7. Publish `subscription.invoice.created` domain event with invoice details
8. Return output

#### 1D: RecurringInvoiceWorker (BullMQ Repeatable)

Create a new queue + worker specifically for recurring invoice generation:

```typescript
// infrastructure/queue/recurring-invoice.worker.ts
export function startRecurringInvoiceWorker(
  useCase: CreateInvoiceForSubscriptionUseCase,
  subscriptionRepo: SubscriptionRepositoryPort,
): Worker;
```

**Repeatable schedule:** Daily at 03:00 AM (configurable via env var `RECURRING_INVOICE_CRON`).

**Job logic:**
1. Fetch all active subscriptions where `nextBilling <= now` via `subscriptionRepo.findActiveByNextBillingBefore()`
2. For each subscription, call `CreateInvoiceForSubscriptionUseCase.execute()`
3. Idempotency: skip subscriptions that already have an invoice for the current billing period (checked inside the use case)
4. Log summary: `[RecurringInvoice] Generated X invoices for Y subscriptions`
5. On partial failure: individual invoice failures are logged but don't stop other invoices from being created

**Add queue definition:**
```typescript
// infrastructure/queue/queue-definitions.ts — add
export const QueueNames = {
  // ... existing ...
  RECURRING_INVOICE: 'recurring-invoice',
} as const;
```

#### 1E: Wire Worker in index.ts

```typescript
// apps/backend/src/index.ts — add after reminder worker setup
const recurringInvoiceUseCase = createCreateInvoiceForSubscriptionUseCase();
const subscriptionRepo = createSubscriptionRepository();
const recurringInvoiceWorker = startRecurringInvoiceWorker(recurringInvoiceUseCase, subscriptionRepo);
```

Add to shutdown sequence:
```typescript
if (recurringInvoiceWorker) await closeWorker(recurringInvoiceWorker);
```

#### 1F: Factory

```typescript
// presentation/factories/create-recurring-invoice.factory.ts
export function createCreateInvoiceForSubscriptionUseCase(): CreateInvoiceForSubscriptionUseCase;
```

### Design Patterns

- **Strategy Pattern**: The BullMQ worker is the concrete strategy for recurring invoice generation — the use case is pure domain logic decoupled from the scheduling mechanism
- **Observer Pattern / Domain Events**: `subscription.invoice.created` event is published by the use case, consumed by `AutoPayHandler` (Item A.3) — the use case never calls payment logic directly
- **Unit of Work**: Invoice creation + subscription nextBilling update are atomic

### Idempotency

The worker must be safe to run multiple times. Idempotency is guaranteed by:
1. `CreateInvoiceForSubscriptionUseCase` checks that no invoice exists for the same `subscriptionId` + reference month before creating
2. If an invoice already exists, the use case returns success (no-op) instead of error

### Acceptance Criteria

- [ ] `findActiveByNextBillingBefore(date)` added to `SubscriptionRepositoryPort` and implemented in `PrismaSubscriptionRepository`
- [ ] `CreateInvoiceForSubscriptionUseCase` exists — creates invoice for active subscription, validates status, checks idempotency
- [ ] `subscription.invoice.created` domain event type added to `DomainEventType` union and Prisma `EventType` enum
- [ ] `RecurringInvoiceWorker` created as BullMQ repeatable (daily cron) — scans subscriptions where `nextBilling <= today`
- [ ] Worker invokes `CreateInvoiceForSubscriptionUseCase` for each matching subscription
- [ ] Worker handles partial failures — one failed invoice doesn't block others
- [ ] Worker logs summary (X invoices generated, Y subscriptions scanned)
- [ ] `RECURRING_INVOICE` queue definition added to `QueueNames`
- [ ] Worker wired into `index.ts` startup with graceful shutdown
- [ ] Factory `createCreateInvoiceForSubscriptionUseCase` created
- [ ] Unit tests: use case (success, subscription not found, subscription not active, idempotency skip), worker scheduling test
- [ ] All existing tests continue to pass (~750 backend + ~204 frontend)
- [ ] Zero new Dependency Rule violations

---

## Item A.2: Subscription Lifecycle (🔴 High, 1d)

**Effort**: 1 day  
**Theme**: Core Feature  
**Blocking**: A.3 (RenewSubscriptionUseCase updates nextBilling — auto-pay depends on this)  
**Dependencies**: A.1 (invoice generation event type must exist)

### Description

Build the remaining subscription lifecycle use cases: expire, renew, pause, and ensure `CreateSubscriptionUseCase` records the recurring flag. These complete the subscription state machine.

**What exists:**
- `Subscription` domain entity with `SubscriptionStatus.ACTIVE | CANCELLED | EXPIRED | PAUSED` enum
- `cancelSubscription()` domain function exists
- `updateSubscription()` domain function exists for partial updates
- `SubscriptionRepositoryPort` with `update(id, data)` method
- `EventBusPort` with `publish()` and events: `subscription.created`, `subscription.cancelled`, `subscription.expired`
- **No** `subscription.renewed` or `subscription.paused` event types (need to add to `DomainEventType`)
- **No** reuse or calculation of `nextBilling` beyond initial creation (the `calculateNextBilling` logic is private in `CreateSubscriptionUseCase`)

**What's needed:**

#### 2A: Extract BillingCycle Service

The `calculateNextBilling()` logic currently lives as a private method in `CreateSubscriptionUseCase`. Extract it into a shared utility so `RenewSubscriptionUseCase` can reuse it:

```typescript
// domain/services/billing-cycle.service.ts (or domain/value-objects)
export function calculateNextBilling(billingCycle: BillingCycle, fromDate: Date): Date {
  const date = new Date(fromDate);
  switch (billingCycle) {
    case BillingCycle.MONTHLY:    date.setMonth(date.getMonth() + 1); break;
    case BillingCycle.BIMONTHLY:  date.setMonth(date.getMonth() + 2); break;
    case BillingCycle.QUARTERLY:  date.setMonth(date.getMonth() + 3); break;
    case BillingCycle.SEMIANNUAL: date.setMonth(date.getMonth() + 6); break;
    case BillingCycle.ANNUAL:     date.setFullYear(date.getFullYear() + 1); break;
  }
  return date;
}
```

Update `CreateSubscriptionUseCase` to use the shared function instead of the private method.

#### 2B: Add Domain Event Types

```typescript
// domain/events/domain-events.ts — ensure these are in the union
export type DomainEventType = 
  | /* ... existing including A.1's subscription.invoice.created ... */
  | 'subscription.renewed'
  | 'subscription.paused';
```

#### 2C: ExpireSubscriptionUseCase

```typescript
// application/usecases/expire-subscription.usecase.ts
export interface ExpireSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export class ExpireSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: ExpireSubscriptionInput): Promise<Either<ApplicationError, Subscription>>;
}
```

**Flow:**
1. Find subscription by ID + tenantId → return `NotFoundError` if missing
2. Validate status is not already `EXPIRED` or `CANCELLED` → return `ConflictError`
3. Set `status = 'EXPIRED'`, clear `nextBilling`, set `endDate = now`
4. Persist via `subscriptionRepo.update(id, data)`
5. Publish `subscription.expired` event
6. Return updated subscription

**Add auto-expire batch use case** for the worker (optional in Sprint 7 — can run as part of the recurring invoice worker's daily scan):
- A batch check during the recurring invoice job: subscriptions where `endDate < today` and status is `ACTIVE` or `PAUSED` get auto-expired

#### 2D: RenewSubscriptionUseCase

```typescript
// application/usecases/renew-subscription.usecase.ts
export interface RenewSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export class RenewSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: RenewSubscriptionInput): Promise<Either<ApplicationError, Subscription>>;
}
```

**Flow:**
1. Find subscription by ID + tenantId → return `NotFoundError` if missing
2. Validate subscription is `ACTIVE` → return `ConflictError` if CANCELLED/EXPIRED/PAUSED
3. Calculate new `nextBilling` using `calculateNextBilling()` from current `nextBilling`
4. Update subscription: `nextBilling = calculated`, `updatedAt = now`
5. Persist via `subscriptionRepo.update(id, data)`
6. Optionally trigger invoice generation: publish `subscription.invoice.created` (or let the daily worker pick it up via the updated `nextBilling`)
7. Publish `subscription.renewed` event
8. Return updated subscription

**Usage**: Called when a subscription's billing period ends and payment was successful. The auto-pay handler (A.3) calls this after successful payment.

#### 2E: PauseSubscriptionUseCase

```typescript
// application/usecases/pause-subscription.usecase.ts
export interface PauseSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export interface ResumeSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export class PauseSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: PauseSubscriptionInput): Promise<Either<ApplicationError, Subscription>>;
  async resume(input: ResumeSubscriptionInput): Promise<Either<ApplicationError, Subscription>>;
}
```

**Pause flow:**
1. Find subscription by ID + tenantId → return `NotFoundError` if missing
2. Validate subscription is `ACTIVE` → return `ConflictError` if already PAUSED/CANCELLED/EXPIRED
3. Set `status = 'PAUSED'`
4. Persist via `subscriptionRepo.update(id, data)`
5. Publish `subscription.paused` event
6. Return updated subscription

**Resume flow:**
1. Find subscription by ID + tenantId → return `NotFoundError` if missing
2. Validate subscription is `PAUSED` → return `ConflictError` if ACTIVE/CANCELLED/EXPIRED
3. Set `status = 'ACTIVE'`, recalculate `nextBilling` (use original `nextBilling` or extend by pause duration)
4. Persist via `subscriptionRepo.update(id, data)`
5. Publish `subscription.renewed` event (reuse the event — the subscription is active again)
6. Return updated subscription

#### 2F: Routes

```typescript
// PATCH /api/subscriptions/:id/expire  — Expire a subscription
// PATCH /api/subscriptions/:id/renew  — Renew a subscription
// PATCH /api/subscriptions/:id/pause  — Pause a subscription
// PATCH /api/subscriptions/:id/resume — Resume a paused subscription
```

All routes:
- Return 200 with subscription payload on success
- Return 404 if subscription not found
- Return 409 if status transition is invalid
- Use Zod schema validation for request body (if any)

#### 2G: Factories

```typescript
// presentation/factories/create-expire-subscription.factory.ts
// presentation/factories/create-renew-subscription.factory.ts
// presentation/factories/create-pause-subscription.factory.ts
// presentation/factories/create-resume-subscription.factory.ts (can share with pause factory)
```

### Design Patterns

- **State Machine Pattern**: Subscription status transitions follow a strict state machine:
  - `ACTIVE ↔ PAUSED` (toggle)
  - `ACTIVE → CANCELLED` (terminal)
  - `ACTIVE → EXPIRED` (terminal, via endDate)
  - `PAUSED → EXPIRED` (terminal, via endDate)
  - `CANCELLED` / `EXPIRED` are terminal — no transitions out
- **Observer Pattern / Domain Events**: Each status transition publishes a domain event for downstream consumers (notification, billing stop, etc.)

### Acceptance Criteria

- [ ] `calculateNextBilling()` extracted to shared domain service — used by both `CreateSubscriptionUseCase` and `RenewSubscriptionUseCase`
- [ ] `ExpireSubscriptionUseCase` — marks subscription EXPIRED, clears nextBilling, publishes event
- [ ] `RenewSubscriptionUseCase` — calculates new nextBilling, updates subscription, publishes event
- [ ] `PauseSubscriptionUseCase` — sets status to PAUSED, publishes event
- [ ] Resume flow — sets status back to ACTIVE, recalculates nextBilling, publishes event
- [ ] All use cases validate tenant isolation (subscription must belong to the requesting tenant)
- [ ] All use cases return 404 for not-found, 409 for invalid state transitions
- [ ] `subscription.renewed` and `subscription.paused` domain event types added
- [ ] Routes created: PATCH expire, renew, pause, resume
- [ ] Factories created for all 4 use cases
- [ ] Unit tests: all 4 use cases (success + error paths), state machine transitions, tenant isolation
- [ ] All existing tests continue to pass
- [ ] Zero new Dependency Rule violations

---

## Item A.3: Payment Repo + Auto-Pay (🔴 High, 1d)

**Effort**: 1 day  
**Theme**: Core Feature  
**Blocking**: A.4 (integration test requires auto-pay)  
**Dependencies**: A.1 (subscription.invoice.created event), A.2 (RenewSubscriptionUseCase)

### Description

Wire up automatic payment processing for recurring invoices. When a `subscription.invoice.created` event is published, an `AutoPayHandler` subscribes to it and attempts to process payment using the client's saved payment method (or a default method). This closes the loop between invoice generation and payment collection.

**What exists:**
- `PaymentRepositoryPort` — `create()`, `findByInvoiceId()`, `findById()` — wired into `ProcessPaymentUseCase` and `ProcessPaymentWebhookUseCase`
- `ProcessPaymentUseCase` — processes PIX payments, creates Payment record
- `ProcessPaymentWebhookUseCase` — handles webhook confirmations, updates Payment record
- `EventBusPort` — publish/subscribe pattern, `payment.confirmed` event triggers 3 handlers
- Domain events: `subscription.invoice.created` (from A.1)
- `InvoiceRepositoryPort` — `findById()`, `update()`, `create()`
- `PaymentGatewayPort` — `createPixCharge()` (implemented by AsaasPaymentGateway)
- **No** `AutoPayHandler` event handler
- **No** saved payment methods per client/subscription
- **No** auto-pay flow that ties invoice creation → payment processing

**What's needed:**

#### 3A: AutoPayHandler

```typescript
// application/events/handlers/auto-pay.handler.ts
export class AutoPayHandler {
  constructor(
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly renewSubscriptionUseCase: RenewSubscriptionUseCase,
    private readonly invoiceRepo: InvoiceRepositoryPort,
  ) {}

  async handle(event: DomainEvent): Promise<void>;
}
```

**Flow:**
1. Receive `subscription.invoice.created` event
2. Extract `invoiceId` and `subscriptionId` from event metadata
3. Fetch invoice via `invoiceRepo.findById(invoiceId, tenantId)` → if not found, log and return
4. Check if auto-pay is applicable:
   - Invoice must be `PENDING` status
   - Subscription must have a saved payment method (or default to PIX)
   - If no saved payment method, skip (invoice remains PENDING for manual payment)
5. Call `ProcessPaymentUseCase.execute()` with the invoice ID and payment method
6. On success: call `RenewSubscriptionUseCase.execute()` to update nextBilling for the subscription
7. On failure: log error, invoice remains PENDING (manual retry available)
8. Auto-pay is best-effort — failure does not block the invoice from being paid manually later

#### 3B: Register AutoPayHandler in EventBus

```typescript
// presentation/factories/register-event-handlers.ts — add
import { AutoPayHandler } from '@/application/events/handlers/auto-pay.handler';

const autoPay = new AutoPayHandler(
  createProcessPaymentUseCase(),
  createRenewSubscriptionUseCase(),
  invoiceRepo,
);
eventBus.subscribe('subscription.invoice.created', (e) => autoPay.handle(e));
```

#### 3C: Wire PaymentRepository in Recurring Flow

Ensure that `ProcessPaymentUseCase` (when called from auto-pay) records a `Payment` record correctly:

- The auto-pay flow calls `ProcessPaymentUseCase.execute()` which already creates a `Payment` record with status `PENDING` (from Sprint 6)
- When `PAYMENT_CONFIRMED` webhook arrives, `ProcessPaymentWebhookUseCase` updates the Payment record to `CONFIRMED`
- The existing `payment.confirmed` event handlers (SendReceipt, UpdateRiskScore, NotifyOutbound) fire automatically

No additional wiring needed — this is already correct from Sprint 6. The key change is triggering it from the event.

#### 3D: Payment Method on Subscription (Lightweight Approach)

For Sprint 7, use a simplified approach:
- Add optional `paymentMethod` and `savedPaymentProviderId` fields to the Subscription or use Tenant default
- Auto-pay uses the tenant's default payment provider (configured in `Tenant.paymentProvider`)
- If no payment method is saved on the subscription, auto-pay defaults to PIX and skips if PIX can't be auto-generated

**Deferred**: Full saved payment method management (card-on-file, payment tokens) — Sprint 8+.

### Design Patterns

- **Observer Pattern / Domain Events**: `AutoPayHandler` is a domain event handler subscribed to `subscription.invoice.created`. It never modifies the use case — it's a pure side effect
- **Strategy Pattern**: Payment processing uses the existing `PaymentGatewayPort` — auto-pay doesn't care which provider
- **Chain of Responsibility**: Event → AutoPayHandler → ProcessPaymentUseCase → PaymentGateway → Payment record. Each step is testable independently

### Edges & Deferred Scope

| Aspect | In Scope (Sprint 7) | Deferred |
|--------|---------------------|----------|
| Auto-pay via PIX (tenant default provider) | ✅ | — |
| Auto-renew after successful payment | ✅ | — |
| Saved payment methods per subscription | — | Sprint 8 |
| Card-on-file / payment tokens | — | Sprint 8 |
| Payment method selection UI | — | Sprint 8 |
| Partial auto-pay (some invoices, not all) | — | Sprint 8 |

### Acceptance Criteria

- [ ] `AutoPayHandler` subscribes to `subscription.invoice.created` event
- [ ] Handler calls `ProcessPaymentUseCase.execute()` for the invoice
- [ ] Handler calls `RenewSubscriptionUseCase.execute()` on successful payment
- [ ] Auto-pay is best-effort: failure is logged, invoice remains PENDING
- [ ] Auto-pay skips invoices that are already PAID or CANCELLED
- [ ] Auto-pay skips subscriptions without a saved payment method (graceful skip, not error)
- [ ] `AutoPayHandler` registered in `registerEventHandlers()`
- [ ] Unit tests: auto-pay success, auto-pay skipped (no payment method), auto-pay skipped (invoice already paid), auto-pay failure (payment fails, invoice stays PENDING)
- [ ] All existing tests continue to pass
- [ ] Zero new Dependency Rule violations

---

## Item A.4: Integration Test (🟡 Medium, 1d)

**Effort**: 1 day  
**Theme**: Quality  
**Blocking**: None  
**Dependencies**: A.1, A.2, A.3 (all must be implemented)

### Description

Write end-to-end integration tests for the complete recurring billing flow: create subscription → recurring invoice generated → auto-pay processes payment → payment webhook confirms → events fire. Also test idempotency and error scenarios.

**What exists:**
- Existing e2e tests in `__tests__/e2e/` (client-flow, invoice-flow, health, reports, security) — running in CI
- Existing EventBus integration tests in `__tests__/events/` — covering publish→handlers, error isolation
- Existing use case unit tests
- Test setup in `__tests__/setup.ts` — Prisma, InMemoryEventBus, etc.

**What's needed:**

#### 4A: Recurring Billing E2E Test

```typescript
// __tests__/e2e/recurring-billing.e2e.test.ts
```

**Test scenarios:**

| # | Scenario | Description | Verification |
|---|----------|-------------|-------------|
| 1 | **Happy path: subscription → invoice generated → auto-pay → webhook → events** | Create subscription, run recurring invoice worker, verify invoice created, auto-pay processes, webhook confirms, events fire | Invoice in DB with subscriptionId, Payment record with CONFIRMED, `payment.confirmed` event published |
| 2 | **Idempotency: worker runs twice** | Run recurring invoice worker twice | No duplicate invoices created, second run is no-op |
| 3 | **Skip expired subscriptions** | Subscription with endDate < today is not billed | No invoice created for expired subscription |
| 4 | **Skip paused subscriptions** | Subscription with PAUSED status is not billed | No invoice created for paused subscription |
| 5 | **Auto-pay skips if no payment method** | Subscription without saved payment method gets invoice created but no auto-pay | Invoice created, Payment record not created (invoice remains PENDING) |
| 6 | **Renewal after auto-pay** | After auto-pay success, nextBilling is updated | Subscription `nextBilling` advances to next period |

**Test infrastructure:**

```typescript
// Use real Prisma client with test database
// Use InMemoryEventBus for event verification
// Use real subscription repository and invoice repository
// Mock PaymentGatewayPort for deterministic payment simulation
```

**Idempotency test pattern:**

```typescript
it('does not create duplicate invoices on second worker run', async () => {
  // Arrange: create subscription with nextBilling = yesterday
  const subscription = await createTestSubscription({ /* ... */ });

  // Act: first run
  const worker = createRecurringInvoiceWorker(/* ... */);
  await worker.processNow();  // force immediate processing

  // Assert: 1 invoice created
  const invoicesAfterFirstRun = await invoiceRepo.findBySubscriptionId(subscription.id);
  expect(invoicesAfterFirstRun).toHaveLength(1);

  // Act: second run (same subscriptions, no new invoices should be generated)
  await worker.processNow();

  // Assert: still 1 invoice (no duplicate)
  const invoicesAfterSecondRun = await invoiceRepo.findBySubscriptionId(subscription.id);
  expect(invoicesAfterSecondRun).toHaveLength(1);
  expect(invoicesAfterSecondRun[0].amount).toBe(subscription.amount);
});
```

**Event verification pattern:**

```typescript
it('fires subscription.invoice.created event when invoice is generated', async () => {
  const events: DomainEvent[] = [];
  eventBus.subscribe('subscription.invoice.created', (e) => { events.push(e); });

  // ... execute worker ...

  expect(events).toHaveLength(1);
  expect(events[0].eventType).toBe('subscription.invoice.created');
  expect(events[0].metadata.subscriptionId).toBe(subscription.id);
});
```

#### 4B: Test Organization

- New test file: `__tests__/e2e/recurring-billing.e2e.test.ts`
- Use existing `__tests__/setup.ts` for shared test infrastructure
- Follow the same patterns as existing e2e tests (client-flow, invoice-flow)

### Acceptance Criteria

- [ ] Test: full happy path (subscription → invoice → payment → webhook → events) passes
- [ ] Test: idempotency — second worker run does not create duplicate invoices
- [ ] Test: expired subscriptions are skipped by the worker
- [ ] Test: paused subscriptions are skipped by the worker
- [ ] Test: auto-pay skips when no payment method is saved (invoice stays PENDING)
- [ ] Test: `nextBilling` advances after auto-pay + renewal
- [ ] Tests use real Prisma client + InMemoryEventBus (no mocked infrastructure for core flows)
- [ ] Tests clean up after themselves (delete created subscriptions, invoices, payments)
- [ ] All existing tests continue to pass (~750 backend + ~204 frontend)
- [ ] CI job includes the new integration tests

---

## Parallel Work Streams

### Stream Diagram

```
Week 1 (Aug 6 - Aug 13):
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Day 1-2 (Aug 6-7):                                                                           │
│   A.1: Invoice Generator Worker (1.5d) ─────────────────────────────                          │
│                                                                                               │
│ Day 2-3 (Aug 7-8):                                                                           │
│   A.1 done → A.2: Subscription Lifecycle (1d) ──────────────                                 │
│                                                                                               │
│ Day 3-4 (Aug 8-9):                                                                           │
│   A.2 done → A.3: Payment Repo + Auto-Pay (1d) ─────────────                                 │
│                                                                                               │
│ Day 4-5 (Aug 9-10):                                                                          │
│   A.3 done → A.4: Integration Test (1d) ──────────────────────                               │
│                                                                                               │
│ Day 5-7 (Aug 10-13):                                                                         │
│   Buffer: Review, bug fixes, TypeScript check, release prep                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Parallelism Rationale

| Stream | Items | Total Effort | Dependency |
|--------|-------|-------------|------------|
| **Stream A (Recurring Billing)** | A.1 → A.2 → A.3 → A.4 | 4.5 days | Fully sequential — each item depends on the previous |

**No parallel streams** for the core items because each item produces contracts consumed by the next:
- A.1 creates `subscription.invoice.created` event → A.2 consumes it for renewal → A.3 auto-pay subscribes to it → A.4 tests the whole chain

### Critical Path

**A.1 (1.5d) → A.2 (1d) → A.3 (1d) → A.4 (1d) = 4.5 calendar days**

Total calendar time: 4.5 days (fits within 1-week sprint with 2.5-day buffer for review, fixes, and release).

---

## Effort Summary Table

| Item | Description | Days | Theme | Depends On | Blocks |
|------|-------------|------|-------|------------|--------|
| A.1 | **BullMQ Invoice Generator Worker** | 1.5 | Core Feature | — | A.2 |
| A.2 | **Subscription Lifecycle** | 1.0 | Core Feature | A.1 | A.3 |
| A.3 | **Payment Repo + Auto-Pay** | 1.0 | Core Feature | A.1, A.2 | A.4 |
| A.4 | **Integration Test** | 1.0 | Quality | A.1, A.2, A.3 | — |
| | **Total** | **4.5 days** | | | |

### Effort Distribution by Theme

| Theme | Items | Total Days |
|-------|-------|-----------|
| Core Feature | A.1, A.2, A.3 | 3.5 days |
| Quality | A.4 | 1.0 day |

### Sprint Capacity

- **Total effort**: 4.5 days
- **Sprint duration**: 1 week (5 working days)
- **Team size**: Single sequential stream (no parallelism possible for core items)
- **Calendar time**: A.1 (1.5d) + A.2 (1d) + A.3 (1d) + A.4 (1d) = 4.5 days
- **Feasibility**: ✅ Fits within 1-week sprint with 2.5-day buffer for review, fixes, and release

### Trade-offs

| If | Then |
|----|------|
| A.1 (Invoice Generator) overruns beyond 1.5 days | Defer pause/resume from A.2; deliver expire + renew only. Pause/resume not blocking for auto-pay |
| A.3 (Auto-Pay) overruns beyond 1 day | Defer auto-renew integration; auto-pay creates Payment record but manual renewal is acceptable for v0.7 |
| A.4 (Integration Tests) overruns beyond 1 day | Cut idempotency and skipped-scenario tests; deliver only the happy path E2E test |
| CI/Regression issues surface | Cut A.4 scope — A.1→A.3 are the core deliverables; integration tests can be added in Sprint 8 |

---

## Risk Register

### 🔴 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Recurring invoice worker generates duplicate invoices if run multiple times before `nextBilling` is updated | Medium | High | Idempotency guard in `CreateInvoiceForSubscriptionUseCase`: check no invoice exists for sub + reference month before creating. Add unique constraint on `(subscriptionId, referenceMonth)` at DB level |
| BullMQ repeatable job may not trigger on schedule in development environments without Redis persistence | Medium | Medium | Document that local dev requires Redis running. Worker should expose a `processNow()` method for manual/test triggering |
| Auto-pay calls `ProcessPaymentUseCase` which creates a real PIX charge via Asaas — integration tests may incur real costs or hit rate limits | Medium | High | Use mocked/in-memory `PaymentGatewayPort` in integration tests. Production auto-pay goes through real gateway. Document that manual QA should use sandbox API keys |

### 🟡 Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Subscription lifecycle state machine may have edge cases (e.g., renewing an expired subscription should fail, but what about renewing a paused subscription?) | Medium | Medium | Define explicit state machine in domain entity with validation at each transition. Write unit tests for all 16 possible transitions (4 states × 4 actions) |
| `CalculateNextBilling` logic extracted to shared service may behave differently for edge dates (month-end, leap year) | Medium | Medium | Use `date-fns` or well-tested date arithmetic library. Write property-based tests for date calculations (end-of-month, Feb 29, etc.) |
| Auto-pay failing silently (best-effort design) may mask payment failures that need attention | Medium | Medium | Log all auto-pay failures with structured logging. Add a monitoring metric for auto-pay failure rate. Document in the dashboard (future sprint) |
| E2E integration test may be slow (involves Prisma, BullMQ, EventBus) and flaky in CI | Medium | Medium | Use in-memory EventBus and in-memory queue for integration tests. Set timeout appropriately (30s). Run as part of CI but not blocking the full pipeline |

### 🟢 Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `findActiveByNextBillingBefore` query may be slow on large datasets without index | Low | Medium | Add Prisma index on `(status, nextBilling)` — composite index covers the worker query |
| Renewal after auto-pay may race with manual payment if both happen simultaneously | Low | Low | Idempotency guard: renewal checks that nextBilling has not been updated since the subscription was fetched (optimistic locking or re-query inside UoW) |
| Queue definitions file grows large with the new `RECURRING_INVOICE` queue | Low | Low | Acceptable growth. The file is well-structured with Zod schemas for each payload type |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] **A.1**: `CreateInvoiceForSubscriptionUseCase` + `RecurringInvoiceWorker` (BullMQ daily repeatable) + `subscription.invoice.created` domain event + worker wired into `index.ts` + tests
- [ ] **A.2**: `ExpireSubscriptionUseCase`, `RenewSubscriptionUseCase`, `PauseSubscriptionUseCase` (with resume) + `subscription.renewed`/`subscription.paused` events + routes + tests
- [ ] **A.3**: `AutoPayHandler` subscribed to `subscription.invoice.created` + calls `ProcessPaymentUseCase` + calls `RenewSubscriptionUseCase` on success + tests
- [ ] **A.4**: End-to-end integration test covering full recurring billing flow + idempotency + edge cases (expired/paused skip, no auto-pay)

### Quality Gates

- [ ] `tsc --noEmit` passes on both apps (backend + frontend)
- [ ] All existing backend tests (~750) still pass
- [ ] All existing frontend tests (~204) still pass
- [ ] All new tests (A.1-A.4) pass
- [ ] No `console.log` or debugging artifacts in production code
- [ ] No hardcoded secrets, URLs, or environment-specific values
- [ ] All new use cases have ≥80% line coverage

### Architecture Checks

- [ ] `UnitOfWorkPort` is injected into write use cases (CreateInvoiceForSubscription, Expire, Renew, Pause)
- [ ] `SubscriptionRepositoryPort.findActiveByNextBillingBefore()` is the only query used by the worker — no raw Prisma queries in application layer
- [ ] `AutoPayHandler` is a domain event handler — never called directly from the use case
- [ ] `CreateInvoiceForSubscriptionUseCase` does not call payment logic directly — it publishes an event
- [ ] Zero new global singletons (all dependencies injected via factories)
- [ ] No infrastructure imports in application layer
- [ ] Tenant isolation verified: subscriptions from tenant A not billed to tenant B
- [ ] `calculateNextBilling()` is extracted to a shared domain service, not duplicated

### Release

- [ ] Tag `v0.7.0` created
- [ ] Release notes written (Sprint 7 summary — recurring billing completed)
- [ ] Prisma migrations committed (referenceMonth on Invoice, indices on subscription.status+nextBilling)
- [ ] `.env.example` updated with any new environment variables (`RECURRING_INVOICE_CRON`)
- [ ] All new specs committed to `specs/` directory

---

## Artifact Checklist

| Item | Artifacts |
|------|-----------|
| **A.1** | `application/usecases/create-invoice-for-subscription.usecase.ts`, `application/ports/repositories/subscription.repository.port.ts` (updated with `findActiveByNextBillingBefore`), `infrastructure/database/repositories/subscription.repository.ts` (updated), `infrastructure/queue/recurring-invoice.worker.ts`, `infrastructure/queue/queue-definitions.ts` (updated with `RECURRING_INVOICE`), `presenation/factories/create-recurring-invoice.factory.ts`, `domain/events/domain-events.ts` (updated with `subscription.invoice.created`), updated `index.ts` (wire worker), Prisma migration (EventType enum update), test files |
| **A.2** | `domain/services/billing-cycle.service.ts` (extracted `calculateNextBilling`), `application/usecases/expire-subscription.usecase.ts`, `application/usecases/renew-subscription.usecase.ts`, `application/usecases/pause-subscription.usecase.ts` (with resume), updated `routes/subscription.routes.ts` (PATCH endpoints), factories for all 4 use cases, updated `domain/events/domain-events.ts` (add `subscription.renewed`, `subscription.paused`), updated `CreateSubscriptionUseCase` (use shared `calculateNextBilling`), test files |
| **A.3** | `application/events/handlers/auto-pay.handler.ts`, updated `presentation/factories/register-event-handlers.ts` (register AutoPayHandler), test files |
| **A.4** | `__tests__/e2e/recurring-billing.e2e.test.ts` (or equivalent) covering happy path, idempotency, skipped scenarios, renewal |

---

## Release v0.7.0 Checklist

### Pre-Release

- [ ] All items merged to `main`
- [ ] Full test suite passes: `npm test` (backend + frontend)
- [ ] `npm run build` succeeds on both apps
- [ ] `tsc --noEmit` passes on all workspaces
- [ ] Zero Dependency Rule violations confirmed
- [ ] Prisma migrations up-to-date and committed
- [ ] `.env.example` committed with `RECURRING_INVOICE_CRON` (if added)
- [ ] E2E tests pass locally (or known-failure documented)

### Release

- [ ] Tag `v0.7.0` created
- [ ] Release notes written (Sprint 7 summary — recurring billing module completed)
- [ ] GitHub release with changelog

---

## Sprint 7 Specs to Generate

Beyond this plan, the following SDD specs should be created for the new features:

| Spec | Domain | Priority |
|------|--------|----------|
| `specs/recurring-invoice-generator.spec.md` | `CreateInvoiceForSubscriptionUseCase` + worker | High (before A.1 implementation) |
| `specs/subscription-lifecycle.spec.md` | Expire, Renew, Pause use cases | High (before A.2 implementation) |
| `specs/auto-pay-handler.spec.md` | AutoPayHandler + event wiring | Medium (before A.3 implementation) |

---

*Plan prepared by: Architect Agent*  
*Date: 2026-08-06*  
*Related documents: `docs/sprint-6-plan.md`, `docs/sprint-6.1-plan.md`, `docs/review-cto.md`, `specs/*`*
