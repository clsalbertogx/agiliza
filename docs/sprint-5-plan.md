# Sprint 5 Plan — Payment Pipeline, Decision Engine & Frontend Quality

**Theme**: Payment Pipeline Completion & Frontend Quality Gates  
**Period**: 2026-07-30 to 2026-08-06 (1 week)  
**Target Release**: `v0.5.0`

---

## Pre-Sprint Context

Sprint 4 delivered **7 items** — Read Use Cases (ListClients, GetClient, ListInvoices, GetInvoice, GetInvoiceStats), WebhookVerifierPort Extraction, Active E2E CI Job, Unit of Work Pattern, Service Tests (Onboarding + Reminder), Frontend E2E Test Improvements. The codebase now has **~190 backend source files**, **13 Port interfaces**, **8 use cases**, **60 backend test files**, **zero Dependency Rule violations**, and a fully active CI pipeline with E2E enforcement.

Three critical architecture gaps remain from Sprint 4 (identified in the handoff as Gaps A, B, C):

| Gap | Sprint 5 Item | Priority |
|-----|---------------|----------|
| `POST /api/invoices/:id/pay` contains inline PIX payment logic — no use case, no transaction boundary, no testability | **Item 1** | 🔴 High |
| `GetNextDecisionUseCase` creates hardcoded mock Client/Invoice entities instead of querying real repositories | **Item 2** | 🔴 High |
| Webhook route `POST /api/webhooks/payment/:provider` only validates signature and logs — never processes payment events | **Item 3** | 🔴 High |

Additionally, four medium-priority gaps address frontend quality, queue infrastructure, developer experience, and type safety:

| Gap | Sprint 5 Item | Priority |
|-----|---------------|----------|
| 20 of 23 frontend components have zero tests | **Item 4** | 🟡 Medium |
| BullMQ queue definitions exist but no worker process consumes jobs | **Item 5** | 🟡 Medium |
| Onboarding/Reminder services require manual HTTP triggers — no auto-trigger on client creation or daily cron | **Item 6** | 🟡 Medium |
| Frontend TypeScript may fail on test files due to `vitest globals` type issue | **Item 7** | 🟡 Medium |
| No convenient local script to run E2E tests (manual Docker + backend + Playwright steps) | **Item 8** | 🟡 Medium |

---

## Sprint Goal

Complete the payment processing pipeline (use case + webhook), connect the decision engine to real data, and substantially expand frontend test coverage to build confidence for production deployment. Medium items (queue worker, auto-triggers, TS fix, E2E script) are conditional on headroom after the four high-priority items.

---

## Dependency Graph

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ Item 1: Process  │  │ Item 2: Decision │  │ Item 4: Frontend     │
│ PaymentUseCase   │  │ Engine (real)    │  │ Component Tests      │
│ 1.5d             │  │ 2d               │  │ 2d                   │
└────────┬─────────┘  └────────┬─────────┘  └──────────────────────┘
         │                     │
         ▼                     │
┌──────────────────┐           │
│ Item 3: Webhook  │◄──────────┘ 
│ Payment Process  │  (both touch
│ 2d               │   payment flows)
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ (Medium Items — conditional on 🔴 items completed)       │
├──────────────────┬──────────────────┬────────────────────┤
│ Item 5: BullMQ   │ Item 6: Onboard  │ Item 7: Frontend   │
│ Worker (1d)      │ Auto-Trigger     │ TS Fix (0.5d)      │
│                  │ (0.5d)           │                    │
├──────────────────┴──────────────────┴────────────────────┤
│ Item 8: E2E Local Setup Script (0.5d)                    │
└──────────────────────────────────────────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| Item 1 → Item 3 | Webhook processing reuses the payment repository, `Payment` entity, and payment gateway patterns established in Item 1 |
| Item 2 → Item 3 | Both touch the payment domain model (invoices, payments); doing Item 2 first clarifies the shared contracts |
| Item 3 → Items 5-8 | Medium items only start after all 🔴 items are complete (sprint capacity constraint) |

---

## Item 1: ProcessPaymentUseCase (🔴 High, 1.5d)

**Effort**: 1.5 days  
**Theme**: Architecture  
**Blocking**: Item 3  
**Dependencies**: None  

### Description

Extract the inline PIX payment logic from `invoice.routes.ts` (lines 103-155) into a proper use case with transaction boundary, typed input/output with `Either` monad, and comprehensive error handling.

**What exists:**
- `POST /api/invoices/:id/pay` in `routes/invoice.routes.ts` with inline logic that calls `invoiceRepo.findByIdRaw()`, `createPaymentProvider()`, and `invoiceRepo.updateRaw()` directly
- `PaymentGatewayPort` defined in `application/ports/gateways/` — implemented by `AsaasPaymentGateway`
- `InvoiceRepositoryPort` with `findById()`, `update()` methods
- `EventBusPort` with `publish()` method
- `UnitOfWorkPort` with `beginTransaction()` (implemented by `PrismaUnitOfWork`)
- `Payment` domain entity exists in `domain/entities/payment.ts`
- `PaymentMapper` exists in `infrastructure/database/mappers/` (may be orphaned)
- **No** `PaymentRepositoryPort` — payments are not persisted to database

**What's needed:**

#### 1A: PaymentRepositoryPort (new)

```typescript
// application/ports/repositories/payment.repository.port.ts
export interface PaymentRepositoryPort {
  create(payment: Payment): Promise<Payment>;
  findByInvoiceId(invoiceId: string): Promise<Payment[]>;
  findById(paymentId: string): Promise<Payment | null>;
}
```

If no `payment` table exists in Prisma schema, a database migration must be created (or confirmed that the schema matches `PaymentMapper`'s `toPersistence()` shape).

#### 1B: ProcessPaymentUseCase

```typescript
// application/usecases/process-payment.usecase.ts
import { Either } from '@/application/types/either';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { PaymentGatewayPort } from '@/application/ports/gateways/payment-gateway.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { UnitOfWorkPort } from '@/application/ports/adapters/unit-of-work.port';
import { InvoiceNotFoundError, InvoiceAlreadyPaidError, PaymentGatewayError } from '@/application/errors';

export interface ProcessPaymentInput {
  invoiceId: string;
  tenantId: string;
  paymentMethod: 'PIX';  // extensible for BOLETO/CREDIT_CARD later
}

export interface ProcessPaymentOutput {
  status: 'PENDING';
  pix: {
    qrCode: string;
    copyPaste: string;
    expiresAt: Date;
  };
}

export type ProcessPaymentError =
  | InstanceType<typeof InvoiceNotFoundError>
  | InstanceType<typeof InvoiceAlreadyPaidError>
  | InstanceType<typeof PaymentGatewayError>;

export class ProcessPaymentUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly paymentRepo: PaymentRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly eventBus: EventBusPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: ProcessPaymentInput): Promise<Either<ProcessPaymentError, ProcessPaymentOutput>>;
}
```

#### 1C: Route Refactoring

- `POST /api/invoices/:id/pay` delegates to `ProcessPaymentUseCase` via factory
- Remove inline payment logic from `invoice.routes.ts`
- Map use case errors to HTTP status codes via the error handler

#### 1D: Factory

```typescript
// presentation/factories/create-process-payment.factory.ts
export function createProcessPaymentFactory(): ProcessPaymentUseCase;
```

### Design Patterns

- **Strategy Pattern**: `PaymentGatewayPort` allows interchangeable payment providers (Asaas, MercadoPago, PagBank, Polar). Current default: Asaas via `PAYMENT_PROVIDER` env var.
- **Unit of Work**: Wraps PIX charge creation + invoice update + payment record creation in atomic Prisma transaction.

### Acceptance Criteria

- [ ] `ProcessPaymentUseCase` exists in `application/usecases/` with typed `ProcessPaymentInput`/`ProcessPaymentOutput` interfaces
- [ ] Use case returns `Either<ProcessPaymentError, ProcessPaymentOutput>` — typed errors for invoice-not-found, already-paid, provider-error
- [ ] `PaymentRepositoryPort` created in `application/ports/repositories/` with `create()`, `findByInvoiceId()`, `findById()` methods
- [ ] `Payment` entity/record persisted in database via repository (Prisma migration created/confirmed)
- [ ] `POST /api/invoices/:id/pay` route handler delegates to `ProcessPaymentUseCase` (not inline logic)
- [ ] `UnitOfWorkPort.beginTransaction()` wraps the entire payment flow atomically
- [ ] On success, `payment.confirmed` event is published to `EventBusPort` (with PIX metadata)
- [ ] No orphaned PIX charges if invoice update fails (transaction rollback)
- [ ] Factory singleton created in `presentation/factories/`
- [ ] Unit tests: success path, invoice not found, already paid, provider error, transaction rollback on failure
- [ ] All existing tests continue to pass
- [ ] Zero new Dependency Rule violations

---

## Item 2: Real Decision Engine (🔴 High, 2d)

**Effort**: 2 days  
**Theme**: Architecture  
**Blocking**: Item 3 (light — shared domain model clarity)  
**Dependencies**: None  

### Description

Refactor `GetNextDecisionUseCase` to fetch real `Client` and `Invoice` entities from repositories instead of creating hardcoded mock data inline. The `DecisionEngineService` (which computes the next action based on client preferences and invoice state) is already well-tested — the only change is the use case wiring.

**What exists:**
- `GetNextDecisionUseCase` in `application/usecases/get-next-decision.usecase.ts` with hardcoded `createClient()` and `createInvoice()` calls
- `DecisionEngineService` in `application/services/decision-engine.service.ts` — well-tested, computes `DecisionAction` based on real domain entities
- `ClientRepositoryPort` with `findById()` method
- `InvoiceRepositoryPort` with `findById()` method
- `DecisionEngineService` decides: send reminder, send invoice, contact support, wait

**Current code (MVP-only):**
```typescript
// get-next-decision.usecase.ts — MOCK DATA
const clientResult = createClient({
  id: input.clientId, tenantId: '00000000-...',
  name: 'Cliente', phone: '5511999999999',
  preferredChannel: MessageChannel.WHATSAPP, preferredLeadDays: 3,
});
const invoiceResult = createInvoice({ ... hardcoded defaults ... });
return this.decisionEngine.decideNextAction(clientResult.value, invoiceResult.value, 'default');
```

**Desired code:**
```typescript
// get-next-decision.usecase.ts — REAL DATA
const client = await this.clientRepo.findById(input.clientId, input.tenantId);
if (!client) return failure(new NotFoundError('Client not found'));

const invoice = await this.invoiceRepo.findById(input.invoiceId, input.tenantId);
if (!invoice) return failure(new NotFoundError('Invoice not found'));

return success(this.decisionEngine.decideNextAction(client, invoice, input.tenantId));
```

### Updated Contract

```typescript
// application/usecases/get-next-decision.usecase.ts
export interface GetNextDecisionInput {
  tenantId: string;
  clientId: string;
  invoiceId: string;
}

export interface GetNextDecisionOutput {
  action: DecisionAction;      // SEND_REMINDER | SEND_INVOICE | CONTACT_SUPPORT | WAIT
  channel: MessageChannel;      // WHATSAPP | EMAIL | SMS
  templateName: string;         // e.g., 'payment_reminder', 'invoice_due'
  scheduledAt: Date;            // when the action should execute
}

export class GetNextDecisionUseCase {
  constructor(
    private readonly clientRepo: ClientRepositoryPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly decisionEngine: DecisionEngineService,
  ) {}

  async execute(input: GetNextDecisionInput): Promise<Either<ApplicationError, GetNextDecisionOutput>>;
}
```

### Route Changes

- `GET /api/decisions/next-action` currently passes `input.clientId` and `input.invoiceId` from query params
- Ensure `tenantId` is extracted from authenticated JWT (not hardcoded)
- Map `NotFoundError` to 404 in error handler (may already work generically)

### Acceptance Criteria

- [ ] `GetNextDecisionUseCase` constructor accepts `ClientRepositoryPort` and `InvoiceRepositoryPort` alongside `DecisionEngineService`
- [ ] Use case fetches real client and invoice from repositories by `clientId` and `invoiceId`
- [ ] Returns `NotFoundError` when client or invoice does not exist
- [ ] `GET /api/decisions/next-action` route passes `tenantId` from authenticated JWT (not hardcoded)
- [ ] Unit tests: success with real data, client not found, invoice not found, tenant isolation (client/invoice belong to different tenants)
- [ ] Edge cases: client exists but invoice is already paid (decision engine should handle), overdue invoice, cancelled invoice
- [ ] All existing `DecisionEngineService` tests continue to pass (no changes to the service itself)
- [ ] All existing routes tests continue to pass
- [ ] Factory updated to inject real repositories
- [ ] Zero new Dependency Rule violations

---

## Item 3: Webhook Payment Processing (🔴 High, 2d)

**Effort**: 2 days  
**Theme**: Architecture  
**Blocking**: Items 5, 6 (indirect — medium items wait for 🔴 items)  
**Dependencies**: Item 1 (PaymentRepositoryPort + Payment entity), Item 2 (shared payment domain clarity)

### Description

Replace the `console.log` in `POST /api/webhooks/payment/:provider` with real payment event processing. When Asaas sends a `PAYMENT_CONFIRMED` webhook, the system must update the invoice status to `PAID`, create a payment record, and publish domain events so downstream handlers (SendReceipt, UpdateRiskScore, NotifyOutbound) execute.

**What exists:**
- `POST /api/webhooks/payment/:provider` in `routes/webhook.routes.ts` (lines 27-85) — validates HMAC signature, logs payload, returns 200
- `WebhookVerifierPort` implemented by `PerTenantHmacVerifier` — signature validation works
- `InvoiceRepositoryPort` with `findById()`, `update()` methods
- `EventBusPort` with `publish()` method
- `UnitOfWorkPort` with `beginTransaction()` method
- Event handlers already subscribed: `SendReceipt` (on `payment.confirmed`), `UpdateRiskScore` (on `payment.confirmed`, `payment.failed`)
- **Missing** from Item 1: `PaymentRepositoryPort` and payment persistence

**What's needed:**

#### 3A: ProcessPaymentWebhookUseCase

```typescript
// application/usecases/process-payment-webhook.usecase.ts
import { Either } from '@/application/types/either';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { UnitOfWorkPort } from '@/application/ports/adapters/unit-of-work.port';
import { ApplicationError } from '@/application/errors';

export type PaymentWebhookEventType =
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_RECEIVED';

export interface ProcessPaymentWebhookInput {
  provider: string;               // 'asaas' | 'mercadopago' | 'pagbank' | 'polar'
  rawBody: string;                // raw JSON string for signature verification
  parsedBody: Record<string, unknown>;  // parsed payload
  tenantId: string;               // extracted from webhook secret lookup
}

export interface ProcessPaymentWebhookOutput {
  received: true;
  eventType: PaymentWebhookEventType;
}

export class ProcessPaymentWebhookUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly paymentRepo: PaymentRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: ProcessPaymentWebhookInput): Promise<Either<ApplicationError, ProcessPaymentWebhookOutput>>;
}
```

#### 3B: Provider Payload Parsers (Strategy Pattern)

Each provider sends different payload shapes. Define a parser interface and implement per-provider:

```typescript
export interface PaymentWebhookParser {
  parseEventType(payload: Record<string, unknown>): PaymentWebhookEventType | null;
  extractTransactionId(payload: Record<string, unknown>): string | null;
  extractInvoiceExternalReference(payload: Record<string, unknown>): string | null;
  extractAmount(payload: Record<string, unknown>): number | null;
  extractMetadata(payload: Record<string, unknown>): Record<string, unknown>;
}

export class AsaasWebhookParser implements PaymentWebhookParser { /* ... */ }
export class MercadoPagoWebhookParser implements PaymentWebhookParser { /* ... */ }
// etc.
```

**Sprint 5 scope**: Implement `AsaasWebhookParser` only. Other providers can be added in separate PRs.

#### 3C: Event Wiring

When `PAYMENT_CONFIRMED` is processed:
1. Publish `payment.confirmed` event via `EventBusPort.publish(DomainEvent)`
2. `SendReceipt` handler fires → sends WhatsApp receipt via Evolution API
3. `UpdateRiskScore` handler fires → recalculates client risk score
4. `NotifyOutbound` handler fires → POSTs event to tenant's outbound webhook (if configured)

#### 3D: Route Changes

- `POST /api/webhooks/payment/:provider` delegates to `ProcessPaymentWebhookUseCase` via factory
- Provider-specific parser selected based on `:provider` param
- Signature verification still happens before use case (in route handler or middleware)
- Unknown/unsupported event types logged but return 200 (no error for the provider)

### Design Patterns

- **Strategy Pattern**: `PaymentWebhookParser` interface with per-provider concrete strategies. Selected by `:provider` route param.
- **Observer Pattern / Domain Events**: `payment.confirmed` event emitted by use case → consumed by `SendReceipt`, `UpdateRiskScore`, `NotifyOutbound` handlers. Never call handlers directly from the use case.

### Acceptance Criteria

- [ ] `ProcessPaymentWebhookUseCase` exists in `application/usecases/` with typed input/output
- [ ] `POST /api/webhooks/payment/:provider` processes `PAYMENT_CONFIRMED` events (invoice → `PAID`, payment record created)
- [ ] `AsaasWebhookParser` implemented and tested for Asaas payload format (other providers out of scope for Sprint 5)
- [ ] Invoice status updated to `PAID` when `PAYMENT_CONFIRMED` received
- [ ] Payment record created with provider transaction ID, amount, fees, timestamp
- [ ] `payment.confirmed` domain event published to `EventBusPort`
- [ ] `SendReceipt` handler sends WhatsApp receipt via Evolution API (integration — existing handler must work)
- [ ] `UpdateRiskScore` handler recalculates risk score (existing handler must work)
- [ ] `UnitOfWorkPort.beginTransaction()` wraps all writes atomically
- [ ] Signature verification continues to work (use case receives already-verified input)
- [ ] Unknown/unsupported event types logged but return 200 (not 500)
- [ ] Factory singleton created in `presentation/factories/`
- [ ] Unit tests: successful webhook, invoice not found, invalid event type, Asaas-specific payload parsing, transaction rollback
- [ ] Contract test: `AsaasWebhookParser` satisfies `PaymentWebhookParser` interface
- [ ] All existing tests continue to pass
- [ ] Zero new Dependency Rule violations

---

## Item 4: Frontend Component Tests (🔴 High, 2d)

**Effort**: 2 days  
**Theme**: Quality  
**Blocking**: None  
**Dependencies**: None  

### Description

Add test coverage for the 20 frontend components that currently have no tests. Currently only 3 of 23 components have tests (`risk-badge`, `kpi-card`, `notification-banner`). Priority order focuses on business-critical components first.

**What exists:**
- Vitest + @testing-library/react + jest-dom configured for frontend
- 3 existing component tests in `apps/frontend/src/__tests__/`
- 15 domain components + 8 UI primitives without tests

**Priority order:**

| Priority | Component | Rationale | Test Cases |
|----------|-----------|-----------|------------|
| P0 | `onboarding-wizard.tsx` | Core business flow, multi-step, stateful | Happy path (complete all steps), error on invalid step, loading state |
| P0 | `pix-payment-flow.tsx` | Payment UX, user-facing critical path | Happy path (QR code display), loading (awaiting QR), error (payment failed) |
| P0 | `invoice-form.tsx` | Complex form with validation | Happy path (valid submission), validation errors (missing fields), loading |
| P1 | `kanban-board.tsx` | Visual pipeline, drag context | Render columns, empty state (no invoices), loading state |
| P1 | `payment-history.tsx` | Transaction history display | Happy path (list payments), empty state (no payments), error state |
| P2 | `client-card.tsx` | Frequently used display | Happy path, loading skeleton, error fallback |
| P2 | `client-detail-card.tsx` | Detail view | Conditional rendering, missing data graceful fallback |
| P2 | Remaining 13 components | Loading skeletons, empty states, error boundaries | At minimum: render without crashing, loading state, empty/error state where applicable |

### Testing Patterns

```typescript
// Example: pix-payment-flow.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PixPaymentFlow } from '@/components/pix-payment-flow';

describe('PixPaymentFlow', () => {
  it('displays QR code after payment is initiated', async () => {
    render(<PixPaymentFlow invoiceId="123" amount={150.00} />);
    expect(screen.getByText(/scan to pay/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('pix-qr-code')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton while fetching QR code', () => {
    render(<PixPaymentFlow invoiceId="123" amount={150.00} />);
    expect(screen.getByTestId('pix-loading-skeleton')).toBeInTheDocument();
  });

  it('displays error message when payment initiation fails', async () => {
    render(<PixPaymentFlow invoiceId="invalid" amount={150.00} />);
    await waitFor(() => {
      expect(screen.getByText(/payment failed/i)).toBeInTheDocument();
    });
  });
});
```

### Acceptance Criteria

- [ ] All 3 P0 components have test coverage (≥3 test cases each) — onboarding-wizard, pix-payment-flow, invoice-form
- [ ] At least 2 P1 components have test coverage (kanban-board, payment-history)
- [ ] At least 2 additional components have test coverage (total ≥7 new test files, minimum 5)
- [ ] Tests cover: happy path, loading state, error state, empty state (where applicable per component)
- [ ] Tests use `@testing-library/react` user-centric queries (`getByRole`, `getByText`, `findByTestId`) — not implementation details like component state
- [ ] All 3 existing frontend tests continue to pass
- [ ] `npm test` passes in `apps/frontend/`

---

## Item 5: Activate BullMQ Worker (🟡 Medium, 1d)

**Effort**: 1 day  
**Theme**: Infrastructure  
**Blocking**: Item 6  
**Dependencies**: Items 1-3 completed (🔴 items done first)

### Description

Create and register a BullMQ worker process that consumes jobs from the queue. Queue definitions exist in `infrastructure/queue/queue-definitions.ts` and `infrastructure/queue/queue-manager.ts` exists, but no process consumes jobs — reminders and onboarding jobs are enqueued but never processed.

**What exists:**
- `infrastructure/queue/queue-definitions.ts` — queue definitions for `reminder` and `onboarding`
- `infrastructure/queue/queue-manager.ts` — BullMQ manager with `addJob()` etc.
- `infrastructure/queue/redis.service.ts` — Redis connection service
- `QueuePort` interface in `application/ports/queue/`
- No worker entry point — no `infrastructure/queue/worker.ts`

### Design Patterns

- **Observer Pattern**: Queue jobs are fire-and-forget consumers — use case publishes to queue, worker consumes independently
- **Strategy Pattern**: `QueuePort` abstracts queue implementation (BullMQ in production, in-memory in tests)

### Acceptance Criteria

- [ ] `infrastructure/queue/worker.ts` exists — connects to Redis, consumes jobs from `reminder` and `onboarding` queues
- [ ] Job processors call appropriate services (`ReminderService.scheduleReminder`, `OnboardingService.startOnboarding`)
- [ ] Failed jobs retry with exponential backoff (max 3 retries)
- [ ] Worker is registered in server bootstrap (`apps/backend/src/index.ts`) as a separate process or thread
- [ ] Worker startup does not block API server startup (separate process recommended)
- [ ] Integration test: enqueue job → worker processes it successfully
- [ ] Existing tests continue to pass

---

## Item 6: Onboarding/Reminder Auto-Trigger (🟡 Medium, 0.5d)

**Effort**: 0.5 day  
**Theme**: Architecture  
**Blocking**: None  
**Dependencies**: Item 5 (queue worker must be active)

### Description

Wire onboarding and reminder services to be automatically triggered instead of requiring manual HTTP calls. Onboarding auto-triggers after `CreateClientUseCase` creates a client without preferences. Reminder auto-triggers via a daily cron/repeatable BullMQ job.

**What exists:**
- `CreateClientUseCase` in `application/usecases/create-client.usecase.ts`
- `OnboardingService` and `ReminderService` in `application/services/` — well-tested from Sprint 4
- `EventBusPort` with handler subscription model

**What's needed:**
1. `CreateClientUseCase` emits `client.created` domain event
2. Event handler listens for `client.created` → enqueues onboarding job (via `QueuePort`) when client has no preferences
3. Daily repeatable BullMQ job scans invoices due in 3 days → enqueues reminder jobs per invoice
4. Queue worker (Item 5) processes both job types

### Acceptance Criteria

- [ ] `CreateClientUseCase` emits `client.created` domain event (event added to domain events)
- [ ] Event handler exists for `client.created` → checks if client has preferences → enqueues onboarding job if not
- [ ] Daily repeatable BullMQ job (or cron) identifies invoices due in 3 days → enqueues reminder jobs
- [ ] Queue worker (Item 5) processes both job types successfully
- [ ] Unit tests: event handler enqueues correctly, cron job identifies correct invoices
- [ ] All existing tests continue to pass

---

## Item 7: Frontend TypeScript Fix (🟡 Medium, 0.5d)

**Effort**: 0.5 day  
**Theme**: Quality  
**Dependencies**: Items 1-3 completed

### Description

Fix the `vitest globals` type issue in frontend `tsconfig.json` that may cause `tsc --noEmit` to fail on test files referencing `describe`, `it`, `expect` without explicit imports.

**What exists:**
- Potential tsconfig issue where `vitest/globals` types are not properly included
- `tsc --noEmit` may fail on test files

**What's needed:**
1. Add `types: ["vitest/globals"]` to frontend `tsconfig.json` (or appropriate `tsconfig.test.json`)
2. Or update test files to import `describe`, `it`, `expect` from `vitest` explicitly
3. Verify `tsc --noEmit` passes in `apps/frontend/`
4. Verify all frontend tests still pass

### Acceptance Criteria

- [ ] `tsc --noEmit` passes on `apps/frontend/` (including test files)
- [ ] All frontend tests continue to pass (3 existing + new ones from Item 4)
- [ ] No type errors in test files referencing `describe`, `it`, `expect`

---

## Item 8: E2E Local Setup Script (🟡 Medium, 0.5d)

**Effort**: 0.5 day  
**Theme**: Developer Experience  
**Dependencies**: Items 1-3 completed

### Description

Create a single npm script that orchestrates the E2E local workflow, replacing the current manual steps:

1. Start Docker Compose (PostgreSQL + Redis)
2. Wait for services to be healthy
3. Start backend with `npx tsx`
4. Wait for health check
5. Run Playwright tests
6. Clean up (stop services)

**What exists:**
- `docker/docker-compose.e2e.yml` — isolated PostgreSQL + Redis
- `e2e/playwright.config.ts` — Playwright configuration
- 5 E2E test specs in `e2e/tests/`

**What's needed:**

```jsonc
// In root package.json or e2e/package.json
{
  "scripts": {
    "e2e:local": "tsx scripts/run-e2e-local.ts"
    // or use a shell script: "e2e:up && e2e:test && e2e:down"
  }
}
```

The script should:
- Detect if Docker is running
- Start `docker compose -f docker/docker-compose.e2e.yml up -d`
- Wait for PostgreSQL + Redis health (poll with 2s interval, 30s timeout)
- Start backend via `npx tsx apps/backend/src/index.ts` with `.env.e2e` config
- Wait for `http://localhost:3333/api/health` (30s timeout)
- Run `npx playwright test` in `e2e/` directory
- On success or failure, stop all background processes and optionally run `docker compose down`
- Exit with same exit code as Playwright

### Acceptance Criteria

- [ ] `npm run e2e:local` (or equivalent) starts infrastructure, backend, and tests with a single command
- [ ] Script handles cleanup on Ctrl+C and test failure
- [ ] Script fails early with clear message if Docker is not running
- [ ] Timeout for service startup (30s) — fails with clear message if exceeded
- [ ] Exit code matches Playwright test result (0 = pass, 1 = fail)
- [ ] All 5 E2E tests pass when run via the script

---

## Parallel Work Streams

### Stream Diagram

```
Week 1 (Jul 30 - Aug 6):
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Day 1-2 (Jul 30-31):                                                             │
│   Stream A (Payment):      #1(1.5d) ──────────────                                │
│   Stream B (Decision):     #2(2d) ───────────────────────────                     │
│   Stream C (Frontend):     #4(2d) ───────────────────────────                     │
│                                                                                   │
│ Day 3-4 (Aug 1-2):                                                                │
│   Stream A (Payment):      #1 done → #3(2d) ─────────────────────                 │
│   Stream B (Decision):     #2 done ✅                                              │
│   Stream C (Frontend):     #4 done ✅                                              │
│                                                                                   │
│ Day 5 (Aug 3):                                                                    │
│   Stream A (Payment):      #3 done ✅                                              │
│   (All 🔴 items complete — gate opens for 🟡 items)                               │
│                                                                                   │
│ Day 5-7 (Aug 3-6):                                                                │
│   Stream D (Medium):       #5(1d) → #6(0.5d) → #7(0.5d) → #8(0.5d) ──           │
│                            (sequential, 2.5d total)                               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Parallelism Rationale

| Stream | Items | Total Effort | Dependency |
|--------|-------|-------------|------------|
| **Stream A (Payment)** | #1 → #3 | 3.5 days | Sequential (Item 1 outputs are inputs to Item 3) |
| **Stream B (Decision)** | #2 | 2 days | Fully parallel with Stream A (no shared files) |
| **Stream C (Frontend)** | #4 | 2 days | Fully parallel with Stream A+B (separate app) |
| **Stream D (Medium)** | #5 → #6 → #7 → #8 | 2.5 days | Sequential, starts after all 🔴 items done |

### Critical Path

#1 (1.5d) → #3 (2d) = **3.5 days**  
Medium items (2.5d) run in remaining sprint time after 🔴 items.

Total calendar time: 7 days (fits within 1-week sprint with 3.5-day buffer for medium items, review, fixes, and release).

---

## Effort Summary Table

| Item | Description | Days | Theme | Depends On | Blocks |
|------|-------------|------|-------|------------|--------|
| 1 | **ProcessPaymentUseCase** | 1.5 | Architecture | — | 3 |
| 2 | **Real Decision Engine** | 2.0 | Architecture | — | — |
| 3 | **Webhook Payment Processing** | 2.0 | Architecture | 1 | — |
| 4 | **Frontend Component Tests** | 2.0 | Quality | — | — |
| | **🔴 Subtotal** | **7.5** | | | |
| 5 | Activate BullMQ Worker | 1.0 | Infrastructure | 1-3 done | 6 |
| 6 | Onboarding/Reminder Auto-Trigger | 0.5 | Architecture | 5 | — |
| 7 | Frontend TypeScript Fix | 0.5 | Quality | 1-3 done | — |
| 8 | E2E Local Setup Script | 0.5 | Dev XP | 1-3 done | — |
| | **🟡 Subtotal** | **2.5** | | | |
| | **Total** | **10.0 days** | | | |

### Effort Distribution by Theme

| Theme | Items | Total Days |
|-------|-------|-----------|
| Architecture | 1, 2, 3, 6 | 6.0 days |
| Quality | 4, 7 | 2.5 days |
| Infrastructure | 5 | 1.0 day |
| Developer Experience | 8 | 0.5 day |

### Sprint Capacity

- **Total effort**: 10 days
- **Sprint duration**: 1 week (5 working days)
- **Team size**: effectively 1-2 parallel streams (Architecture + Frontend can be fully parallel)
- **Feasibility**: 🔴 items (7.5d) fit in 4 calendar days with 2 parallel streams. 🟡 items (2.5d) fill remaining sprint days.

---

## Risk Register

### 🔴 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Webhook processing (Item 3) depends on `PaymentRepositoryPort` from Item 1 — if Item 1 is delayed, Item 3 cannot start | High | High | Design `PaymentRepositoryPort` contract early in Item 1 (day 1); Item 3 team can write tests against the contract before implementation is complete |
| Payment provider webhook payloads vary significantly — Asaas format differs from MercadoPago/PagBank/Polar | Medium | Medium | Start with Asaas-only parsing in Sprint 5 (Item 3); add other providers iteratively in separate PRs |
| No `payment` table in Prisma schema — schema migration needed before Items 1 and 3 can persist data | Medium | High | Audit Prisma schema on sprint day 1; create migration in parallel with use case design |

### 🟡 Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Decision Engine (Item 2) switching from mock to real data may reveal `DecisionEngineService` doesn't handle real-world edge cases (missing risk score, null fields) | Medium | Medium | Write integration tests first with known real data shapes; fix `DecisionEngineService` as needed |
| BullMQ worker (Item 5) process management — if embedded in same Node process as API, worker CPU usage may degrade API response times | Medium | High | Run worker in a separate Node.js process (child process or separate entry point); document decision |
| Frontend component tests (Item 4) may fail or be impossible to write if components lack test IDs or have hard-to-query DOM structure | Medium | Medium | Add `data-testid` attributes during test writing (acceptable); prefer semantic queries first |
| `PaymentMapper` exists in `infrastructure/database/mappers/` but may reference a `payment` table that doesn't exist | Medium | Medium | Audit on sprint day 1; if orphaned, remove or update to match actual schema |
| Items 5-8 are conditional — if 🔴 items overrun, medium items are cut and deferred to Sprint 6 | Medium | Low | Explicit trade-off: 🔴 items are non-negotiable; 🟡 items are "nice to have" |

### 🟢 Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `tsc --noEmit` on frontend test files fails with vitest globals (Item 7) | High | Low | Quick fix — either add types to tsconfig or update imports |
| E2E local script (Item 8) may have port conflicts if dev server is already running | Low | Low | Script should check port availability and fail with clear message |
| Turbo 2.0 `pipeline` → `tasks` rename may cause build warnings | High | Low | Accept warnings; fix in a separate housekeeping PR |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] Item 1: `ProcessPaymentUseCase` implemented, `PaymentRepositoryPort` created, route refactored, tests passing
- [ ] Item 2: `GetNextDecisionUseCase` fetches real data from repositories, route passes tenantId, tests passing
- [ ] Item 3: Webhook route processes `PAYMENT_CONFIRMED`, invoice updated, payment persisted, events published, tests passing
- [ ] Item 4: ≥7 frontend component test files created (covering P0+P1 priorities), tests passing
- [ ] Item 5: BullMQ worker created and processing jobs (if sprint capacity allows)
- [ ] Item 6: Onboarding auto-trigger + reminder daily cron wired (if sprint capacity allows)
- [ ] Item 7: Frontend TypeScript passes `tsc --noEmit` on test files (if sprint capacity allows)
- [ ] Item 8: `npm run e2e:local` script created and working (if sprint capacity allows)

### Quality Gates

- [ ] Zero Dependency Rule violations in backend (automated check or manual review of new files)
- [ ] `tsc --noEmit` passes on both apps (backend + frontend)
- [ ] All existing 60+ backend tests still pass
- [ ] All 3 existing + new frontend tests pass
- [ ] All 5 E2E tests pass in CI
- [ ] No `console.log` or debugging artifacts in production code
- [ ] No hardcoded secrets, URLs, or environment-specific values
- [ ] All new code has ≥80% line coverage (use cases, services)

### Architecture Checks

- [ ] `UnitOfWorkPort` is injected into write use cases (not instantiated inside)
- [ ] `ProcessPaymentUseCase` does not call `PaymentGatewayPort` or repository methods outside the unit of work callback
- [ ] `PaymentGatewayPort` is the only payment provider dependency in application layer (no Asaas-specific code)
- [ ] Webhook processing uses `WebhookVerifierPort` for signature validation (existing)
- [ ] `PaymentWebhookParser` interface abstracts provider-specific payload shapes
- [ ] Decision engine (`GetNextDecisionUseCase`) queries real repositories — no hardcoded mock data
- [ ] Zero new global singletons (all dependencies injected via factories)
- [ ] No infrastructure imports in application layer (verified by grep)

### Release

- [ ] Tag `v0.5.0` created
- [ ] Release notes written (Sprint 5 summary + all delivered items)
- [ ] `.env.example` updated with any new environment variables (payment provider configs, webhook settings)
- [ ] Prisma migrations committed (if payment table was added)
- [ ] All specs committed and pushed

---

## Artifact Checklist

| Item | Artifacts |
|------|-----------|
| 1 | `application/usecases/process-payment.usecase.ts`, `application/ports/repositories/payment.repository.port.ts`, `presentation/factories/create-process-payment.factory.ts`, updated `routes/invoice.routes.ts`, test file, Prisma migration (if needed) |
| 2 | Updated `application/usecases/get-next-decision.usecase.ts`, updated `presentation/factories/create-get-next-decision.factory.ts`, updated `routes/decision.routes.ts`, test file |
| 3 | `application/usecases/process-payment-webhook.usecase.ts`, `application/ports/gateways/payment-webhook-parser.port.ts`, `infrastructure/payment/parsers/asaas-webhook-parser.ts`, `presentation/factories/create-process-payment-webhook.factory.ts`, updated `routes/webhook.routes.ts`, test file |
| 4 | ≥7 new test files in `apps/frontend/src/__tests__/components/` or equivalent |
| 5 | `infrastructure/queue/worker.ts`, worker registration in `index.ts` or separate entry point, integration test |
| 6 | Updated `CreateClientUseCase` (emit `client.created` event), event handler for onboarding auto-trigger, daily cron/repeatable job for reminders, tests |
| 7 | Updated `apps/frontend/tsconfig.json` or test files, `tsc --noEmit` passing |
| 8 | `scripts/run-e2e-local.sh` or `.ts`, `package.json` script entry, `e2e/README.md` update |

---

## Release v0.5.0 Checklist

### Pre-Release

- [ ] All committed items merged to `main`
- [ ] Full test suite passes: `npm test` (backend + frontend)
- [ ] `npm run build` succeeds on both apps
- [ ] E2E CI job passes on a PR against `main`
- [ ] Zero Dependency Rule violations confirmed
- [ ] `.env.example` committed with any new variables

### Release

- [ ] Tag `v0.5.0` created
- [ ] Release notes written (Sprint 5 summary + all delivered items)
- [ ] Prisma migrations committed and up-to-date

---

*Plan prepared by: Architect Agent*  
*Date: 2026-07-30*  
*Related documents: `docs/sprint-4-plan.md`, `docs/sdd.md`, `docs/review-cto.md`, `docs/review-tech-nucleus.md`, `/tmp/handoff-sprint5.md`, `specs/clean-architecture-refactor.spec.md`*
