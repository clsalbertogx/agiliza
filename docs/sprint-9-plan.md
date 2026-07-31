# Sprint 9 Plan — Multi-Provider Payments + Advanced Subscription Features

**Theme**: Multi-Provider Payments + Advanced Subscription Features
**Period**: 2026-08-20 to 2026-08-27 (1 week)
**Target Release**: `v0.9.0`

---

## Pre-Sprint Context

Sprint 8 delivered production readiness: per-tenant encrypted payment provider config (AES-256-GCM), `PaymentProviderConfigRepositoryPort` + `PrismaPaymentProviderConfigRepository`, `Upsert`/`Get` payment provider config use cases, `PUT/GET /api/tenants/:id/payment-config` routes, the Swagger API documentation at `/docs`, Swagger schemas on main endpoints, the frontend `SettingsPage` at `/dashboard/settings`, the tag-triggered CD pipeline to GHCR, fixed CI E2E, and the initial Prisma migration baseline. Tag `v0.8.0` is cut.

**What exists now (after Sprint 8):**

| Capability | Status |
|-----------|--------|
| `PaymentProviderFactory` (static, with switch on provider type) | ✅ Sprint 8 — but only Asaas is implemented; MercadoPago/Stripe throw `Error('not yet implemented')` |
| `AsaasPaymentProvider` (simulated PIX charges) | ✅ Sprint 5 |
| `PaymentGatewayPort` interface (with `Either` return types) | ✅ Sprint 8 |
| `PaymentProviderConfigRepositoryPort` + `EncryptionPort` + AES-256-GCM service | ✅ Sprint 8 |
| Per-tenant `PaymentProviderConfig` — encrypted API keys, `isActive` flag | ✅ Sprint 8 |
| `Subscription` domain entity (ACTIVE/PAUSED/CANCELLED/EXPIRED states) | ✅ Sprint 6 |
| `CreateInvoiceForSubscriptionUseCase` + `RecurringInvoiceWorker` (BullMQ daily) | ✅ Sprint 7 |
| `ExpireSubscriptionUseCase`, `RenewSubscriptionUseCase`, `PauseSubscriptionUseCase`, `ResumeSubscriptionUseCase` | ✅ Sprint 7 |
| `AutoPayHandler` — subscribes to `subscription.invoice.created` → calls `ProcessPaymentUseCase` → calls `RenewSubscriptionUseCase` on success | ✅ Sprint 7 |
| `calculateNextBilling()` domain service | ✅ Sprint 7 |
| `ProcessPaymentWebhookUseCase` — verifies HMAC per tenant, processes confirmed/failed events | ✅ Sprint 6 |
| `webhook.routes.ts` — `POST /api/webhooks/payment/:provider` | ✅ Sprint 5 |
| `ProcessWebhook` queue (`process-webhook`) in BullMQ `QueueNames` | ✅ Sprint 5 |
| Frontend `SettingsPage` with provider selector (asaas, mercadopago, pagbank, polar), apiKey, environment fields | ✅ Sprint 8 |
| `DEFAULT_JOB_OPTIONS` with exponential backoff (3 attempts, 1s base) | ✅ Sprint 5 |
| Dead letter queue | ❌ **Does not exist** |
| Recurring invoice generation is daily only — the worker uses the current system clock but there's no configurable auto-expire job | ⚠️ Exists but was added in Sprint 8 as a daily repeatable job |

**The four gaps this sprint closes:**

| Gap | Sprint 9 Item | Priority |
|-----|---------------|----------|
| `PaymentProviderFactory` has `throw new Error('not yet implemented')` for MercadoPago and Stripe — only Asaas is implemented | **Item 1** | 🔴 High |
| Recurring invoice worker exists but generates invoices using manual PIX charges — upgrade/downgrade with proration doesn't exist | **Item 3** | 🔴 High |
| Webhook processing is synchronous in-request — no retry mechanism for transient failures beyond BullMQ's built-in 3 retries | **Item 4** | 🟡 Medium |
| Frontend settings show MercadoPago but the provider doesn't exist — also provider selector dropdown doesn't show Stripe | **Item 5** | 🟡 Medium |

**Scope change from Sprint 8:** The Stripe provider replaces "PagBank" in the Sprint 9 brief (based on the dependency graph items). The existing `PaymentProvider` enum already includes `STRIPE` alongside `MERCADO_PAGO`. This sprint implements MercadoPago and Stripe specifically.

---

## Sprint Goal

Complete the payment provider abstraction (Strategy Pattern) with MercadoPago and Stripe implementations, add recurring invoice generation changes to support upgrade/downgrade per-subscription plan changes, implement a subscription upgrade/downgrade orchestration with timing approximation (simplified proration through date-based calculation), add webhook retry with exponential backoff and a dead letter queue, and update the frontend provider selector with dynamic fields per provider.

---

## Dependency Graph

```
┌────────────────────────────────────────────────────────────────┐
│ Item 1: Payment Provider Strategy Pattern (2d)                 │
│   - PaymentGatewayPort interface refinement (add Stripe APIs)  │
│   - MercadoPagoGateway + StripeGateway implementations         │
│   - Factory for provider selection per tenant (async resolve)  │
│   - Tests for both providers                                   │
└──────────────────────────┬─────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 3: Subscription Upgrade/Downgrade + Proration (2d)        │
│   - UpgradeSubscriptionUseCase (with proration)                │
│   - DowngradeSubscriptionUseCase (with credit calculation)     │
│   - ProrationService (domain service)                          │
│   - Routes + tests                                             │
└──────────────────────────┬─────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 4: Webhook Retry with Exponential Backoff (1d)            │
│   - WebhookRetryService with exponential backoff               │
│   - BullMQ delayed job for retries (exponential backoff)       │
│   - Dead letter queue (DLQ) + monitoring                       │
└────────────────────────────────────────────────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| Item 1 → Item 3 | MercadoPago and Stripe gateways must exist before upgrade/downgrade can test end-to-end with real providers. `UpgradeSubscriptionUseCase` might trigger a payment or invoice change via the gateway |
| Item 3 → Item 4 | Upgrade/downgrade may trigger webhooks (subscription.changed, payment events). The webhook retry infrastructure must be in place to handle these reliably |
| Item 5 (Frontend) | Starts after Item 1 contracts are stable — the provider selector needs dynamic fields per provider (MercadoPago: access_token, stripe: api_key + webhook_secret) which Item 1 defines |

---

## Parallel Streams

| Stream | Items | Total Effort | Dependency |
|--------|-------|-------------|------------|
| **Stream A (Payments)** | Item 1 → Item 3 → Item 4 | ~5 days | Fully sequential |
| **Stream B (Frontend)** | Item 5 | ~1 day | Parallel with Stream A (Item 1 must be stable for contracts) |

### Stream Diagram

```
Week 1 (Aug 20 - Aug 27):
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Day 1-2 (Aug 20-21):                                                                           │
│   A: Item 1 — MercadoPago + Stripe gateways (2d) ──────────────────────────                   │
│                                                                                                 │
│ Day 3-4 (Aug 22-23):                                                                           │
│   A: Item 3 — Subscription upgrade/downgrade + proration (2d) ──────────────                  │
│   B: Item 5 — Frontend multi-provider settings (1d) ═════ (starts after Item 1 Day 2)          │
│                                                                                                 │
│ Day 5 (Aug 24):                                                                                │
│   A: Item 4 — Webhook retry with exponential backoff (1d) ─────────────────                    │
│                                                                                                 │
│ Day 6 (Aug 25-27):                                                                              │
│   Buffer: Review (CTO security/architecture), website-speed laboration, release prep, tag v0.9.0│
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Critical Path

**Item 1 (2d) → Item 3 (2d) → Item 4 (1d) = 5.0 calendar days**

Stream B (1d Frontend) starts after Item 1's contract is stable → total calendar time ~5.5 days, fits in 1 week with ~1.5-day buffer.

---

## Item 1: Payment Provider Strategy Pattern + Gateways (🔴 High, 2d)

**Effort**: 2 days
**Theme**: Core Feature
**Stream**: A
**Blocking**: Item 3, Item 5
**Dependencies**: Sprint 8 Item 2 (PaymentProviderConfig + per-tenant config exists)

### Description

Implement MercadoPago and Stripe gateways conforming to `PaymentGatewayPort`, and integrate both into the existing `PaymentProviderFactory` using the Strategy Pattern. The factory must resolve per-tenant config (already provided by Sprint 8's `PaymentProviderResolver`) — if a tenant has an active MercadoPago config, the factory returns a `MercadoPagoGateway`; for Stripe, a `StripeGateway`.

**What exists (verified):**

| Asset | Status |
|-------|--------|
| `PaymentGatewayPort` interface | ✅ Two variants: one with raw types (`~/application/ports/payment-gateway.port.ts`) and one with `Either<ApplicationError, …>` types (`~/application/ports/gateways/payment-gateway.port.ts`). The ProviderFactory (Item 1's deliverable) **must use the Either-typed variant** |
| `AsaasPaymentProvider` (simulated) | ✅ — returns simulated PIX charges (pixKey, qrCode, copyPaste) |
| `PaymentProviderFactory` | ✅ — static factory with `switch` on `config.type`. **Only Asaas is implemented**; MercadoPago, Stripe throw `Error('not yet implemented')` |
| `PaymentProviderConfigRepositoryPort` | ✅ — supports `findByTenantAndProvider()`, upsert, delete |
| `EncryptionPort` + `Aes256GcmEncryptionService` | ✅ — decrypts stored apiKey |
| `PaymentProviderResolver` | ✅ Sprint 8 — resolves active tenant config → falls back to env vars |

**What's needed:**

#### 1A: MercadoPagoPaymentProvider

```typescript
// infrastructure/payment/providers/mercadopago.provider.ts
import { PaymentGatewayPort, PaymentGatewayPort as PaymentGatewayPortEither } from '@/application/ports/gateways/payment-gateway.port';
import { ApplicationError } from '@/application/errors/application.error';
import { success, failure } from '@/application/types/either';
import { EncryptedPayload } from '@/application/ports/adapters/encryption.port';

interface MercadoPagoConfig {
  apiKey: string; // decrypted from stored, per-tenant config
  environment: 'sandbox' | 'production';
}

export class MercadoPagoPaymentProvider implements PaymentGatewayPortEither {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: MercadoPagoConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.mercadopago.com'
      : 'https://api.mercadopago.com/sandbox';
  }

  async createPixCharge(params: {
    amount: number;
    description: string;
    customerId?: string;
    externalReference?: string;
  }): Promise<Either<ApplicationError, PixChargeResponse>> {
    // Use Mercado Pago REST API (POST /v1/payments with payment_method_id=pix)
    // Generate a simulated PIX payload in sandbox (same ID format as Asaas)
    // Real implementation: call POST /v1/payments with headers Authorization: Bearer ${accessToken}
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return success({
      id,
      qrCode: `mp_qr_${id}.png`,
      copyPaste: `00020126580014br.gov.bcb.pix0136${id}…`,
      expiresAt,
      status: 'PENDING',
    });
  }

  async getCharge(providerPaymentId: string): Promise<Either<ApplicationError, PixChargeResponse>> {
    // GET /v1/payments/{providerPaymentId}
    return success({ /* … */ });
  }

  async cancelCharge(providerPaymentId: string): Promise<Either<ApplicationError, void>> {
    // POST /v1/payments/refund
    return success(undefined);
  }

  handleWebhook(payload: unknown): Either<ApplicationError, {
    event: string;
    paymentId: string;
    status: string;
    metadata: Record<string, unknown>;
  }> {
    // Parse MercadoPago webhook: type=payment with id and status
    return /* … */;
  }
}
```

**Note**: The MercadoPago guide skill specifies a `ProxyApproval` (subscription) gateway. Only the payments gateway is in scope this sprint.

#### 1B: StripePaymentProvider

```typescript
// infrastructure/payment/providers/stripe.stripe.ts
interface StripeConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
}

export class StripePaymentProvider implements PaymentGatewayPortEither {
  constructor(config: StripeConfig) { /* … */ }

  async createPaymentIntent(params: {
    amount: number; // in cents
    currency: string;
    description: string;
    customerId?: string;
  }): Promise<Either<ApplicationError, { clientSecret: string; intentId: string }>> { … }

  async handleWebhook(payload: unknown, signature: string): Promise<Either<ApplicationError, { event: string; paymentId: string; status: string; metadata: Record<string, unknown> }>> { … }
}
```

**Key differences from Asaas/MercadoPago:**
- Stripe operates in **cents** (not floats). The provider must convert internally — the application always sends plain numbers (e.g., `99.90`), and Stripe adapts to cents.
- Webhook verification requires `stripe-signature` header and `stripe.webhooks.constructEvent()` (raw body + signature + webhook secret). This is handled in the provider, not the route — the route passes the raw body and header.
- Stripe Checkout Session (`/v1/checkout/sessions`) for one-time payments. Not in scope this sprint unless explicitly used by Item 3 for upgrade payments.

#### 1C: Refactored PaymentProviderFactory

The existing factory is static. It must support async resolution:

```typescript
// infrastructure/payment/provider/factory.ts
import { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import { EncryptionPort } from '@/application/ports/adapters/encryption.port';
import { PaymentGatewayPortEither } from '@/application/ports/gateways/payment-gateway.port';

export type ProviderType = 'asaas' | 'mercadopago' | 'stripe';

export class PaymentProviderFactory {
  constructor(
    private readonly configRepo: PaymentProviderConfigRepositoryPort,
    private readonly encryption: EncryptionPort,
    // Fallback env defaults for when tenant has no config
    private readonly envKeys: Record<string, string> = {
      asaas: process.env.ASAAS_API_KEY ?? '',
      mercadopago: process.env.MERCADOPAGO_API_KEY ?? '',
      stripe: process.env.STRIPE_SECRET_KEY ?? '',
    },
  ) {}

  async resolveForTenant(tenantId: string, provider: PaymentProvider): Promise<PaymentGatewayPortEither> {
    // 1. Attempt per-tenant config (stored encrypted, decrypted at resolve time)
    const config = await this.configRepo.findByTenantAndProvider(tenantId, provider);
    if (config && config.isActive) {
      const apiKey = this.encryption.decrypt(config.apiKeyEncrypted);
      return this.createProvider(provider, { apiKey, environment: config.environment });
    }

    // 2. Fallback to env var
    const envKey = this.envKeys[provider];
    if (envKey) {
      return this.createProvider(provider, { apiKey: envKey, environment: (process.env.PAYMENT_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production' });
    }

    throw new ApplicationError(`No configuration for provider '${provider}' and no API key available`, 'CONFIG_MISSING', 500);
  }

  private createProvider(provider: PaymentProvider, config: { apiKey: string; environment: 'sandbox' | 'production' }): PaymentGatewayPortEither {
    switch (provider) {
      case 'asaas':
        return new AsaasPaymentProvider(config);
      case 'mercadopago':
        return new MercadoPagoPaymentProvider(config);
      case 'stripe':
        return new StripePaymentProvider(config);
      default:
        throw new ApplicationError(`Unknown payment provider: ${provider}, 'UNSUPPORTED', 500);
    }
  }
}
```

#### 1D: Tests

**Test files:**
- `__tests__/unit/usecases/payment-provider-factory.test.ts` — resolve per-provider, env fallback, tenant-config-preferred, expired/missing config
- `__tests__/unit/payment/mercadopago-provider.test.ts` — sandbox createPix, webhook parse, getCharge
- `__tests__/unit/payment/stripe-provider.test.ts` — createPaymentIntent, webhook verification, cent conversion

### Design Patterns

- **Strategy Pattern**: One `PaymentGatewayPort` interface; three concrete providers, selected by the factory. The `ProcessPaymentUseCase` never switches on provider type — it depends only on the `PaymentGatewayPort`.
- **Factory Pattern**: `PaymentProviderFactory` creates the right strategy per tenant from encrypted config, delegating to async context.
- **Adapter Pattern**: Each provider is an adapter from its SDK/REST protocol to the clean `PaymentGatewayPort`.

### Acceptance Criteria

- [ ] `MercadoPagoPaymentProvider` implements `PaymentGatewayPortEither` — `createPixCharge()`, `getCharge()`, `cancelCharge()`, `handleWebhook()`
- [ ] `StripePaymentProvider` implements `PaymentGatewayPortEither` — `createPixCharge()` (Stripe doesn't natively givePIX — this wraps a `checkout.session` via `payment_method_types: pix`), `getCharge()`, `cancelCharge()`
- [ ] `PaymentProviderFactory.resolveForTenant()` selects the correct provider from per-tenant config; falls back to env vars if no tenant config or `isActive=false`
- [ ] Factory does not expose API keys or decrypted values outside `createProvider()`
- [ ] Provider tests pass for all 3 providers (Asaas, MercadoPago, Stripe) — simulated sandbox responses
- [ ] Webhook parsing tested for all 3 providers (header signature verification, payload extraction)
- [ ] Old sync `static create()` factory kept as backward compat (deprecated but not removed)
- [ ] All existing tests pass
- [ ] `tsc --noEmit` passes on backend
- [ ] Zero new Dependency Rule violations

---

## Item 2: Recurring Invoice Generator — NO LONGER IN SCOPE

> **Note**: The recurring invoice generator (`CreateInvoiceForSubscriptionUseCase` + BullMQ `RecurringInvoiceWorker`) was delivered in **Sprint 7**. It already: runs daily at 03:00, generates invoices for active subscriptions where `nextBilling <= today`, checks idempotency (no duplicate invoice for same sub + reference month), and publishes `subscription.invoice.created` event.
>
> The Sprint 9 brief's "Item 2: Recurring Invoice Generation Worker" describes a completed capability. This sprint skips Item 2 — its original DAG mapping (Item 1 → Item 2 → Item 3) is updated: the critical path has been simplified to Item 1 → Item 3.

---
```

---

## Item 3: Subscription Upgrade/Downgrade + Proration (🔴 High, 2d)

**Effort**: 2 days
**Theme**: Core Feature
**Stream**: A
**Blocking**: None
**Dependencies**: Item 1 (gateways must exist for upgrade/downgrade to trigger payment via the new providers)

### Description

Implement upgrade and downgrade flows for subscriptions: a user can change their subscription's plan (plan amount + billing cycle) and the system calculates a proportional adjustment (proration). Proration is a depreciation concept: the amount already paid for the current period is credited, and the new plan's remaining period is charged proportionally.

**What exists (verified):**

| Asset | Status |
|-------|--------|
| `Subscription` domain entity with `plan`, `amount`, `billingCycle`, `status`, `nextBilling` | ✅ Sprint 6 — but `plan` is a plain string (no `Plan` entity/value object) and `amount` is a plain number (not `Money` VO) |
| `calculateNextBilling()` service | ✅ Sprint 7 |
| `SubscriptionRepositoryPort.update()` | ✅ Sprint 6 |
| `ProcessPaymentUseCase` — creates PIX charge via provider, saves Payment | ✅ Sprint 6 |
| `InvoiceRepositoryPort` — create, findExistingForSubscription() for idempotency | ✅ Sprint 6 |
| `getReferenceMonth()` domain service | ✅ Sprint 7 |

**What's needed:**

#### 3A: ProrationService (Domain Service)

The proration service calculates the credit or debit when a plan change occurs with remaining billing period:

```typescript
// domain/services/proration.service.ts
export interface ProrationInput {
  subscriptionId: string;
  currentCycle: BillingCycle;
  currentAmount: number;
  nextBilling: Date;
  newPlan: string;
  newAmount: number;
  newBillingCycle: BillingCycle;
  effectiveAt: Date; // when the change takes effect (default: today)
}

export interface ProrationOutput {
  /** Positive number: user must pay this extra (upgrade). Negative: user gets credit (downgrade). */
  lineItemAmount: number;
  /** The amount to charge or credit (absolute value). Positive for upgrade, negative for downgrade. */
  totalAdjustment: number;
  /** Human-readable explanation of the calculation */
  description: string;
}

export function calculateProration(input: ProrationInput): ProrationOutput {
  const now = input.effectiveAt;
  const end = input.nextBilling;

  // Days remaining in current period
  const totalDaysInPeriod = daysInBillingCycle(input.currentBillingCycle);
  const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const fractionRemaining = daysRemaining / totalDaysInPeriod;

  // Amount already paid for the remaining period: current plan's full period amount × fraction remaining
  const refundForRemaining = input.currentAmount * fractionRemaining;

  // Amount the new plan would cost for the remaining period: new plan's full period amount × fraction remaining
  const chargeForRemaining = input.newAmount * fractionRemaining;

  const lineItemAmount = chargeForRemaining - refundForRemaining;

  // Clamp to 2 decimal places
  const totalAdjustment = Math.round(lineItemAmount * 100) / 100;

  return {
    lineItemAmount,
    totalAdjustment,
    description: totalAdjustment > 0
      ? `Upgrade: +R$ ${totalAdjustment} (remaining ${daysRemaining}d of ${totalDaysInPeriod}d)`
      : totalAdjustment < 0
        ? `Downgrade: credit R$ ${Math.abs(totalAdjustment)} (same calculation)`
        : `Plan-alteration with zero adjustment`,
  };
}

function daysInBillingCycle(cycle: BillingCycle): number {
  const today = new Date();
  const next = calculateNextBilling(today, cycle);
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
```

#### 3B: UpgradeSubscriptionUseCase

```typescript
// application/usecases/upgrade-subscription.usecase.ts
export interface UpgradeSubscriptionInput {
  subscriptionId: string;
  tenantId: string;

  plan: string;
  amount: number;
  billingCycle: BillingCycle;

  effectiveAt?: Date; // default today
}

export interface UpgradeSubscriptionOutput {
  subscription: {
    id: string;
    plan: string;
    amount: number;
    billingCycle: BillingCycle;
    nextBilling: Date;
  };
  proration: {
    lineItemAmount: number;
    totalAdjustment: number;
    description: string;
  };
  invoice: Record<string, unknown> | null; // null if no invoice (zero adjustment)
}

export class UpgradeSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly dateProvider: DateProviderPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: UpgradeSubscriptionInput, clientId?: string): Promise<Either<ApplicationError, UpgradeSubscriptionOutput>>;
}
```

**Flow:**
1. Validate subscription exists and is `ACTIVE` → 404/409 if not
2. Call `calculateProration()` — if the new plan is more or less expensive
3. Within a Unit of Work:
   a. Update subscription: `plan = newPlan`, `amount = newAmount`, `billingCycle = newBillingCycle`, `updatedAt = effectiveAt`
   b. If `totalAdjustment !== 0`, create an **adjustment/manual charge** invoice with `amount = Math.abs(totalAdjustment)` and `description = prorated description`
   c. If negative (user credit), leave as a credit note (no immediate refund — scope for Sprint 10)
4. Return output with existing proration data (+ invoice if created)

#### 3C: DowngradeSubscriptionUseCase

Same as above, but:
- If `totalAdjustment < 0` (user gets credit): create a **credit note invoice** with negative amount (for accounting)
- Credit is not refunded immediately — the user can use it for future invoices (scope: Sprint 10 or manual admin action)
- No payment trigger for a downgrade (manual or saved credit)

#### 3D: Routes

```
PATCH /api/subscriptions/:id/upgrade — body: { plan, amount, billingCycle } → 200 subscriptionUpdated
PATCH /api/subscriptions/:id/downgrade — body: { plan, amount, billingCycle } → 200 subscriptionUpdated
```

Both routes:
- Return 200 with subscription + proration details on success
- Return 404 if subscription not found
- Return 409 if subscription not ACTIVE (cannot upgrade/downgrade cancelled or expired)

#### 3E: Factories

```typescript
// presentation/factories/create-upgrade-subscription.factory.ts
import { PaymentProviderFactory } from '@/infrastructure/payment/payment-provider.factory';

export function createUpgradeSubscriptionUseCase(
  subscriptionRepo,
  invoiceRepo,
  idGenerator,
  dateProvider,
  uow,
): UpgradeSubscriptionUseCase;
```

```typescript
// presentation/factories/create-downgrade-subscription.factory.ts
```

### Design Patterns

- **Domain Service**: `calculateProration()` — pure function, no infrastructure
- **Strategy Pattern**: payment resolution still uses the provider factory from Item 1

### Acceptance Criteria

- [ ] `calculateProration()` returns correct adjustments for upgrade, downgrade, and same-price (zero)
- [ ] `UpgradeSubscriptionUseCase` applies plan change + creates invoice for positive adjustment
- [ ] `DowngradeSubscriptionUseCase` applies plan change + creates credit invoice for negative adjustment (no refund issued)
- [ ] No payment automatically created during upgrade or downgrade — adjustment invoice is created, invoice event is emitted, but the payment flow starts from the existing auto-pay handler
- [ ] Endpoint tests: PATCH routes return 200/400/404/409 correctly
- [ ] Unit tests: all calculation edge cases (month-end, zero adjustment, future effective date)
- [ ] All existing tests continue to pass (~575 backend)
- [ ] Zero new Dependency Rule violations

---

## Item 4: Webhook Retry with Exponential Backoff (🟡 Medium, 1d)

**Effort**: 1 day
**Theme**: Reliability
**Stream**: A
**Blocking**: None
**Dependencies**: Item 3 (upgrade/downgrade may queue webhook via provider)

### Description

Webhook processing must be robust: when a provider (MercadoPago, Stripe) sends a webhook, if processing fails due to HTTP 5xx or the provider's endpoint being unreachable, retry with exponential backoff. Failed webhooks go to a dead letter queue (DLQ) for manual inspection and replay.

**What exists (verified):**

| Asset | Status |
|-------|--------|
| `ProcessWebhookUseCase` | ✅ — receives `provider`, `rawBody`, `signature`, `tenantId`; verifies HMAC per-tenant; processed payment → Invoice update; intermediary `Payment` record |
| `ProcessWebhook` queue in BullMQ | ✅ `QueueNames.PROCESS_WEBHOOK` |
| `DEFAULT_JOB_OPTIONS` | ✅ — attempts: 3, backoff: { type: 'exponential', delay: 1000 } |
| `QueueManager` + `createWorker()` | ✅ |
| DLQ | ❌ **Does not exist** — no special handling after 3 failed attempts |

**What's needed:**

#### 4A: WebhookRetryService

```typescript
// infrastructure/queue/webhook-retry.service.ts
export class WebhookRetryService {
  constructor() {}

  async scheduleRetry(webhookPayload: ProcessWebhookPayload, attempt: number): Promise<string> {
    const delayMs = this.calculateDelay(attempt); // exponential: 2^attempt * 1000 for attempt 1..5

    const jobId = await addJob('process-webhook', 'process-retry', webhookPayload, {
      delay: delayMs,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      // Override: more aggressive retry for dead letters
    });
    return jobId;
  }

  private calculateDelay(attempt: number): number {
    return Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s, 32s...
  }
}
```

#### 4B: Dead Letter Queue (DLQ)

Add a new queue for failed webhooks:

```typescript
// infrastructure/queue/queue-definitions.ts — add
export const QueueNames = {
  // … existing …
  FAILED_WEBHOOKS: 'failed-webhooks',  // DLQ
} as const;
```

```typescript
// infrastructure/queue/queue-manager.ts — add worker event listener for DLQ
worker.on('failed', async (job, err) => {
  // If all retries exhausted (attemptsMade >= opts.attempts), route to DLQ
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    const dlq = new Queue(QueueNames.FAILED_WEBHOOKS, {
      connection: getRedis(),
    });
    await dlq.add('process-retry', {
      originalQueue: job.queueName,
      originalData: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
    console.log(`[DLQ] Webhook job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`);
  }
});
```

#### 4C: Update Webhook Route to Use Retry

The current webhook route (`webhook.routes.ts`) calls `useCase.execute()` synchronously. For reliability:
- If `useCase.execute()` fails (ex: HMAC not verified), return 400 immediately
- If it's a transient error (gateway down, auth token expired), the use case can internally re-enqueue via a retry job

```typescript
// in process-payment-webhook.usecase.ts (add):

import { addJob } from '@/infrastructure/queue/queue-manager';
import type { ProcessWebhookPayload } from '@/infrastructure/queue/queue-definitions';

try {
  const result = await this.webhookRetryService.attemptProcess(provider, payload);
} catch (err) {
  // Re-enqueue for retry
  const webhookPayload: ProcessWebhookPayload = {
    provider: input.provider,
    rawBody: input.rawBody,
    headers: { signature: input.signature },
    receivedAt: new Date().toISOString(),
  };
  await addJob('process-webhook', 'retry', webhookPayload, { delay: 0 });
}
```

### Design Patterns

- **Retry Pattern**: Exponential backoff with maximum retries — BullMQ `attempts: 5` + `backoff: { type: 'exponential', delay: 2000 }`
- **Dead Letter Pattern**: Failed jobs move to `FAILED_WEBHOOKS` queue, from where an operator can re-enqueue them

### Acceptance Criteria

- [ ] `DEFAULT_JOB_OPTIONS.backoff` uses `exponential` delay of 2000ms (currently 1000ms)
- [ ] `FAILED_WEBHOOKS` queue added to `QueueNames`
- [ ] Worker registers `failed` event that moves exhausted jobs to DLQ
- [ ] Webhook route doesn't bail on temporary failures; jobs are retried for up to 5 attempts
- [ ] DLQ jobs store `originalData` and `error` message
- [ ] No dead letter queue spam — after 5 attempts, job moves to DLQ and stays there until manually inspected
- [ ] Logging: successful retries logged with `[webhook] retry success ID:X attempt:Y`

---

## Item 5: Frontend Multi-Provider Settings (🟡 Medium, 1d)

**Effort**: 1d
**Theme**: Frontend / UX
**Stream**: B
**Blocking**: Item 1 (Multi-Provider API contract — the frontend must know provider field names)
**Dependencies**: Item 1 (provider list and field name contracts)

### Description

The frontend SettingsPage currently shows a provider selector dropdown (Asaas, MercadoPago, PagBank, Polar). It needs to:
1. Show the **correct providers**: LEVERAGE-MercadoPago, Stripe (remove PagBank/Polar — these don't exist)
2. Show **dynamic fields per provider** based on provider-specific fields (MercadoPago: `access_token`, Stripe: `api_key` + `webhook_secret`)
3. Ensure the form actually submits correct provider data to `PUT /api/tenants/:id/payment-config`

**What exists (verified):**

| Asset | Status |
|-------|--------|
| `apps/frontend/src/app/dashboard/settings/page.tsx` | ✅ — renders `select` with four options (Asaas, MercadoPago, PagBank, Stokes) ← note: `polar` removed, `stripe` still absent |
| Provider fields: `apiKey` (typed: password) + `environment` (select) | ✅ |
| Test file: `settings.test.tsx` (174 lines, 12 test cases) | ✅ |
| `lib/api.ts` | ✅ — `put` method (works for `api.put`) |
| **No webhook secret field** for test | ❌ |
| **No instruction text per provider** | ❌ |

**What's needed:**

#### 5A: Update `SettingsPage`: Dynamic Fields Per Provider

Change the form to:

```
Provider select: ['Asaas', 'MercadoPago', 'Stripe'] (remove PagBank/Polar)
↓ (conditional rendering per provider)
For MercadoPago:
  - API Key (password input)
  - Webhook Secret (password input, optional)
  - Environment (select 'sandbox'|'production')

For Stripe:
  - API Key (password input, label: "Secret Key" — different hint)
  - Webhook Secret (password input, label: "Stripe Webhook Signing Secret") (optional)
  - Environment (select — sandbox Stripe test keys only)

For Asaas:
  - API Key (password input) ← existing field
  - Environment (select) ← existing field
```

#### 5B: Helper function for Provider Configuration

`lib/provider-config.ts`:

```typescript
type PaymentProviderFieldConfig = {
  label: string;
  name: string;
  type: 'password' | 'text' | 'url';
  placeholder?: string;
  required: boolean;
};

function getProviderFields(providerType: 'asaas' | 'mercadopago' | 'stripe'): PaymentProviderFieldConfig[] {
  switch (provider) {
    case 'asaas':
      return [
        { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sua_chave_asaas', required: true },
      ];
    case 'mercadopago':
      return [
        { name: 'apiKey', label: 'Access Token', type: 'password', placeholder: 'APP_USR...', required: true },
        { name: 'webhookSecret', label: 'Webhook Secret', type: 'password', required: false, placeholder: 'Secret from MP Webhooks' },
      ];
    case 'stripe':
      return [
        { name: 'apiKey', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...', required: true },
        { name: 'webhookSecret', label: 'Webhook Signing Secret', type: 'password', required: false, placeholder: 'whsec_...' },
      ];
  }
}
```

#### 5C: Add Provider Select with Descriptive Help Text

Each provider should show a one-sentence description under the select:
- Asaas: "Gateways de pagamento brasileiro PIX/Boleto"
- MercadoPago: "Pagamentos via PIX, cartão de crédito, boleto"
- Stripe: "Checkout completo — PIX, cartões internacionais, PayPal"

#### 5D: Updated SettingsPage Test

`__tests__/app/dashboard/settings/settings.test.tsx`:
- Tests that switching provider changes the visible fields
- Tests that Asaas shows only `apiKey` + `environment`
- Tests that MercadoPago shows `apiKey` + `webhookSecret`
- Tests that Stripe shows `apiKey` + `webhookSecret` + `environment`
- Tests that save sends correct provider (`mercadopago`) with correct field names

### Acceptance Criteria

- [ ] Provider selector shows 3 valid options: Asaas, MercadoPago, Stripe
- [ ] Dynamic fields appear/hide based on selected provider
- [ ] Form validation: required fields must not be empty
- [ ] Submission sends correct provider + field mapping to API
- [ ] Loading state works when loading existing config
- [ ] Error message shown when API call fails
- [ ] Unit tests: dynamic field rendering, field mapping, form validation, error state
- [ ] `tsk --noEmit` passes on frontend

---

## Item 6: (Removed — see Note)

The original Sprint 9's Item 2 (Recurring Invoice Generation Worker) was delivered in Sprint 7. This item has beenoOmitted.

---

## Effort Summary Table

| Item | Description | Days | Theme | Stream | Depends On | Blocks |
|------|-------------|------|-------|--------|------------|--------|
| 1 | **MercadoPago + Stripe Gateways** | 2.0 | Payments | A | — | Item 3, Item 5 |
| 3 | **Upgrade/Downgrade + Proration** | 2.0 | Core Feature | A | Item 1 | Item 4 |
| 4 | **Webhook Retry + DLQ** | 1.0 | Reliability | A | Item 3 | — |
| 5 | **Frontend Multi-Provider Settings** | 1.0 | Frontend | B | Item 1 | — |
| | **Total** | **6.0 days** | | | **(5+0 parallel)** | |

### Effort Distribution by Theme

| Theme | Items | Total Days |
|-------|-------|-----------|
| Core Feature | Items 1, 3 | 4.0 days |
| Reliability | Item 4 | 1.0 day |
| Frontend | Item 5 | 1.0 day |

### Sprint Capacity

- **Total effort**: 6.0 days
- **Sprint duration**: 1 week (5 working days)
- **Stream factor**: 2 streams active of which 1 (Stream B) consums only 1 day and runs in parallel with Stream A's Item 1
- **Calendar time**: 5.0 days
- **Feasibility**: ✅ Fits within 1-week sprint with 1.5-2 day buffer

### Trade-offs

| If | Then |
|----|------|
| Item 1 overruns beyond 2 days | Defer Stripe gateway to Sprint 10; keep MercadoPago only (the most-critical for Brazilian market) |
| Item 3 overruns beyond 2 days | Defer downgrade credit to Sprint 10; deliver upgrade proration (charge) only |
| Item 4 overruns | Defer DLQ monitoring integration; keep plain queue retries (already in Sprint 8) — Sprint 10 DLQ monitoring |
| Item 5 overruns | Ship preset vendor page for Asaas (Plausible), without dynamic fields for the other 2 providers |
| Backend Dockerfile issues when adding Stripe/MercadoSDK | Skip actual SDK — mock REST API call for both in test mode; the PaymentGatewayPort interface stays |
| Persisted test data for Stripe/MercadoPago sandbox | Unit test: no real provider is called (mock). E2E: skip; passwordly real keys in sandbox: test separately in Sprint 10 |

---

## Risk Register

### 🔴 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `PaymentGatewayPort` has two variants (sync PIX-only vs Either-based) — `PaymentProviderFactory` must implement both and not break existing PIX use cases | Medium | High | Audit all call sites of `PaymentGatewayPort`. Item 1 must support the `Either` variant. Leave deprecated sync variant as a wrapper around Either that unwraps with intent |
| Stripe SDK (`stripe` npm package) is ~1MB — might crash backend container on start or during installation | Medium | Medium | Verify image size after build: if >200MB, skip Stripe SDK real call — treat it as a simulation with mock response (the whole process is simulated anyway for webapp) |
| Proration calculation could accumulate floating-point errors with 2 decimal places | Low | Medium | Use `Math.round()` already supported by payment calculations in all cases. Test edge cases: 0.05, 19.90, 0.99 etc. |
| Webhook DLQ requires a **new Redis hash set** to hold DLQ entries — scales with `per-failed-webhook` entries (could grow quickly) | Low | Medium | Limit: prune DLQ entries older than 7 days; add `removeOnFail` age rule |
| Frontend provider selector test: fails when provider list is on API (< fetch list of providers from backend `/api/providers` endpoint) | Low | Low | Hardcode the 3 providers in the component instead of fetching from API |

### 🟡 Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `UpgradeSubscriptionUseCase` needs to read tenper-tenant gateway (`ProcessPaymentUseCase'`) — that's a cross-use-case dependency | Medium | Medium | Merge payment interaction into a separate domain event (`subscriptionChanged`) and let AutoPayHandler decide whether to charge prorated amount — decouples |
| Webhook retry exponential backoff could hit Redis queue size (>100k entries) if the provider generates excessive events | Medium | Medium | Add monitoring (log file; nftpclinic) for queue depth > 100 entries in `dot.worker` log |
| Subscription test data in production isn't reflected when testing proration for 30-run cycles | Low | Medium | M market sandbox test with fake effectiveAt that covers 30 days range for calculation test |

### 🟢 Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `environment` field not yet on update Stripe provider | Low | Low | Always default to 'sandbox' unless explicitly selected |
| Frontend test Snapshorabi | Low | Low | omit snapshot test for rendering — test only DOM |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] **Item 1**: `MercadoPagoPaymentProvider` + `StripePaymentProvider` implementations with `PaymentProviderFactory` async resolver (per-tenant, env fallback); unit tests for all 3 providers
- [ ] **Item 3**: `calculateProration()` domain service, `UpgradeSubscriptionUseCase` + `DowngradeSubscriptionUseCase¶ unit & use-case tests, PATCH routes (`/api/subscriptions/:id/upgrade` + `/downgrade`) returning 200 with subscription + proration + invoice (if adjustment)
- [ ] **Item 4**: `WebhookRetryService` with exponential backoff (5 retries, 2000ms base delay), `FAILED_WEBHOOKS` DLQ queue, worker failure → DLQ re-enqueuing, existing process-webhook queue updated to use the retry service
- [ ] **Item 5**: SettingsPage provider selector with 3 options, dynamic fields per provider, form validation and test coverage

### Quality Gates

- [ ] `tsc --noEmit` passes on both apps (backend + frontend)
- [ ] All existing ~730 backend tests still pass, new ones passArt patented
- [ ] Frontend tests all pass
- [ ] No `console.log` or debugging artifacts
- [ ] No hardcoded secrets, URIs, or environment-specific screws

### Architecture Checks

- [ ] PaymentGatewayPort (Either-oriented) used by all three providers — no provider-specific imports in application
- [ ] `PaymentProviderFactory.resolveForTenant()` is the only place providers are created
- [ ] Domain's `calculateProration()` doesn't depend `application` or `infrastructure`
- [ ] `UpgradeSubscriptionUseCase` and `DowngradeSubscriptionUseCase` are pure, depend only on ports
- [ ] DLQ queue follows the same pattern as other queue
- [ ] Stripe webhook handle and MercadoPago verification kept inside provider

### Release

- [ ] Tag `v0.9.0` created
- [ ] Release notes written (Sprint 9 summary — multi-provider, upgrade/downgrade, webhook resilience)
- [ ] CD pipeline triggers on `v0.9.0` tag to publish both images to GHCR
- [ ] `.env.example` updated with `MERCADOPAGO_API_KEY` and `STRIPE_SECRET_KEY` template vars
- [ ] All new specs committed to `specs/`

---

## Artifact Checklist

| Item | Artifacts |
|------|-----------|
| **1** | `infrastructure/payment/providers/mercadopago.provider.ts`, `infrastructure/payment/providers/stripe-domain.provider.ts`, updated `infrastructure/payment/provider-payment.factory.ts` (async + 3 providers), factory test file, provider test files (2), `application/ports/gateways/payment-gateway.port.ts` (existing, generic — used unchanged)  |
| **3** | `domain/services/proration.service.ts` (calculateProration), `application/usecases/upgrade-subscription.usecase.ts`, `application/usecases/downgrade-subscription.usecase.ts`, `routes/subscription.routes.ts` (PATCH upgrade/downgrade), `presentation/factories/create-upgrade-subscription.factory.ts`, `presentation/factories/create-downgrade-subscription.factory.ts`, test files (proration domain service, upgrade use-case, downgrade use case) |
| **4** | `infrastructure/queue/webhook-retry.service.ts`, updated `infrastructure/queue/queue-definitions.ts` (add `FAILED_WEBHOOKS queue`), updated `infrastructure/queue/queue-manager.ts` (worker failed handler for DLQ), test files |
| **5** | Updated `apps/frontend/src/app/dashboard/settings/page.tsx` (dynamic fields), `apps/frontend/lib/provider-config.ts` (new), `apps/frontend/src/__tests/app/dashboard/settings.test.tsx` (updated), test files |

---

## Sprint 9 Specs to Generate

Beyond this plan, the following SDD specs should be created before implementation:

| Spec | Domain | Priority |
|------|--------|----------|
| `specs/mercadopago-gateway.spec.md` | MercadoPagoPaymentProvider, gateway port, PIX/webhook contracts | High (before Item 1) |
| `specs/stripe-gateway.spec.md` | StripePaymentGateway | High (before Item 1) |
| `specs/subscription-upgrade-downgrade-proration.spec.md` | Proration, Upgrade, Downgrade use cases, routes | High (before Item 3) |
| `specs/webhook-retry-exponential-backoff.spec.md` | WebhookRetry Service, DLQ, queue manager update | Medium (before Item 4) |
| `specs/frontend-multi-provider-settings.spec.md` | Settings page dynamic fields, provider-config.ts | Low (before Item 5) |

---

*Plan prepared by: Architect Agent*
*Date: 2026-08-20*
*Related documents: `docs/sprint-8-plan.md`, `docs/sprint-7-plan.md`, `docs/sprint-6-plan.md`, `docs/review-cto.md`, `docs/security-spec.md`, `specs/*`*