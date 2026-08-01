# Sprint 10 Plan — Hybrid: Core Feature Completion + Operational Excellence

**Theme**: Hybrid — PagBank, Polar gateways, trial/grace periods, E2E CI fix, observability, CD validation
**Period**: 2026-08-27 to 2026-09-03 (1 week)
**Target Release**: `v0.10.0`

---

## Pre-Sprint Context

Sprint 9 delivered multi-provider payments (MercadoPago + Stripe gateways), subscription upgrade/downgrade with proration calculation, webhook retry with exponential backoff and DLQ, and frontend multi-provider settings. Tag `v0.9.0` is cut.

**What exists now (after Sprint 9):**

| Capability | Status |
|-----------|--------|
| `PaymentProviderFactory` with async tenant resolution (Strategy Pattern) | ✅ Sprint 9 — Asaas, MercadoPago, Stripe implemented |
| `MercadoPagoGateway` — sandbox PIX charges, webhook verification | ✅ Sprint 9 |
| `StripeGateway` — sandbox payment intent, webhook verification | ✅ Sprint 9 |
| `calculateProration()` domain service | ✅ Sprint 9 |
| `UpgradeSubscriptionUseCase` / `DowngradeSubscriptionUseCase` | ✅ Sprint 9 |
| `WebhookRetryService` with exponential backoff + `FAILED_WEBHOOKS` DLQ | ✅ Sprint 9 |
| Frontend `SettingsPage` with multi-provider dynamic fields (Asaas/MercadoPago/Stripe) | ✅ Sprint 9 |
| PapBank + Polar in `PaymentProviderFactory` | ⚠️ Listed in `ProviderType` enum but both throw `Error('not yet implemented')` |
| Subscription `trialDays` / `gracePeriodDays` fields | ❌ **Does not exist** — `Subscription` interface has no trial or grace period concept |
| `GracePeriodService` domain service | ❌ **Does not exist** |
| Auto-renewal cron job for subscriptions in grace period | ❌ **Does not exist** |
| E2E CI job working in GitHub Actions | ⚠️ Sprint 8/9 added `prisma migrate deploy` + Playwright config fix — needs end-to-end verification |
| Structured logging (JSON) in backend | ❌ **Does not exist** — existing logs use `console.log` / `console.error` |
| Prometheus-compatible `/metrics` endpoint | ❌ **Does not exist** |
| `/health` + `/ready` enhanced health checks with dependency checks | ❌ **Does not exist** |
| CD pipeline for GHCR push + staging deploy | ⚠️ Sprint 8 added Dockerfiles; Sprint 8 added CD workflow — needs actual verification on tag push |
| Tag release automation | ❌ **Does not exist** |

**The five gaps this sprint closes:**

| Gap | Sprint 10 Item | Priority |
|-----|---------------|----------|
| `PaymentProviderFactory` has `throw new Error('not yet implemented')` for PagBank and Polar — only Asaas, MercadoPago, and Stripe are implemented | **Item 1** | 🔴 P0 |
| No trial period or grace period concept on the Subscription entity — cannot offer "try before you buy" or "3-day grace" | **Item 2** | 🔴 P0 |
| E2E CI job was partially fixed in Sprint 8/9 but hasn't been verified end-to-end on a real pipeline run | **Item 3** | 🔴 P0 |
| Zero observability — no structured logs, no metrics, no dependency-aware health checks. Operating blind in production. | **Item 4** | 🔴 P0 |
| CD pipeline exists in config but tag-triggered GHCR push and staging deploy haven't been validated end-to-end | **Item 5** | 🟡 P1 |

---

## Sprint Goal

Complete ALL payment providers (PagBank, Polar), add subscription trial/grace periods with auto-renewal logic, fix and validate E2E CI, establish an observability baseline (pino structured logging + Prometheus metrics + enhanced health checks), and validate the CD pipeline with tag automation.

---

## Dependency Graph

```
┌────────────────────────────────────────────────────────────────┐
│ Item 1: PagBank + Polar Gateways (P0, 1.5d)                    │
│   - PagBankGateway implementing PaymentGatewayPort              │
│   - PolarGateway implementing PaymentGatewayPort                │
│   - Remove `throw Error('not yet implemented')` from factory   │
│   - Tests for both gateways                                     │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 2: Trial / Grace Periods + Auto-Renewal (P0, 2d)          │
│   - Subscription model: trialDays, gracePeriodDays              │
│   - GracePeriodService (domain service)                        │
│   - Renewal logic with grace period handling                   │
│   - AutoRenewSubscriptionUseCase (daily cron job)               │
│   - PATCH /api/subscriptions/:id/trial                          │
│   - PATCH /api/subscriptions/:id/grace-period                   │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 3: E2E CI Fix + Baseline Validation (P0, 1d)              │
│   - prisma migrate deploy in CI E2E job                        │
│   - Backend startup in CI + health check                       │
│   - Playwright config fix (baseURL, auth)                      │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 4: Observability Baseline (P0, 1.5d)                      │
│   - pino structured logging (backend)                          │
│   - Prometheus metrics endpoint (/metrics)                     │
│   - Request/response logging middleware                        │
│   - Health check endpoint enhancement (/health + /ready)       │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 5: E2E CI Validation + CD Deploy (P1, 1d)                 │
│   - Verify E2E CI job runs end-to-end                          │
│   - CD pipeline: GHCR push + staging deploy placeholder        │
│   - Tag release automation                                     │
└────────────────────────────────────────────────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| Item 1 → Item 2 | PagBank and Polar gateways complete the payment provider matrix. The trial/grace period auto-renewal may trigger payment attempts via these newly available providers |
| Item 2 → Item 3 | E2E tests should cover the trial/grace period lifecycle once it's ready — can't add E2E cases for features that don't exist yet |
| Item 3 → Item 4 | Observability middleware and metrics are meaningless if the backend won't start. Stable E2E CI ensures a reliable baseline for adding middleware |
| Item 4 → Item 5 | Metrics and logging must be proven in CI before pushing an image to GHCR and deploying to staging |

---

## Parallel Streams

| Stream | Items | Total Effort | Dependency |
|--------|-------|-------------|------------|
| **Stream A (Payments)** | Item 1 → Item 2 | ~3.5 days | Fully sequential |
| **Stream B (Ops)** | Item 3 → Item 4 → Item 5 | ~3.5 days | Sequential, starts in parallel with Stream A |

### Stream Diagram

```
Week 1 (Aug 27 - Sep 3):
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Day 1-1.5 (Aug 27-28 PM):                                                                       │
│   A: Item 1 — PagBank + Polar Gateways (1.5d) ────────────────────                            │
│   B: Item 3 — E2E CI Fix (1d) ════════════════ (starts in parallel)                            │
│                                                                                                 │
│ Day 1.5-3.5 (Aug 28 PM - Sep 1):                                                                │
│   A: Item 2 — Trial/Grace Periods + Auto-Renewal (2d) ──────────────────────                   │
│   B: Item 4 — Observability Baseline (1.5d) ════════════ (starts after Item 3)              │
│                                                                                                 │
│ Day 3.5-5 (Sep 1 PM - Sep 3):                                                                   │
│   B: Item 5 — CD Validation + Tag Release (1d) ════                                               │
│   Buffer / Review / Release Prep                                                                          │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Critical Path

**Stream B: Item 3 (1d) → Item 4 (1.5d) → Item 5 (1d) = 3.5 calendar days**
**Stream A: Item 1 (1.5d) → Item 2 (2d) = 3.5 calendar days**

Both streams complete within the week with ~1-day buffer for review, CTO validation, and release prep.

---

## Item 1: PagBank + Polar Gateways (P0, 1.5d)

**Effort**: 1.5 days
**Theme**: Core Feature Completion
**Stream**: A
**Blocking**: Item 2
**Dependencies**: Sprint 9 Item 1 (PaymentProviderFactory with async resolution, Asaas + MercadoPago + Stripe implemented)

### Description

Implement PagBank and Polar gateways conforming to `PaymentGatewayPort` and remove the `throw new Error('not yet implemented')` from `PaymentProviderFactory.static create()` for both provider types. These are the last two payment providers in the 5-provider matrix.

**What exists (verified):**

| Asset | Status |
|-------|--------|
| `PaymentGatewayPort` interface (`src/application/ports/payment-gateway.port.ts`) | ✅ Three variants: `createCharge()`, `handleWebhook()`, `cancelCharge()`, `getCharge()`, `createPaymentIntent()`, `createCheckoutSession()` |
| `PaymentProviderFactory.create()` with `switch` on provider type | ✅ Asaas, MercadoPago, Stripe → instantiated; PagBank, Polar → throw Error |
| `ProviderType` union type | ✅ `'asaas' \| 'mercadopago' \| 'stripe' \| 'pagbank' \| 'polar'` |
| `PaymentProviderFactory.createForTenant()` async resolver | ✅ Falls through all 5 providers but ignores PagBank/Polar due to missing implementations |
| Provider test infrastructure | ✅ Sprint 9 established pattern with `__tests__/unit/payment/mercadopago-provider.test.ts` and `stripe-provider.test.ts` |

**What's needed:**

#### 1A: PagBankGateway

```typescript
// infrastructure/payment/pagbank.gateway.ts
import type { PaymentGatewayPort } from '@/application/ports/payment-gateway.port';
import type { Either } from '@/domain/types/either';
import type { PagBankConfig } from './types';
import { PaymentError } from '@/application/errors/payment.error';

export class PagBankGateway implements PaymentGatewayPort {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly webhookSecret: string;

  constructor(config: PagBankConfig) {
    this.token = config.token; // PagBank uses Bearer token, not a secret key
    this.webhookSecret = config.webhookSecret ?? '';
    this.baseUrl = config.environment === 'production'
      ? 'https://api.pagseguro.com'
      : 'https://sandbox.api.pagseguro.com';
  }

  async createCharge(params: {
    amount: number; // PagBank expects BRL in integer cents internally but the API works with decimal value
    description: string;
    customerId?: string;
    externalReference?: string;
    paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  }): Promise<Either<PaymentError, ChargeResponse>> {
    // Simulate sandbox PIX charge creation
    // Real POST /charges with Authorization: Bearer ${this.token}
    const id = `pag_${crypto.randomUUID()}`;
    const now = new Date();

    return success({
      id,
      providerChargeId: id,
      status: 'PENDING',
      qrCode: `pag_qr_${id}.png`,
      copyPaste: `00020126580014br.gov.bcb.pix0136${id.slice(-6)}...`,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      checkoutUrl: undefined,
      createdAt: now,
    });
  }

  async getCharge(providerChargeId: string): Promise<Either<Payment Error, ChargeResponse>> { ... }
  async cancelCharge(providerChargeId: string): Promise<Either<PaymentError, void>> { ... }

  handleWebhook(payload: unknown, signature?: string): Either<PaymentError, WebhookEvent> {
    // Verify client sending HMAC SHA-256
    // Map PagBank webhook structure: { type: 'PAYMENT_RECEIVED', data: { id, status } }
    // ...
  }
}
```

#### 1B: Polar Gateway

```typescript
// infrastructure/payment/polar.gateway.ts
import { PaymentGatewayPort } from '@/application/ports/payment-gateway.port';
import type { PolarConfig } from './types';

/**
 * Polar is a pre-shipment (subscription-style) gateway. It manages subscriptions
 * natively, so `createCharge()` wraps a hosted checkout session rather than
 * raw PIX charges.
 */
export class PolarGateway implements PaymentGatewayPort {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(config: PolarConfig) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret ?? '';
    this.baseUrl = config.environment === 'production'
      ? 'https://api.polar.sh'
      : 'https://sandbox.polar.sh';
  }

  async createCheckoutSession(params: {
    amount: number;
    currency: string;
    description: string;
    customerId?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<Either<PaymentError, CheckoutSessionResponse>> {
    // Simulated sandbox checkout
    // Real POST /v1/checkout/sessions with Customer Portal link
    const id = `polr_check_${crypto.randomUUID()}`;
    return success({
      id,
      url: this.baseUrl + `/checkout/${id}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  }

  async handleWebhook(payload: unknown, signature?: string): Promise<Either<PaymentError, WebhookEvent>> {
    // Verify HMAC: sha256HMAC(payload, this.webhookSecret) === signature
    // Polar sends events: subscription.created, subscription.paid, subscription.canceled
    // ...
  }
}
```

#### 1C: Update PaymentProviderFactory

Two lines change — remove the `throw` stubs:

```typescript
// infrastructure/payment/payment-provider.factory.ts
// (inside static create() switch)
case 'pagbank':
  return new PagBankGateway({
    token: config.apiKey,
    environment: config.environment || 'sandbox',
    webhookSecret: config.webhookSecret,
  });
case 'polar':
  return new PolarGateway({
    apiKey: config.apiKey,
    webhookSecret: config.webhookSecret,
    environment: config.environment || 'sandbox',
  });
```

Also update `envFallbackFor()` to support PagBank and Polar env vars:

```typescript
private envFallbackFor(provider: ProviderType): PaymentGatewayPort | null {
  // ... existing cases ...
  case 'pagbank':
    if (!env.PAGBANK_TOKEN) return null;
    return PaymentProviderFactory.create({ type: 'pagbank', apiKey: env.PAGBANK_TOKEN, environment: env.PAGBANK_ENVIRONMENT, webhookSecret: env.PAGBANK_WEBHOOK_SECRET });
  case 'polar':
    if (!env.POLAR_API_KEY) return null;
    return PaymentProviderFactory.create({ type: 'polar', apiKey: env.POLAR_API_KEY, webhookSecret: env.POLAR_WEBHOOK_SECRET });
}
```

#### 1D: Tests

```
__tests__/unit/payment/pagbank-gateway.test.ts
  - createCharge() returns Simulated PIX charges with correct format
  - getCharge() by providerChargeId returns correct payment status
  - cancelCharge() sets status to CANCELLED
  - handleWebhook() verifies HMAC-SHA256 and parses webhook event

__tests__/unit/payment/polar-gateway.test.ts
  - createCheckoutSession() returns a checkout URL with unique session ID
  - handleWebhook() verifies HMAC signature and maps Polar events
  - cancelSubscription() handles subscription cancellation
  - getSubscription() returns subscription status

__tests__/unit/usecases/payment-provider-factory.test.ts (update)
  - add test that resolveForTenant with 'pagbank' type returns PagBankGateway
  - add test that resolveForTenant with 'polar' type returns PolarGateway
```

### Design Patterns

- **Strategy Pattern** (continued from Sprint 9): All 5 providers conform to the same `PaymentGatewayPort` interface; the factory selects the right strategy per tenant
- **Adapter Pattern**: Each gateway adapts its SDK/REST protocol to the clean port

### Acceptance Criteria

- [ ] `PagBankGateway` implements `PaymentGatewayPort` — `createCharge()`, `getCharge()`, `cancelCharge()`, `handleWebhook()`
- [ ] `PolarGateway` implements `PaymentGatewayPort` — `createCheckoutSession()`, `cancelCharge()`, `handleWebhook()`
- [ ] `PaymentProviderFactory.create()` no longer throws for `'pagbasilisk'` or `'polar'`
- [ ] `PaymentProviderFactory.createForTenant()` resolves PagBank and Polar by tenant config
- [ ] Two provider test files pass: PagBank (4+ tests), Polar (4+ tests)
- [ ] Factory test covers all 5 providers no longer throws
- [ ] All existing tests (~872 backend) still pass
- [ ] `tsc --noEmit` passes on backend
- [ ] Zero new Dependency Rule violations

---

## Item 2: Trial/Grace Periods + Auto-Renewal (P0, 2d)

**Effort**: 2 days
**Theme**: Core Feature Addition
**Stream**: A
**Blocking**: None
**Dependencies**: Item 1 (all 5 payment gateways available for auto-renewal payment)

### Description

Add trial period and grace period concepts to the Subscription entity, allowing subscriptions to have a "try before you buy" trial (`trialDays`) and a hard cutoff buffer after nextBilling passes (`gracePeriodDays`). Add an auto-renewal cron job that automatically renews subscriptions in grace period if the payment succeeds (by triggering the existing `ProcessPaymentUseCase`).

**What exists (verified):**

| Asset | Status |
|-------|--------|
| `Subscription` interface with `ACTIVE`/`CANCELLED`/`EXPIRED`/`PAUSED` states | ✅ Sprint 6 |
| `ExpireSubscriptionUseCase` (marks expired when `newBiLling < now`) | ✅ Sprint 7 |
| `RenewSubscriptionUseCase` (renews with new nextBilling) | ✅ Sprint 7 |
| `AutoPayHandler` subscribed to `subscription.invoice.created` | ✅ Sprint 7 |
| `RegenerateInvoiceQueue` (BullMQ daily 03:00 cron) | ✅ Sprint 7 |
| `calculateNextBilling()` domain service | ✅ Sprint 7 |

**What's needed:**

#### 2A: Update Subscription Domain Model

Add four new fields to the `Subscription` interface:

```typescript
// src/domain/entities/subscription.ts

export interface Subscription {
  // ... existing fields ...

  /** Number of trial days before the first billing. 0 = no trial. */
  trialDays: number;

  /** Date the trial ends (derived from startDate + trialDays). null if no trial. */
  trialEndsAt?: Date;

  /** Number of grace days after nextBilling passes before subscription is truly expired.
   *  During grace, the subscription is still ACTIVE (or GRACE) and the system
   *  attempts to auto-renew. Default: 0 (no grace). */
  gracePeriodDays: number;

  /** Whether this subscription is currently in a trial period (computed from trialDays). */
  inTrial(): boolean {
    return this.trialDays > 0 && this.trialEndsAt && new Date() < this.trialEndsAt;
  }

  /** Whether this subscription is currently in grace period (computed from nextBilling + gracePeriodDays). */
  inGracePeriod(): boolean {
    return this.gracePeriodDays > 0 && new Date() > this.nextBilling && new Date() < this.graceEndsAt();
  }

  /** Date when grace period ends (nextBilling + gracePeriodDays). null if no grace. */
  gracePeriodEndsAt(): Date | null {
    if (this.gracePeriodDays <= 0) return null;
    const date = new Date(this.nextBilling);
    date.setDate(date.getDate() + this.gracePeriodDays);
    return date;
  }
}
```

#### 2B: GracePeriodService (domain service)

```typescript
// src/domain/services/grace-period.service.ts
import type { Subscription } from './subscription';
import { DomainError } from '../errors/domain-error';

export interface GracePeriodDecision {
  /** Should the subscription be expired now or allowed to renew? */
  action: 'EXPIRE' | 'AUTO_RENEW';

  /** The date at which the action must be taken */
  decisionDate: Date;

  /** Reason for the decision */
  reason: string;
}

export class GracePeriodService {
  /**
   * Evaluate whether a subscription that has passed `nextBilling` should be
   * auto-renewed (because it's still within grace period) or expired immediately.
   */
  evaluate(subscription: Subscription): GracePeriodDecision {
    const now = new Date();

    if (now <= subscription.nextBilling) {
      // Not passed yet — no decision needed
      return {
        action: 'AUTO_RENEW',
        decisionDate: now.toISOString(),
        reason: 'Subscription is still current.',
      };
    }

    if (subscription.gracePeriodDays <= 0) {
      return {
        action: 'EXPIRE',
        decisionDate: now.toISOString(),
        reason: 'No grace period configured for this subscription.',
      };
    }

    const graceEnd = subscription.gracePeriodEndsAt();
    if (!graceEnd || now > graceEnd) {
      return {
        action: 'EXPIRE',
        decisionDate: now.toISOString(),
        reason: `Grace period (${subscription.gracePeriodDays} days) has ended.`,
      };
    }

    return {
      action: 'AUTO_RENEW',
      decisionDate: now.toISOString(),
      reason: `Subscription is in grace period (${subscription.gracePeriodDays} days). Auto-renewal allowed.`,
    };
  }
}
```

#### 2C: AutoRenewSubscriptionUseCase

```typescript
// src/application/usecases/auto-renew-subscription.usecase.ts
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import type { GracePeriodService } from '@/domain/services/grace-period.service';
import type { Subscription } from '@/domain/entities/subscription';
import type { UseCase } from '~/application/usecase';
import type { Either } from '~/application/types';
import { renewal, success, failure } from '~/application/types';
import { ApplicationError } from '~/application/errors';

export interface AutoRenewSubscriptionInput {
  /** Optional: specific subscription ID to renew. If not provided, all grace-period subscriptions are processed. */
  subscriptionId?: string;
  /** Optional: tenant filter for scoped auto-renewal */
  tenantId?: string;
}

export interface AutoRenewSubscriptionOutput {
  renewed: number; // count of subscriptions successfully renewed
  failed: number;  // count of subscriptions where payment failed
  expired: number; // count of subscriptions where grace period expired
}

export class AutoRenewSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly gracePeriodService: GracePeriodService,
    private readonly dateProvider: DateProviderPort,
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly calculateNextBillingFn: CalculateNextBillingFn,
  ) {}

  async execute(input: AutoRenewSubscriptionInput): Promise<Either<ApplicationError, AutoRenewSubscriptionOutput>> {
    // 1. Query subscriptions that have `gracePeriodDays > 0` and `nextBilling` is passed
    const subscriptions = await this.subscriptionRepo.findSubscriptionsForAutoRenew(
      this.dateProvider.now(),
    );

    let renewed = 0;
    let failed = 0;
    let expired = 0;

    for (const sub of subscriptions) {
      const decision = this.gracePeriodService.evaluate(sub);

      if (decision.action === 'EXPIRE') {
        // Expire: call existing ExpireSubscriptionUseCase logic
        await this.subscriptionRepo.update(expireSubscription(sub));
        expired++;
        this.logger.info(`Subscription ${sub.id} expired via grace period check`);
        continue;
      }

      // AUTO_RENEW: try to renew
      const invoice = await this.subscriptionRepo.generateInvoice(sub);
      const paymentResult = await this.processPaymentUseCase.execute({ subscriptionId: sub.id, invoice });

      if (paymentResult.isFailure()) {
        failed++;
        this.logger.warn(`Auto-renew failed for sub ${sub.id}: ${paymentResult.error.message}`);
      } else {
        // Update subscription with new nextBilling
        const nextBilling = this.calculateNextBillingFn(sub.nextBilling, sub.billingCycle);
        await this.subscriptionRepo.update(renewSubscription(sub, nextBilling));
        renewed++;
      }
    }

    return success({ renewed, failed, expired });
  }
}
```

#### 2D: Repository Changes

```typescript
// src/application/ports/repositories/subscription.repository.port.ts
export interface SubscriptionRepositoryPort {
  // ... existing methods ...

  /** Find all active subscriptions that are past nextBilling but still within grace period */
  findSubscriptionsForGraceRenewal(): Promise<Subscription[]>;
}
```

SQL implementation:

```sql
-- src/infrastructure/database/repositories/subscription.repository.ts
SELECT * FROM subscriptions
WHERE status = 'ACTIVE'
  AND grace_period_days > 0
  AND next_billing < NOW()
  AND (next_billing + (grace_period_days || ' days')::interval) >= NOW();
```

#### 2E: Update Routes

```
PATCH /api/subscriptions/:id/trial     → body: { trialDays: number }
  ─ Sets the trial period for a subscription. Returns 422 if subscription
    already started (startDate < now, meaning trial already passed).
    200: { id, trialDays, trialEndsAt, status }

PATCH /api/subscriptions/:id/grace-period → body: { gracePeriodDays: number }
  ─ Sets the grace period length. Returns 422 if subscription is not ACTIVE.
    200: { id, gracePeriodDays, status }
```

#### 2F: Cron Job (AutoRenew)

Add a new BullMQ repeatable job:

```typescript
// infrastructure/queue/workers/auto-renew.worker.ts
import { Queue } from 'bullmq';

// Register repeatable cron: daily at 05:00 (after RecurringInvoiceWorker at 03:00)
await queue.add('auto-renew-subscriptions', { }, {
  repeat: { pattern: '0 5 * * *' },
  jobId: 'auto-renew-subscriptions-crole',
});
```

### Design Patterns

- **Domain Service Pattern**: `GracePeriodService` is a pure function — no infrastructure dependencies
- **Case Condition Pattern**: `eval` returns `EXPIRE | AUTO_RENEW` without side effects
- **Observer Pattern**: The auto-renewal worker subscribes to the `payment.succeeded` event internally (via `ProcessPaymentUseCase`) after the worker initiates payment

### Acceptance Criteria

- [ ] Subscription model includes `trialDays`, `trialEndsAt`, `gracePeriodDays`
- [ ] `GracePeriodService.evaluate()` returns correct decisions for: within billing, within grace, past grace, no grace configured
- [ ] `AutoRenewSubscriptionUseCase` processes: 1 subscription renewed → output `{ renewed: 1, failed: 0, expired: 0 }`
- [ ] Expired subscription (past grace) is marked EXPIRED, no auto-renewal attempt
- [ ] Unit tests: `GracePeriodService` edge cases (0 days, negative, month-end, weekend)
- [ ] Unit tests: `AutoRenewSubscriptionUseCase` in three scenarios (renewed, failed payment, expired grace)
- [ ] Route tests: `PATCH /api/subscribes/:id/trial` → 200 / 422, `PATCH /api/subscriptions/:id/grace-period` → 200 / 422
- [ ] All existing tests (~872 backend) still pass
- [ ] `tsc --noEmit` passes on backend
- [ ] Zero new Mutual Cleaning violations

---

## Item 3: E2E CI Fix + Baseline Validation (P0, 1d)

**Effort**: 1 day
**Theme**: Operational Excellence (CI Reliability)
**Stream**: B
**Blocking**: Item 4
**Dependencies**: None (starts in parallel with Stream A)

### Description

Verify and fix the E2E CI job so it runs reliably in GitHub Actions. This includes database migration setup, backend startup with health check, and Playwright test execution. The CI should be validated end-to-end: a push to the branch triggers the E2E job, the job runs Prisma migrations, starts both backend and frontend services, and runs Playwright tests.

### Known Issues (from Sprint 9)

| Issue | Status | Expected Fix |
|-------|--------|-------------|
| Prisma `migrate deploy` missing from CI E2E job | ⚠️ Partially fixed in Sprint 8 — needs verification | Add `npx prisma migrate deploy` as a step before backend starts |
| `API_URL` not set in E2E CI env | ⚠️ Missing | Add `API_URL=http://localhost:3000` to CI E2E env |
| Playwright config `baseURL` may point to wrong host | ⚠️ Needs verifying | Verify `apps/frontend/playwright.config.ts` uses `baseURL: process.env.APP_URL` with correct fallback |
| Auth headers / tokens for E2E tests | ⚠️ E2E tests may not have auth setup | Verify that `apps/frontend/e2e/` tests have `setup()` that creates a test tenant + user |

### What to Do

#### 3A: CI Job Configuration

Add the missing steps to the CI E2E job (example `.github/workflows/e2e.yml`):

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    env:
      API_URL: http://localhost:3000
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/e2e_db
      REDIS_URL: redis://localhost:6379

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: e2e_db
        ports:
          - 5432:5432
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Prisma migrate deploy
        run: npx prisma migrate deploy
        working-directory: apps/backend

      - name: Start backend
        run: node apps/backend/dist/server.js &
        env:
          NODE_ENV: test
          ENCRYPTION_KEY: test-key-32-chars-for-aes-256-testX
          ASaAS_API_KEY: ${{ secrets.ASAAS_API_KEY }}

      - name: Wait for backend health check
        run:  for i in $(seq 1 30); do curl -s http://localhost:3000/health && exit 0; sleep 1; done; exit 1

      - name: Start frontend
        run: node apps/frontend/server.js &
        workingDir: apps/frontend

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test
        working_dir: apps/frontend
        env:
          APP_URL: http://localhost:5173
```

#### 3B: Fix Playwright Config

```typescript
// apps/frontend/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.APP_URL || 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: process.env.CI ? [] : [
    // Local dev only — in CI the backend is already started
    { command: node ../../scr/server.js', port: 3000, reuseExistingServer: true },
    { command: 'npm run dev', port: 5173, reuseExistingServer: true },
  ],
});
```

### Acceptance Criteria

- [ ] CI E2E job definition has `prisma migrate deploy` step
- [ ] `API_URL` env is set in CI E2E job
- [ ] `Playwright config` has correct `baseURL`
- [ ] Backend health check step passes (< 30 retries in for loop)
- [ ] E2E test run passes on at least 1 Push to this branch
- [ ] E2E job succeeds in GitHub Actions on this sprint's branch

---

## Item 4: Observability Baseline (P0, 1.5d)

**Effort**: 1.5 days
**Theme**: Operational Excellence (Observability)
**Stream**: B
**Blocking**: Item 5
**Dependencies**: Item 3 (backend must start before  can be observed)

### Description

Add structured JSON logging via pino along with a Prometheus-compatible metrics endpoint and enhanced health checks. This establishes the minimum observability baseline required for production release: request-aware logs with latency tracking, and a metrics scraper endpoint.

### What's needed

#### 4A: pino Structured Logging

```typescript
// src/infrastructure/logger/pino-logger.ts
import pino from 'pino';
import { env } from '~/config/env';

export const logger = pino({
  level: env.LOG_LEVEL || 'info',
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  // In production, output JSON (suitable for Logstash / Cloud Logging)
  formatters: err_format
  base: {
    env: env.NODE_ENV,
    service: 'agiliza-backend',
  },
  timestamp: () => `,"@timestamp":"${new Date().toISOString()}"`,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.confirmPassword'],
    censor: '[REDACTED]',
  },
});
```

```typescript
// src/infrastructure/logger/request-logger.middleware.ts
import type { FastifyInstance } from 'fastify';
import { v7 as uuid } from 'uuid';
import { logger } from './pino-logger';

export function registerRequestLogger(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    request.id = request.headers['x-request-id'] as string || uuid();
    (request as any).startTime = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const latency = Date.now() - (request as anyPart.startTime;
    const logData = {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      latencyMs: latency,
      requestId: request.id,
      tenantId: request.any?.tenantId || '-',
    };

    if (reply.statusCode >= 500) {
      logger.error(logData, 'request completed with error');
    } else if (reply.statusCode >= 400) {
      logger.warn(logData, 'request completed with client error');
    } else {
      logger.info(logData, 'request completed');
    }
  });
}
```

#### 4B: Prometheus Metrics Endpoint

```typescript
// src/infrastructure/monitoring/prometheus.ts
import { Registry, Gauge, Counter, Histogram } from 'prom-client';
import type { FastifyInstance } from 'fastify';

export const registry = new Registry();

// Metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Latency of HTTP requests in seconds',
  labelNames: ['method', 'route', 'statusCode'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 3, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  Help: 'Total number of HTTP requests',
  LabelNames: ['method', 'route', 'statusCode'],
  registers: [register],
});

export const processMemory = new Gauge({
  name: 'process_memory_bytes',
  help: 'Memory usage in bytes',
  registers: [register],
});

// Export metrics endpoint
export function attachMetricsEndpoint(app: FastifyInstance) {
  app.get('/metrics', async (_, reply) => {
    processMemory.set(process.usage().rss);
    const metrics = await register.metrics();
    return reply.type('text/plain').send(metrics);
  });
}
```

#### 4C: Enhanced Health Check Endpoints

```typescript
// src/infrastructure/health/health.routes.ts
import type { FastifyInstance } from 'fastify';
import { redis } from '~/infrastructure/redis/client';
import { dbs } from '~/infrastructure/database/client';

export function registerHealthRoutes(app: FastifyInstance) {
  // Simple liveness probe (process is alive)
  app.get('/health', async (_, reply) => {
    return reply.status(200).send({ status: 'ok', uptime: process.uptime() });
  });

  // Readiness probe (dependencies in D)
  app.get('/ready', async (_, reply) => {
    const checks: Record<string, boolean> = {};

    try {
      // Redis check
      await response.ping();
      checks.redis = true;
    } catch { checks.redis = false; }

    try {
      // PostgreSQL check
      const result = await db.execute(sql`SELECT 1`);
      checks.postgres = true;
    } catch { checks.postgres = false; }

    const allPassed = Object.values(checks).every(Boolean);
    const statusCode = allPassed ? 200 : 503;

    return reply.status(statusCode).send({
      status: allPassed ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      checks,
    });
  });
}
```

### Acceptance Criteria

- [ ] Pino logs are in JSON format (production) and readable (development)
- [ ] Request/response middleware logs: method, url, statusCode, latencyMs, requestId
- [ ] `GET /metrics` returns Prometheus-compatible text/plain (validated with promscale)
- [ ] `GET /health` returns 200 with `{"status":"OK","uptime":...}`
- [ ] `GET /ready` returns 200 when all dependencies pass, 503 when any fail
- [ ] Redis connectivity check in `/ready` (see redis from health check)
- [ ] PostgreSQL connectivity check in `/ready`
- [ ] No secrets leaked in logs (redaction verified)
- [ ] `tsc --noEmit` passes

---

## Item 5: E2E CI Validation + CD Deploy (P1, 1d)

**Effort**: 1 day
**Theme**: Operational Excellence (CD)
**Stream**: B
**Blocking**: None
**Dependencies**: Item 4

### Description

Verify the E2E CI job runs end-to-end in GitHub Actions, validate that the tag-based CD pipeline pushes Docker images for both backend and frontend to GHCR, and add a tag-release automation script.

### Acceptance Criteria

- [ ] CI E2E job runs fully on this sprint's branch
- [ ] Tag push triggers CD workflow that builds and pushes `agiliza-backend:tag` and `agiliza-frontend:tag` to GHCR
- [ ] Staging deploy placeholder: a simple `docker-compose prod-staging` that uses the pushed images
- [ ] Tag automation script `./scripts/tag-release.sh`:
  ```bash
  #!/bin/bash
  set -e
  VERSION=$1
  if [! "$VERSION" ]; then
    VERSION=$(node -p "require('./package.json').version")
  fi
  echo "Tagging release v$VERSION..."
  git tag -a "v$VERSION" -m "Release v$VERSION"
  git push origin "v$VERSION"
  ```
- [ ] `.github/workflows/deploy.yml` triggers on `v*` tag push and builds both `apps/backend/Dockerfile` and `apps/frontend/Dockerfile`, pushes to GHCR with `ghcr.io/$REPO/agiliza-backend:${{ github.ref_name }}` tag format
- [ ] Sorce is built locally: `docker build -t ci-test-apps-backend .` and `docker run -e $VARS` ...

---

## Effort Summary Table

| Item | Description | Days | Theme | Stream | Depends On | Blocks |
|------|-------------|------|-------|--------|------------|--------|
| 1 | **PagBank + Polar Gateways** | 1.5 | Core Feature | A | — | Item 2 |
| 2 | **Trial/Grace Periods + Auto-Renewal** | 2.0 | Core Feature | A | Item 1 | — |
| 3 | **E2E CI Fix** | 1.0 | CI Reliability | B | — | Item 4 |
| 4 | **Observability Baseline** | 1.5 | Observability | B | Item 3 | Item 5 |
| 5 | **E2E CI Validation + CD Deploy** | 1.0 | CI/CD | B | Item 4 | — |
| | **Total** | **7.0 days** | | | 2 streams | |

### Sprint Capacity

- **Total effort**: 7.0 days
- **Sprint duration**: 1 week (5 working days)
- **Stream factor**: 2 streams active — Stream A (3.5 days) + Stream B (3.5 days) run in parallel
- **Calendar time**: ~3.5 days with ~1.5-day buffer
- **Feasibility**: ✅ Fits within 1-week sprint

### Effort Distribution by Theme

| Theme | Items | Total Days |
|-------|-------|-----------|
| Core Feature Completion | Items 1 + 2 | 3.5 days |
| Operational Excellence | Items 3, 4 , 5 | 3.5 days |

---

## Risk Register

### 🔴 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PagBank API uses a different authentication model (Bearer token, not API key) | Medium | Medium | The `PaymentProviderConfig.apiKey` may need a second field (`pg_token` or similar). Mitigate by confirming Pagbank's auth model with the `payments-pagbank` skill before coding |
| Polar's subscription-centric API may not fit `PaymentGatewayPort` if port was designed for one-time charges | Medium | High | Add a `createCheckoutSession()` method to the polymorphic `PaymentGatewayPort` interface, initially as `stub` that throws for non-Polar gateways |
| Auto-renewal cron may overload Redis queue with hundreds of simultaneous jobs | Low | High | Limit to `concurrency: 1` in cron job, process every subscription sequentially. Add a `MAX_AUTORENEW_BATCH_SIZE = 50` — if more, log error and postpone |
| `GracePeriodService` may power complex floating-point math for date calculations | Low | Medium | Use JS `Date.setDate(day + n)` — no floating math involved |
| E2E Prancine loading model removing `prisma migrate deploy` may introduce breaking migrations | Low | Medium | Always run `npx prisma migrate deploy` locally first, then confirm migration is clean with `npx prisma migrate status` |

### 🟡 Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PagBank test credentials may not be available in CI secrets | Medium | Medium | Use PagBank simulator in tests (mock HTTP), don't requiring CI secrets for unit tests |
| pino logging may mask `process .setup()` that delays startup | Low | Medium | Initialize pino early in server bootstrap, before routes are registered |
| prom-client memory leak if registry is re-created on every refresh | Low | Medium | Cache `registry` globally, create it once. Add a per-demand hook that clears stale metrics |

### 🟥 Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CD pipeline may use wrong image tag `v0.10.0-amd64` vs `latest` | Low | Low | Use `${{ env.GITHUB_REF_NAME }}` in CI, which resolves to tag |
| E2E CI job may be slower with Webpack Vite something | Low | Low | 3 playlists max per test file, not end-to-end heavy |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] **Item 1**: PagBankGateway + PolarGateway implementations; 5 providers all working in factory; provider tests (8+ new tests2)
- [ ] **Item 2**: `trialDays`, `gracePeriodDays`, `trialEndsAt` on Subscription entity; `GracePeriodService` domain service; `AutoRenewSubscriptionUseCase`; daily 05: auto-renew cron job; PATCH `/trial` and `/grace-period` routes; tests
- [ ] **Item 3**: E2E CI job runs with Prisma deploy + backend health check + Playwright e2e pass
- [ ] **Item 4**: pino structured logging (JSON), request/response logging middleware, `/metrics` endpoint (Prometheus), `/health` + `/ready` endpoints be
- [ ] **Item 5**: CD pipeline build-and-push to GHCR on tag push; tag-release automation Subscribe

### Quality Gates

- [ ] `tsc --noEmit` passes on both backend and frontend
- [ ] All ~872 backend tests still pass, new tests pass
- [ ] Fronten tests pass (~399+)
- [ ] No `console.log` or `console.error` in backend — all logs through pino
- [ ] No hardcoded secrets, URIs, or test tokens in committed code
- [ ] All new provider keys added to `.env.example` (`PAGBANK_TOKEN`, `POLAR_API_KEY`, etc.)

### Architecture Checks

- [ ] PaymentGatewayPort used by all 5 providers — no direct provider-specific imports in application layer
- [ ] `PaymentProviderFactory.resolveForTenant()` selects correctly even when tenant has inactive config
- [ ] GracePeriodService is a pure function (no I/O)
- [ ] AutoRenewSubscriptionUseCase depends only on ports
- [ ] Request middleware does not import domain entity-specific functions
- [ ] `/metrics` endpoint does not expose tenant data (aggregation only)

### Release

- [ ] Tag `v0.10.0` created
- [ ] Release notes written (Sprint 10 summary — all providers, trial/grace, E2E fix, observability, CD pipeline)
- [ ] CD pipeline triggers on `v0.10.0` tag to publish both images to GHCR
- [ ] `.env.example` updated with `PAGBANK_TOKEN`, `PAGBANK_WEBHOOK_SECRET`, `POLAR_API_KEY`, `POLAR_SEGMENT_KEY`, `POLAR_WEBHOOK_SECRET`
- [ ] Providers confirmed for all 5 payment types (Asaas ✅, MercadoPago ✅, Stripe ✅, PagBank ✅, Polar ✅)

---

## Agile Sprint Specs to Generate

Before implementation begins, the following SDD specs should be created:

| Spec | Domain | Priority |
|------|--------|----------|
| `specs/pagbank-gateway.spec.md` | PagBank gateway, PIX/webshook contracts | High (before Item 1) |
| `specs/polar-gateway-.spec.md` | Polar checkout + subscription webhook | High (before Item 1) |
| `specs/grace-period-service.spec.md` | GracePeriodService, trial/grace models, auto-renew | High (before Item 2) |
| `specs/observability-baseline.spec.md` | pino logging, Prometheus metrics, health checks | Medium (before Item 4) |
| `specs/ci-cd-validation.spec.md` | E2E CI fix, CD pipeline, tag release | Medium (before Item 5) |

---

*Plan prepared by: Architect Agent*
*Date: 2026-07-31*
*Related documents: `docs/sprint-9-plan.md`, `docs/sprint-8-plan.md`, `docs/sprint-7-plan.md`, `docs/review-cto.md`, `specs/*`*