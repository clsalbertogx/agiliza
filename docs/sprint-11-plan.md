# Sprint 11 Plan — Hybrid: Observability Completion + Analytics + Production CD

**Theme**: Observability & Analytics Completion — alerting, dashboards, MRR/churn/LTV analytics, production CD
**Period**: 2026-09-03 to 2026-09-10 (1 week)
**Target Release**: `v0.11.0`

---

## Pre-Sprint Context

Sprint 10 delivered the last two payment gateways (PagBank, Polar) completing the 5-provider matrix, full subscription lifecycle (trial/grace/auto-renew/upgrade/downgrade), E2E CI baseline, and an observability baseline (pino structured logging + Prometheus `/metrics` + `/health` + `/ready`). Tag `v0.10.0` is cut.

**What exists now (verified in the repo):**

| Capability | Status |
|-----------|--------|
| 5 payment providers (Asaas, MercadoPago, Stripe, PagBank, Polar) via `PaymentProviderFactory` + `PaymentGatewayPort` | ✅ Sprint 6–10 |
| Full subscription lifecycle (create/cancel/pause/resume/expire/renew/upgrade/downgrade/trial/grace/auto-renew) | ✅ Sprint 6–10 |
| `SubscriptionStatus` including `TRIAL`, `GRACE_PERIOD`; fields `amount`, `billingCycle`, `startDate`, `cancelledAt`, `autoRenew` | ✅ `src/domain/entities/subscription.ts` |
| `BillingCycle` enum + `calculateNextBilling()` / `getReferenceMonth()` | ✅ `src/domain/services/billing-cycle.service.ts` |
| pino structured logging (JSON) | ✅ Sprint 10 |
| Prometheus metrics — `agiliza_http_requests_total`, `agiliza_http_request_duration_seconds`, `agiliza_active_subscriptions`, `agiliza_invoices_created_total`, `register` with `agiliza_` prefix, `getMetrics()` | ✅ `src/infrastructure/observability/metrics.ts` |
| `/health` + `/ready` enhanced health checks | ✅ `src/routes/health.routes.ts` |
| Domain event bus (`InMemoryEventBus` implementing `EventBusPort`) with `payment.failed`, `payment.confirmed`, `subscription.cancelled`, etc. | ✅ `src/domain/events/domain-events.ts`, `src/infrastructure/event-bus/` |
| Webhook DLQ — `FAILED_WEBHOOKS: 'failed-webhooks'` queue, `DeadLetterWorker`, `BullMQDLQPublisher` | ✅ `src/infrastructure/queue/` |
| CD pipeline builds + pushes GHCR images + smoke test | ⚠️ `build-and-push` job works; `deploy-staging` job is **commented out** |
| `GET /api/reports/cash-flow`, `/collection-efficiency`, `/risk-distribution` (cash-flow analytics projection) | ✅ Sprint 3+ |
| `AnalyticsInvoiceRepositoryPort` / `AnalyticsClientRepositoryPort` (projection ports) | ✅ `src/application/ports/repositories/analytics.repository.port.ts` |

**The four gaps this sprint closes (from `handoff-sprint10.md` and audit findings):**

| Gap | Sprint 11 Item | Priority |
|-----|---------------|----------|
| pino + `/metrics` exist, but **zero alerting** (no Slack/PagerDuty) — failures are only visible if someone looks at logs/metrics | **Item 1 — Alerting** | 🔴 High |
| `/metrics` exists but **no dashboards** (no Grafana/Prometheus config) — no way to visually monitor API/DB/Queue | **Item 2 — Grafana Dashboards** | 🔴 High |
| **No subscription analytics** — no MRR, churn rate, or LTV. Can't answer "is the business growing?" | **Item 3 — Subscription Analytics** | 🔴 High |
| CD builds/pushes GHCR images but **never deploys** — staging/prod step is commented out | **Item 4 — Production CD** | 🔴 High |

**Out of scope this sprint (mapped to backlog/future, from the remaining-gaps audit):**

| Gap | Priority | Where it lands |
|-----|----------|----------------|
| Frontend ESLint/Prettier not configured | 🟡 Medium | Future sprint (Ops/Quality) |
| Missing SDD specs for Sprints 3–10 features | 🟡 Medium | Backlog — backfill of `specs/` |
| Frontend `@deprecated` components never wired/removed | 🟢 Low | Future sprint (Tech-debt cleanup) |
| Swagger `/docs` could have more response schemas | 🟢 Low | Future sprint (API-doc polish) |
| Playwright browser tests (`e2e/`) need live server + CI verification | 🟢 Low | Future sprint (E2E depth) |

---

## Sprint Goal

Turn the Sprint 10 observability baseline into an **operational observability & analytics loop**: proactive alerting on payment failure and DLQ drain (Item 1), visual Grafana/Prometheus dashboards for API, DB and Queues (Item 2), a first business-intelligence endpoint with MRR/churn/LTV for subscriptions (Item 3), and an actually-deploying CD pipeline with health-check + rollback (Item 4). Produce one non-interactive production like `.sh`? No — each item produces contracts + tests only, per SDD.

---

## Dependency Graph

```
┌────────────────────────────────────────────────────────────────┐
│ Item 1: Alerting (1d)                                          │
│   - Slack webhook notifications on critical events             │
│   - PagerDuty-style alerting for payment failures              │
│   - Alert thresholds in /metrics                               │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 2: Grafana Dashboards (1d)                                │
│   - docker-compose.grafana.yml                                 │
│   - Provisioned dashboards (API, DB, Queue)                    │
│   - Prometheus datasource config                               │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 3: Subscription Analytics (1.5d)                          │
│   - MRR (Monthly Recurring Revenue) metric                     │
│   - Churn rate calculation                                     │
│   - LTV (Lifetime Value) estimate                              │
│   - Analytics use cases + routes + tests                       │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 4: Production CD (1d)                                     │
│   - Deploy to staging (Docker Compose or SSH)                  │
│   - Health check after deploy                                  │
│   - Rollback on failure                                        │
└────────────────────────────────────────────────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| Item 1 → Item 2 | Alerting surfaces the events/metrics that dashboards should visualize. Dashboards are meaningless for silent signals; alerting defines *what matters* before we build panels for it |
| Item 2 → Item 3 | MRR/churn/LTV are aggregates that analytics panels view as time series. The Grafana dashboards (API/DB/Queue) should exist so Item 3 wire panels can be added without a separate infra effort |
| Item 3 → Item 4 | A deploy that ships analytics is only worth verifying if the whole stack comes up healthy. CD health-check proves the new endpoint survives to staging |
| Item 4 (parallel) | The deploy job is independent of alerting/dashboards/analytics — it can run concurrently once the CI image build is already green (Item 4 → depends on existing `build-and-push`, not on Items 1–3) |

---

## Parallel Streams

| Stream | Items | Total Effort | Dependency |
|--------|-------|-------------|------------|
| **Stream A (Observability & Analytics)** | Item 1 → Item 2 → Item 3 | ~3.5 days | Fully sequential |
| **Stream B (Deployment)** | Item 4 | ~1 day | Parallel, only needs `build-and-push` (exists) to stay green |

### Stream Diagram

```
Week 1 (Sep 3 - Sep 10):
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Day 0-3 (Sep 3-6):                                                                       │
│   A: Item 1 — Alerting (1d) ──────────────► Item 2 — Grafana Dashboards (1d) ──────►    │
│   B: Item 4 — Production CD (1d) ════════════ (starts in parallel)                       │
│                                                                                          │
│ Day 4-5 (Sep 7-10):                                                                      │
│   A: Item 3 — Subscription Analytics + tests (1.5d) ─────                                │
│   B: Shared Buffer / Review / Release Prep                                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Critical Path

**Stream A: Item 1 (1d) → Item 2 (1d) → Item 3 (1.5d) = 3.5 calendar days**
**Stream B: Item 4 (1d) = 1 calendar day (fully parallel)**

Both streams complete within the week with ~1-day buffer for review, CTO validation, and release prep.

---

## Item 1: Alerting (🔴 High, 1d)

**Effort**: 1 day
**Theme**: Observability
**Stream**: A
**Blocking**: Item 2
**Dependencies**: Sprint 10 (pino + `/metrics` + `/health`); existing `payment.failed` domain event; existing `failed-webhooks` DLQ

### Description

Build proactive alerting on top of the Sprint 10 baseline. Today a payment failure or a drained DLQ is only visible if a human happens to watch `/metrics`. Item 1 adds:
- a **Slack webhook client** (outbound), implementing a small Port so a PagerDuty-style channel can be swapped in later without touching the use cases;
- an **`AlertService`** that (a) evaluates alert thresholds against the existing Prometheus metrics (`agiliza_active_subscriptions`, `agiliza_http_requests_total`, plus new counters) and (b) dispatches notifications;
- **event-driven alerting**: subscribe to `payment.failed` and to the `failed-webhooks` DLQ so that alert push is a domain *side effect* (Observer Pattern).

**What exists (verified):**

| Asset | Status |
|-------|--------|
| `DomainEventType` includes `'payment.failed'` | ✅ `src/domain/events/domain-events.ts` |
| `EventBusPort` + `InMemoryEventBus` (`publish`/`subscribe`) | ✅ `src/infrastructure/event-bus/in-memory-event-bus.ts` |
| Existing event handlers call pattern (`src/application/events/handlers/*.handler.ts`) | ✅ e.g. `auto-pay.handler.ts`, `send-receipt.handler.ts` |
| `FAILED_WEBHOOKS: 'failed-webhooks'` queue + `DeadLetterWorker` + `BullMQDLQPublisher` | ✅ `src/infrastructure/queue/queue-definitions.ts`, `dead-letter.worker.ts` |
| Prometheus `register` + `getMetrics()` with `agiliza_` prefix | ✅ `src/infrastructure/observability/metrics.ts` |

**What's needed:**

#### 1A: Alert channel — Port + Slack adapter (Strategy Pattern naming)

```typescript
// src/application/ports/adapters/alert-channel.port.ts
export interface AlertSeverity { ... }           // 'critical' | 'warning' | 'info'
export interface AlertMessage {
  severity: AlertSeverity;
  title: string;
  text: string;
  service: string;          // e.g. 'agiliza-backend'
  environment: string;
  timestamp: string;
  tags?: Record<string, string>;
}
export interface AlertChannelPort {
  send(message: AlertMessage): Promise<void>;
}

// src/infrastructure/observability/slack-alert-channel.ts
export class SlackAlertChannel implements AlertChannelPort {
  // POST message to SLACK_WEBHOOK_URL from .env.example
  // { text: <formatted blocks>, attachments: [{ color: '#FF0000', ... }] }
}
```

The decision: **Strategy/Port Pattern** — `AlertChannelPort` is the interface; `SlackAlertChannel` is one concrete strategy. A future `PagerDutyAlertChannel` plugs in without touching `AlertService`. No `if/else` by channel in the use case.

#### 1B: `AlertService` — threshold evaluation + dispatch

```ts
// src/application/usecases/alerting/evaluate-and-dispatch-alert.usecase.ts
export interface AlertThresholdsInput {
  maxPaymentFailuresPerHour?: number; // default 10
  maxDlqDepth?: number;               // default 5
  maxHttp5xxRate?: number;            // default 0.05 (5%)
}
export class EvaluateAndDispatchAlertUseCase {
  constructor(private readonly channel: AlertChannelPort, private readonly logger) {}
  async onPaymentFailed(event: DomainEvent) { ... }
  async onDlqDrained(failedJob: FailedWebhookPayload) { ... }
  async evaluateThresholds(): Promise<number /* alerts sent */> { ... } // reads getMetrics()
}
```

Alert threshold helper living next to the metrics registry (OBSERVABILITY boundary):

```ts
// src/infrastructure/observability/alerts.ts   ← new file (per plan)
export type AlertRule = { name: string; metric: string; operator: '>' | '<' | '>=' | '<='; threshold: number };
export class ThresholdEvaluator {
  evaluate(metrics: string, rules: AlertRule[]): AlertRule[] // parses Prometheus text, returns breached rules
}
```

#### 1C: Hook into domain events + DLQ (Observer Pattern)

Register handlers at bootstrap alongside the existing `register-event-handlers.ts`:

```ts
// src/presentation/factories/register-event-handlers.ts (extension)
eventBus.subscribe('payment.failed', async (ev) => {
  const fn =CreateAlertDispatchHandler();
  await fn.handlePaymentFailed(ev);   // threshold-aware; logs + posts to Slack
});

// src/infrastructure/queue/dead-letter.worker.ts (extension)
// after a FAILED_WEBHOOKS job lands/retries, call AlertService.onDlqDrain(job)
```

- **Slack posts on `payment.failed`** — default threshold `>=` 1 within the dispatch handler, with per-minute dedup guard to avoid storm (cooldown ~60s per (severity,title)).
- **Slack posts on DLQ drain** — a drained `failed-webhooks` job is always alert-worthy (it's already fatal after `attempts: 1`, `DLQ_JOB_OPTIONS`).
- All dispatch goes through pino (`logger.warn`/`logger.error`) — reuses Sprint 10 structured logging, no `console.*`.

#### 1D. Alert thresholds exposed in `/metrics` — new counters

```ts
// src/infrastructure/observability/metrics.ts (extend)
export const alertsSentTotal = new promClient.Counter({
  name: 'agiliza_alerts_sent_total', help: 'Total alert notifications sent', labelNames: ['severity'],
  registers: [register],
});
export const paymentFailuresTotal = new promClient.Counter({
  name: 'agiliza_payment_failures_total', help: 'Total payment failures observed', registers: [register],
});
export const failedWebhooksGauge = new promClient.Gauge({
  name: 'agiliza_failed_webhooks_dlq_depth', help: 'Current depth of the failed-webhooks DLQ', registers: [register],
});
```

These three feed the Grafana panels in Item 2 and the threshold rules in 1B. All live in `metrics.ts`, no Dependency Rule leak.

#### 1E. Env vars

Add to root `.env.example`:

```
SLACK_WEBHOOK_URL=
ALERT_SEVERITY_THRESHOLD=critical
ALERT_PAYMENT_FAILURE_THRESHOLD=1       # alerts per payment-failed burst
ALERT_COOLDOWN_MS=60000                 # dedup window
```

### Design Patterns

- **Strategy Pattern (Port/Adapter)**: `AlertChannelPort` is the seam; `SlackAlertChannel` is the concrete strategy. Declare this explicitly so the CTO can reject any `if (provider === 'slack')` inside the use case.
- **Observer Pattern / Domain Events**: the `payment.failed` side effect (posting to Slack) is modeled as an event consumed by a handler, never called inline from `ProcessPaymentUseCase`.

### Acceptance Criteria

- [ ] `AlertChannelPort` defined; `SlackAlertChannel` implements it
- [ ] `AlertService.evaluateAndNotify()` posts to Slack on breach (thresholds tested)
- [ ] `payment.failed` domain event triggers an alert via event handler (+ cooldown = dedup)
- [ ] Auto-renew failure path emits `payment.failed` and thus alerts (verify wiring)
- [ ] DLQ drain (`failed-webhooks`) triggers an alert via `DeadLetterWorker`
- [ ] New metrics exported: `agiliza_alerts_sent_total`, `agiliza_payment_failures_total`, `agiliza_failed_webhooks_dlq_depth`
- [ ] `apps/backend/src/__tests__/unit/observability/alerts.test.ts` + `slack-alert-channel.test.ts` pass
- [ ] No secrets (`SLACK_WEBHOOK_URL`) leak — redaction verified in pino logs
- [ ] All 999 backend tests still pass; `tsc --noEmit` clean
- [ ] Zero new Dependency Rule violations

---

## Item 2: Grafana Dashboards (1d)

**Effort**: 1 day
**Theme**: Observability
**Stream**: A
**Blocking**: Item 3
**Dependencies**: Item 1 (dashboards visualize the new alert counters); Sprint 10 metrics

### What's needed

A self-contained local observability stack alongside the Docker Compose already present, shipping pre-provisioned Grafana + Prometheus with dashboards for API, DB, and Queue.

#### 2A. `docker/docker-compose.grafana.yml`

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    command: ["--config.file=/etc/prometheus/prometheus.yml"]
  grafana:
    image: grafana/grafana:latest
    ports: ["3000:3000"]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - ./grafana/provisioning/:/etc/grafana/provisioning/
      - grafana-data:/var/lib/grafana
volumes:
  grafana-data:
```

Scrape the backend `/metrics` — note the CD smoke-test proves the container now serves `/metrics` (Spring Sprint 10). In docker-compose.grafana.yml, add the backend service (or reuse `apps/backend` image) with:

```yaml
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    environment: # minimal: NODE_ENV=production, REDIS_URL, DB
    ports: ["3333:3333"]
```

so Prometheus can scrape `http://backend:3333/metrics`.

#### 2B. `docker/prometheus/prometheus.yml`

```yaml
global: { scrape_interval: 15s }
scrape_configs:
  - job_name: 'agiliza-api'
    metrics_path: '/metrics'
    static_configs: [ { targets: ['backend:3333'] } ]
```

Note: metrics are already exposed with the `agiliza_` prefix — the `observabilityPlugin` (`src/infrastructure/plugins/observability.plugin.ts`) registers `GET /metrics` as a public path (see `publicPaths` in `auth.plugin.ts`). Scraper only needs the target + path.

#### 2C. `docker/grafana/provisioning/datasources/prometheus.yml`

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

#### 2D. `docker/grafana/provisioning/dashboards/agiliza.json`

A Grafana dashboard JSON with three panels:

| Panel | Query | Metric |
|-------|-------|--------|
| **API — Request rate** | rate | `rate(agiliza_http_requests_total[5m])` |
| **API — Latency** | histogram_quantile | `filename? top CPU ?` → use basebucket `agiliza_http_request_duration_seconds_bucket` |
| **API — 5xx rate** | sum | `sum(rate(agiliza_http_requests_total{status_code=~"5.."}[5m]))` |
| **API — Alerts fired** | count | `sum(rate(agiliza_alerts_sent_total[5m]))` |
| **DB — active subscriptions** | gauge | `agiliza_active_subscriptions` |
| **DB — invoices** | counter | `rate(agiliza_invoices_created_total[5m])` |
| **Queue — DLQ depth** | gauge | `agiliza_failed_webhooks_dlq_depth` |

Provisioned dashboard file auto-loads via `docker/grafana/provisioning/dashboards/agiliza.json` + a `dashboards.yml` provider referencing `./agiliza.json` with a `folder: 'Agiliza'`.

#### 2E. Validation / tests

No unit test run here — validating:

```bash
# Syntax checks both compose + json
docker compose -f docker/docker-compose.grafana.yml config --quiet
python -m json.tool docker/grafana/provisioning/dashboards/agiliza.json > /dev/null
# Wait for Grafana + Prometheus (wait-on is already a root devDep)
npx wait-on tcp:9090 tcp:3000 && curl -sf http://localhost:9090/-/ready
# Confirm Prometheus scrapes at least 1 target
curl -sf 'http://localhost:9090/api/v1/targets' | grep -q 'agiliza-api'
```

### Acceptance Criteria

- [ ] `docker-compose.grafana.yml` passes `docker compose config --quiet`
- [ ] Prometheus datasource provisioned against `http://prometheus:9090`
- [ ] `agiliza.json` dashboard JSON is valid and loads (no raw syntax errors)
- [ ] Dashboard has panels covering API metrics (rate/latency/5xx), DB gauges, and Queue→DLQ depth
- [ ] Grafana auto-provisions datasource + dashboard (no manual steps)
- [ ] No secrets/walls in dashboards — read-only, no write-back
- [ ] `tsc --noEmit` clean (if `.ts` for a small `docker/grafana` helper is added)

---

## Item 3: Subscription Analytics (🔴 High, 1.5d)

**Effort**: 1.5 days
**Theme**: Analytics
**Stream**: A
**Blocking**: None (the last in Stream A)
**Dependencies**: Item 2 (visibility); existing `Analytics*RepositoryPort` projections; existing `BillingCycle` + `calculateNextBilling()`

### What's needed

A single endpoint returning MRR, churn rate, and LTV for subscriptions, computed from data already in the system.

**Calculation definitions (explicit, to avoid ambiguity between `qa` and `dev`):**

| Metric | Formula |
|--------|---------|
| **MRR** | Sum of `amount` for subscriptions that are currently revenue-recognizing, **normalized to a monthly equivalent** via `BillingCycle` (MONTHLY=1×, BIMONTHLY=½×, QUARTERLY=⅓×, SEMIANNUAL=⅙×, ANNUAL=¹⁄₁₂×). Excludes `PAUSED` and `CANCELLED` and `EXPIRED` that have ended. Includes `TRIAL`/`GRACE_PERIOD` only if `amount > 0` and not fully unpaid |
| **Churn rate** | `(subscriptions cancelled during period) / (subscriptions at start of period) × 100` — period is the requested `from`/`to` (default: last 30 days) |
| **LTV** | `MRR × avgLifetime`, where `avgLifetime = 1 / (churnRate/100)` | month → Guard domain math: churnRate must be `> 0`, else `LTV = null` (never divide by zero → return explicit `null` + a `nullableLtv` flag |

`BillingCycle.factor()` is a **pure helper function** in the domain layer (no I/O):

```ts
// src/domain/services/billing-cycle.service.ts (extend)
export function monthlyAmount(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case BillingCycle.MONTHLY:    return amount;
    case BillingCycle.BIMONTHLY:  return amount / 2;
    case BillingCycle.QUARTERLY:  return amount / 3;
    case BillingCycle.SEMIANNUAL: return amount / 6;
    case BillingCycle.ANNUAL:     return amount / 12;
  }
}
```

#### What's needed — analytics repository projection (extend the existing port)

Extend `AnalyticsClientRepositoryPort`/`AnalyticsInvoiceRepositoryPort` OR add a narrow read model to be **specific to this use case** (a new port, no CRUD leak):

```ts
// src/application/ports/repositories/subscription-analytics.repository.port.ts
export interface SubscriptionAnalyticsRepositoryPort {
  listForAnalytics(tenantId: string, from: Date, to: Date): Promise<{
    id: string; amount: number; billingCycle: BillingCycle;
    status: SubscriptionStatus; startDate: Date; cancelledAt?: Date;
  }>;
}
```

The implementer (Prisma/Drizzle in `src/infrastructure/database/repositories/`) composes the query; the use case stays pure.

#### Use case

```ts
// src/application/usecases/get-subscription-analytics.usecase.ts
export interface GetSubscriptionAnalyticsInput {
  tenantId: string;
  from?: string;       // ISO date; default: now - 30 days
  to?: string;         // ISO date; default: now
}
export interface GetSubscriptionAnalyticsOutput {
  mrr: number;              // sum of monthly-equivalent active amounts
  churnRate: number;        // pct, 0..100
  ltv: number | null;       // null when churnRate <= 0
  activeSubscriptions: number;
  cancelledInPeriod: number;
  periodFrom: string;
  periodTo: string;
}
export class GetSubscriptionAnalyticsUseCase {
  constructor(
    private readonly subscriptionAnalyticsRepo: SubscriptionAnalyticsRepositoryPort,
    private readonly dateProvider: DateProviderPort,       // for deterministic tests
  ) {}
  async execute(input): Promise<Result<GetSubscriptionAnalyticsOutput>> { ... }
}
```

#### Route

```ts
// src/routes/analytics.routes.ts
app.get('/api/analytics/subscriptions', {
  schema: { querystring: { from: { type: 'string', format: 'date-time' }, to: { ... } }, ... }
  handler: (req, reply) => {
    const useCase = createGetSubscriptionAnalytics();
    const result = await useCase.execute({ tenantId: req.auth.tenantId, from, to });
    return reply.send(result);
  }
});
```

Factory `create-get-subscription-analytics.factory.ts` follows the existing `get-invoice-stats` / `get-cash-flow` factory pattern.

#### Response shape (document in Swagger)

```json
{
  "mrr": 1250.5, "churn": 4.2, "ltv": 297.7, "activeSubscriptions": 42,
  "cancelledInPeriod": 2, "periodFrom": "2026-08-03T00:00:00.000Z", "periodTo": "2026-09-03T00:00:00.000Z"
}
```

#### Edge cases / tests required

| Case | Expected |
|------|----------|
| Mixed cycles (MONTHLY+QUARTERLY+ANNUAL) | MRR sums monthly equivalents correctly |
| All `PAUSED`/`CANCELLED` | MRR = 0, churn uses cancelled/total |
| Churn rate = 0 (no cancellations in period) | `ltv: null` — never `Infinity` |
| Period with no subscriptions at start | churn = 0 (no division by zero) |
| Date-invalid query params | `400 VALIDATION_ERROR` |
| Missing tenantId | `400` |
| MONTH bounds (31 vs 30 days, leap) | uses `getReferenceMonth()` consistency + fixed `dateProvider` |
| LTV when churn small (1%) | `ltv = mrr * 1/(0.01) ` → correct large value |

### Design Patterns

- **Projection (CQRS-read)**: the analytics repo port is a read-only projection; no writes from this use case. Reuse the existing `analytics.repository.port.ts` family.
- **Pure domain math**: `monthlyEquivalent()` and churn/LTV are pure functions with no I/O (testable in isolation).

### Acceptance Criteria

- [ ] `GetSubscriptionAnalyticsUseCase.execute()` returns correct MRR (normalized monthly)
- [ ] Churn = (cancelled / total at start) × 100
- [ ] LTV = MRR × avgLifetime; returns `null` when churn ≤ 0
- [ ] `GET /api/analytics/subscriptions` returns 200 with correct payload, `400` on validation error
- [ ] Unit tests: MRR calc, churn calc, LTV calc, division-by-zero guard, cycle normalization
- [ ] `tsc --noEmit` clean (backend)
- [ ] All existing backend tests still pass

---

## Item 4: Production CD (🔴 High, 1d)

**Effort**: 1 day
**Theme**: CI/CD
**Stream**: B (parallel)
**Blocking**: None (within sprint)
**Dependencies**: existing `build-and-push` job (already pushing GHCR images + smoke test)

### What exists (verified)

The `.github/workflows/cd.yml` `build-and-push` job is solid: it builds, pushes both images to GHCR with both `:tag` and `:latest`, and runs a smoke test against `http://localhost:8080/api/health`. The `deploy-staging` job is **fully commented out** (lines 107–114).

### What's needed

Uncomment + implement the `deploy-staging` job with a **health check + rollback**:

#### 4A. Enable + implement `deploy-staging` in `cd.yml`

```yaml
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure SSH known_hosts / agent (secrets)
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.STAGING_SSH_PRIVATE_KEY }}

      - name: Record PREVIOUS image tag (for rollback)
        id: previmage
        run: >-
          echo "PREV=${PREV_IMAGE_TAG:-latest}" >> $GITHUB_OUTPUT
        env:
          PREV_IMAGE_TAG: ${{ secrets.PREV_IMAGE_TAG }}

      - name: Pull & restart on staging (docker compose pull + up -d)
        run: |
          ssh ${{ secrets.STAGING_HOST }} \
            "docker compose -f /opt/agiliza/staging/docker-compose.prod.yml pull \
             && docker compose -f /opt/agiliza/staging/docker-compose.prod.yml up -d"

      - name: Health check (wait-on /api/health)
        run: |
          npx wait-on -t 180000 http://${{ secrets.STAGING_HOST }}/api/health
          curl -sf http://${{ secrets.STAGING_HOST }}/api/health | grep -q '"status":"ok"'

      - name: Rollback on failure (re-pin PREV image + redeploy)
        if: failure()
        run: |
          ssh ${{ secrets.STAGING_HOST }} \
            "docker compose -f /opt/staging/docker-compose.prod.yml \
               tag ghcr.io/${{ github.repository }}/backend:latest ghcr.io/${{ github.repository }}/backend:rollback-${{ steps.version.outputs.VERSION }} \
             && docker compose -f /opt/staging/docker-compose.prod.yml up -d --force-recreate backend"
```

Key points to make explicit in the workflow (for the `cto` review):

- **Rollback strategy**: keep the **previous image tag** (`backend:<prev-tag>` / `backend:latest` — we always push `:latest`, so persist `FROM_TAG` on previous runs) and redeploy `backend:latest` from GitHUb's GHCR. Document in the workflow YAML comment that:
  - we track `PREV_IMAGE_TAG` (env/config) to pass to the rollback step;
  - `docker compose up -d` with the previous tag **restarts** the stack without destroying the volume.
- All deploy secrets (SSH key, `STAGING_HOST`) live in repo secrets — none hard-coded in the YAML.
- `healthcheck` in `docker-compose.prod.yml` already declares health; CD waits on the container health (`docker inspect ... --format {{.State.Health.Status}}`) as belt-and-suspenders.

**Also add base `secrets` checklist** for `ceo`/`scrum-master`:

```
STAGING_SSH_PRIVATE_KEY     # ssh private key to reach the staging box
STAGING_HOST                # host or tarball of staging (scp)
STAGING_USER                # ssh user
PREV_IMAGE_TAG              # image tag to fall back to on rollback
```

#### 4B. Staging compose (reuse `docker/docker-compose.prod.yml`)

Verify `docker/docker-compose.prod.yml` has a `backend:` service with `healthcheck`, `restart: always`, and points at `ghcr.io/<org>/agiliza/backend:<tag>`. If not, add a `staging` override `docker/docker-compose.staging.yml` that pins the same image with env-driven tag:

```yaml
backend:
  image: ghcr.io/${REPO}/agiliza/backend:${IMAGE_TAG:-latest}
```

#### 4C. Docs

Add a short `docs/cd-deploy.md` (or section in the plan appended at PR merge) that documents: trigger (tag push `v*`), env secrets list, deploy command, health check, and rollback procedure (one-command).

### Design Patterns

- **Strategy** — the deploy to staging is via SSH+docker; the same `deploy` template is reusable for prod later with a different `STAGING_HOST` (documented; assume staging-first).

### Acceptance Criteria

- [ ] `.github/workflows/cd.yml` YAML is valid (`actionlint` or `npx actionlint` passes)
- [ ] `deploy-staging` job runs after `build-and-push` on tag push
- [ ] Staging deploy: `docker compose pull` + `up -d` step present
- [ ] Health check after deploy uses `wait-on /api/health` (wait-on already in root devDeps)
- [ ] Rollback: keep previous image tag; a failure step re-deploys previous image (present in YAML)
- [ ] No secrets hardcoded in workflow; all via `secrets.*`
- [ ] Documented deployment + rollback steps (Applicable to the SOP)
- [ ] GHCR push + smoke test from Sprint 10 macro **still pass** for the new tag
- [ ] Manually `tsc --noEmit` + tag/release flow stays operational

---

## Effort Summary Table

| Item | Description | Days | Theme | Stream | Depends On | Blocks |
|------|-------------|------|-------|--------|------------|--------|
| 1 | **Alerting (Slack + AlertService + thresholds)** | 1.0 | Observability | A | — | Item 2 |
| 2 | **Grafana Dashboards (Prometheus/Grafana)** | 1.0 | Observability | A | Item 1 | Item 3 |
| 3 | **Subscription Analytics (MRR/churn/LTV)** | 1.5 | Analytics | A | Item 2 | — |
| 4 | **Production CD (staging + rollback)** | 1.0 | CSS/CI | B | — | — |
| | **Total** | **4.5 days** | | | 2 streams | |

### Sprint Capacity

- **Total effort**: 4.5 days
- **Sprint duration**: 1 week (5 working days)
- **Stream factor**: 2 streams active — Stream A (3.5 days) + Stream B (1 day) run in parallel
- **Calendar time**: ~4.5 days with ~0.5-day buffer
- **Feasibility**: ✅ Fits within 1-week sprint

---

## Risk Register

### 🔴 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Slack webhook secrets not available in CI/local | Medium | High | AlertChannel failure is **non-crashing**: `AlertService` catches send errors, logs `warn`, never throws into the domain path. `ALERT_ENABLED=false` disables outbound silently |
| DLQ drain storms → alert dedup gap | Medium | High | Cooldown map keyed by `(severity, title)` with `ALERT_COOLDOWN_MS`; alerts beyond the window are batched in a single message |
| LTV divide-by-zero when churn = 0 | Low | High | Return `ltv: null` explicitly when `churnRate <= 0`; test guards the boundary |
| MRR double-count of non-monthly cycles | Medium | Medium | Single source of truth `monthlyEquivalent()` + contract test over all 5 cycle factors |
| Grafana Prometheus can't reach backend `/metrics` during compose | Medium | Medium | Same network via compose: `prometheus` subscribes to `backend:3333`; dashboard JSON validated in CI (2E) |

### 🟡 Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Previous image tag for rollback not persisted | Medium | High | Persist `PREV_IMAGE_TAG` between runs (via env/state or by reusing `latest` + snapshot), documented in `cd.yml` comment |
| Staging host / secrets unavailable during sprint | Medium | Medium | CD step designed so a missing secret fails the `deploy-staging` job **without** rolling back images already built by `build-and-push` |
| Churn based on `startOfPeriod` vs activity drop | Medium | Medium | Clearly define "total at start" in the use case + ACs; add `periodFrom/periodTo` to the response for reproducibility |

### 🟢 Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Grafana default admin password — insecure | Low | Low | Set `GF_SECURITY_ADMIN_PASSWORD` from env; document rotation |
| Too many panels in dashboard JSON (bloat) | Low | Low | Keep a focused set of panels: 5 API + 3 DB + 1 DLQ; panels needed to answer business+ops questions |
| CD rollback triggers redeploy loop | Low | Low | Make rollback one-shot: a failed health check triggers rollback **and stops** (no `retry` loops); 3 attempts max |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] **Item 1**: `AlertChannelPort` + `SlackAlertChannel`; `AlertService` (threshold + cooldown); alerts on `payment.failed` + DLQ drain; 3 new metrics; tests
- [ ] **Item 2**: `docker/docker-compose.grafana.yml`, Prometheus datasource + dashboard provisioning (API/DB/Queue panels), validates in CI
- [ ] **Item 3**: `GetSubscriptionAnalyticsUseCase` + `/api/analytics/subscriptions` (MRR/churn/LTV) + factory + tests
- [ ] **Item 4**: `deploy-staging` uncommented + implementing `pull`/`up -d`, health `wait-on /api/health`, rollback on failure; docs

### Quality Gates

- [ ] `tsc --noEmit` passes on backend (and frontend if Item 2/3 add FE)
- [ ] At least **999 backend tests** pass (≥ existing), plus new unit tests for alerts, analytics, threshold evaluator
- [ ] **Frontend 399+ tests** still pass
- [ ] `SLACK_WEBHOOK_URL` and any alert secret only in `.env.example`, never in committed code
- [ ] No `console.log/console.error` in backend (all through pino)
- [ ] Zero new Dependency Rule violations (projection ports only in `application/ports`; Slack adapter only in `infrastructure`)

### Architecture Checks (for the `cto`)

- [ ] `AlertChannelPort` is the only seam into Slack — no hardcoded Slack in the use case
- [ ] `GetSubscriptionAnalytics` depends only on `SubscriptionAnalyticsRepositoryPort` + `DateProviderPort`, not on Prisma/fastify imports
- [ ] `monthlyEquivalent()` is a pure function in `domain/services/billing-cycle.service.ts`
- [ ] Grafana/Prometheus only reach **observable** endpoints (`/metrics`, `/health`, `/ready`), nothing read/write to business API
- [ ] The 3 new alert metrics are labeled and registered in the singleton registry (no re-instantiation)

### Release

- [ ] Tag `v0.11.0` created
- [ ] Release notes written (Sprint 11 summary — alerting, dashboards, analytics MRR/churn/LTV, production CD)
- [ ] CD triggers on `v0.11.0` and deploys to staging with health + rollback path proven
- [ ] `.env.example` updated with `SLACK_WEBHOOK_URL`, `ALERT_*` vars, `STAGING_*` placeholders

---

## Agile Sprint Specs to Generate

Before implementation begins, the following SDD specs should be authored (via `to-spec` skill) — one per chip — so `qa-engineer` and `fullstack-engineer` have unambiguous contracts:

| Spec | Contracts covered | Priority |
|------|-------------------|----------|
| `specs/alerting.spec.md` | `AlertChannelPort` + `SlackAlertChannel`, `AlertService` thresholds/cooldown, `payment.failed`/DLQ hooks, 3 new metrics | High (before Item 1) |
| `specs/grafana-dashboards.spec.md` | compose file, datasource provisioning, dashboard JSON contract | High (before Item 2) |
| `specs/subscription-analytics.spec.md` | `GetSubscriptionAnalyticsUseCase` I/O, MRR/churn/LTV formulas, `SubscriptionAnalyticsRepositoryPort` | High (before Item 3) |
| `specs/production-cd.spec.md` | `deploy-staging` job, health check, rollback sequence, secrets | Medium-to-Hi (before Item 4) |

---

## GitHub Workflow Metadata (for `scrum-master`)

Each of the 4 items becomes a ticket (via `to-tickets`) as an **issue** linked to the spec above, with the following labels/Milestone convention (see `scrum-github-mapping`):

- Milestone: **`Sprint 11 — Observability & Analytics Completion`**, due `2026-09-10T23:59:59Z`
- Labels: `type:feature` for Items 1, 3, 4; `type:chore` for Item 2 (infra); `priority:high` for all 4 (they close the 4 🔴 gaps)
- DoR checklist on each issue (from the skill): spec ref, copied ACs, size P/M/G, `blocked by #N` edges

---

*Plan prepared by: Architect Agent*
*Date: 2026-09-02*
*Related documents: `docs/sprint-10-plan.md`, `specs/sprint-10/*`, `docs/review-cto.md`, `.github/workflows/cd.yml`*