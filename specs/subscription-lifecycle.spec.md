# Spec: Subscription Lifecycle — Create/Cancel/Pause/Resume/Expire/Renew/Upgrade/Trial/Grace/Auto-Renew

> Status: **Implementado (Sprint 5–6)** — spec backfill. Contratos extraídos do código atual (as-is), não de design futuro.
> Fonte: `apps/backend/src/{domain,application,infrastructure,presentation,routes}`.

## Contexto de Negócio

O Agiliza monetiza via **assinaturas recorrentes** por tenant/cliente. Uma assinatura pode ser criada com trial e carência, cancelada, pausada/retomada, expirada, renovada (manual ou automática) e ter o plano alterado (upgrade com prorata). O ciclo de vida completo precisa ser modelado no domínio, com transições de status validadas e eventos de domínio publicados para efeitos colaterais desacoplados (cobrança, alertas, analytics).

Esta Spec documenta o contrato binário do ciclo de vida, conforme implementado.

---

## Escopo

### Incluído
- Entidade `Subscription` (interface + funções puras de domínio) com `SubscriptionStatus` e `BillingCycle`
- Serviços de domínio: `GracePeriodService`, `ProrationService`, `BillingCycleService`
- Use cases: Create, Cancel, Expire, Renew, Pause, Resume, Upgrade, StartTrial, SetGracePeriod, ToggleAutoRenew, AutoRenew
- Eventos: `subscription.created/cancelled/expired/renewed/paused/resumed/updated` e `subscription.invoice.created` (disparado pela cobrança recorrente)
- Analytics de assinatura (MRR, churn, LTV)
- Endpoints REST em `routes/subscription.routes.ts`

### Fora de Escopo
- **Downgrade**: **NÃO implementado** — só existe `UpgradeSubscriptionUseCase`. O plano com valor menor deve ser tratado como upgrade (novo `plan`/`amount`) ou ficar para spec futura.
- Cobrança recorrente automatizada (fila de invoices, auto-pay) — ver `recurring-billing.spec.md`
- Tabelas de `BillingSchedule` (modelo Prisma existe, mas sem use case nesta spec)
- Integração com gateway de pagamento — ver `multi-provider-payments.spec.md`

---

## Critérios de Aceitação (ACs)

| ID | Critério | Verificação |
|----|----------|-------------|
| AC1 | `createSubscription` valida: plan não-vazio, `amount > 0`, `billingCycle` ∈ {MONTHLY, BIMONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL}, `nextBilling`/`startDate` datas válidas, `trialDays ≥ 0`, `gracePeriodDays ≥ 0` | `__tests__/domain/subscription.test.ts`, `__tests__/application/usecases/create-subscription.usecase.test.ts` |
| AC2 | Status inicial é `TRIAL` se `trialDays > 0`, senão `ACTIVE`; `trialEndsAt` = `startDate + trialDays` | `__tests__/application/usecases/create-subscription.usecase.test.ts` |
| AC3 | `CreateSubscriptionUseCase` retorna `NOT_FOUND` (404) se o client não pertence ao tenant; persiste e publica `subscription.created` em caso de sucesso | `create-subscription.usecase.test.ts` |
| AC4 | `CancelSubscriptionUseCase` cancela somente assinatura não-cancelada (`CANCELLED` → `CONFLICT` 409); publica `subscription.cancelled` | `cancel-subscription.usecase.test.ts` |
| AC5 | `ExpireSubscriptionUseCase` exige status `ACTIVE` (senão `INVALID_STATUS` 409); publica `subscription.expired` | `expire-subscription.usecase.test.ts`, `recurring-billing-flow.test.ts` (lifecycle) |
| AC6 | `PauseSubscriptionUseCase` exige status `ACTIVE`; publica `subscription.paused` | `pause-subscription.usecase.test.ts` |
| AC7 | `ResumeSubscriptionUseCase` exige status `PAUSED`; publica `subscription.resumed` | `resume-subscription.usecase.test.ts` |
| AC8 | `RenewSubscriptionUseCase`: não renova em trial (`TRIAL_ACTIVE`); aceita `ACTIVE`, `EXPIRED`, `GRACE_PERIOD`; rejeita `GRACE_PERIOD_EXPIRED` (expirado além da carência com `gracePeriodDays > 0`); recalcula `nextBilling` via `calculateNextBilling`; publica `subscription.renewed` | `renew-subscription.usecase.test.ts` |
| AC9 | `UpgradeSubscriptionUseCase`: exige status `ACTIVE` ou `TRIAL`; calcula crédito prorata via `ProrationService`; cria invoice de crédito quando `proratedCredit > 0`; atualiza plano/valor/ciclo; publica `subscription.updated` | `upgrade-subscription.usecase.test.ts`, `__tests__/domain/services/proration.service.test.ts` |
| AC10 | `StartTrialSubscriptionUseCase` valida `trialDays > 0` (`INVALID_TRIAL` 400); publica `subscription.updated` com `action: 'trial.started'` | `start-trial-subscription.usecase.test.ts` |
| AC11 | `SetGracePeriodSubscriptionUseCase` valida `days > 0` (`INVALID_GRACE_PERIOD` 400); publica `subscription.updated` com `action: 'grace_period.set'` | `set-grace-period-subscription.usecase.test.ts` |
| AC12 | `ToggleAutoRenewSubscriptionUseCase` persiste `autoRenew`; publica `subscription.updated` com `action: 'auto_renew.toggled'` | `toggle-auto-renew-subscription.usecase.test.ts` |
| AC13 | `AutoRenewSubscriptionUseCase` rejeita `autoRenew === false` (`AUTO_RENEW_DISABLED` 409), trial ativo (`TRIAL_ACTIVE` 409) e status ≠ ACTIVE/GRACE_PERIOD (`INVALID_STATUS` 409); cria invoice de renovação (vencimento +7d); limpa dados de carência se estava em `GRACE_PERIOD`; publica `subscription.renewed` | `auto-renew-subscription.usecase.test.ts` |
| AC14 | `BillingCycleService.calculateNextBilling` avança 1/2/3/6 meses ou 1 ano conforme ciclo; `getReferenceMonth` retorna `YYYY-MM` | `__tests__/domain/services/billing-cycle.service` (impl), uso em `recurring-invoice` |
| AC15 | `SubscriptionRepositoryPort` expõe `findById(id, tenantId?)`, `findByTenantId`, `findByClientId`, `findActiveByNextBillingBefore`, `findDueForRenewal`, `getSubscriptionsForAnalytics`, `update`, `cancel` | `application/ports/repositories/subscription.repository.port.ts` |
| AC16 | Analytics (`GetSubscriptionAnalyticsUseCase`) calcula MRR/churn/LTV por tenant | `get-subscription-analytics.usecase.test.ts`, `__tests__/domain/services/subscription-analytics.service.test.ts` |
| AC17 | Todos os use cases são tenant-scoped: buscam via `findById(id, tenantId)` | `__tests__/routes/subscription.routes.test.ts` |

---

## Contratos entre Camadas

### Domain

#### Entity `Subscription` (implementação atual: interface + funções puras — NÃO é classe)

```typescript
// domain/entities/subscription.ts
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE', CANCELLED = 'CANCELLED', EXPIRED = 'EXPIRED',
  PAUSED = 'PAUSED', GRACE_PERIOD = 'GRACE_PERIOD', TRIAL = 'TRIAL',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY', BIMONTHLY = 'BIMONTHLY', QUARTERLY = 'QUARTERLY',
  SEMIANNUAL = 'SEMIANNUAL', ANNUAL = 'ANNUAL',
}

export interface Subscription {
  id: string; tenantId: string; clientId: string; plan: string; amount: number;
  billingCycle: BillingCycle; status: SubscriptionStatus;
  nextBilling: Date; startDate: Date; endDate?: Date; cancelledAt?: Date;
  trialDays?: number; gracePeriodDays?: number; trialEndsAt?: Date;
  gracePeriodEndsAt?: Date; autoRenew?: boolean; createdAt: Date; updatedAt: Date;
}

// Funções puras do agregado:
createSubscription(input): Either<DomainError, Subscription>
createSubscriptionFromPersistence(data: PersistenceSubscription): Subscription
subscriptionToPersistence(sub): PersistenceSubscription
subscriptionToViewModel(sub): SubscriptionViewModel
updateSubscription(sub, updates): Subscription
startTrial(sub, trialDays): Subscription          // throw DomainError se trialDays <= 0
enterGracePeriod(sub, days): Subscription          // throw DomainError se days <= 0
hasActiveTrial(sub, now?): boolean
isInGracePeriod(sub, now?): boolean
cancelSubscription(sub): Subscription              // status=CANCELLED, cancelledAt=now
expireSubscription(sub): Subscription              // status=EXPIRED, endDate=now
renewSubscription(sub, nextBilling, endDate?): Subscription  // status=ACTIVE
pauseSubscription(sub): Subscription               // status=PAUSED
resumeSubscription(sub): Subscription              // status=ACTIVE
```

#### Services de Domínio

```typescript
// domain/services/grace-period.service.ts
export class GracePeriodService {
  static isInGracePeriod(sub, now = new Date()): boolean;
  static enterGracePeriod(sub, days): Subscription;
  static hasActiveTrial(sub, now = new Date()): boolean;
}

// domain/services/proration.service.ts
export class ProrationService {
  static calculateProratedAmount(currentAmount, daysUsed, totalDaysInCycle): number; // 0 se daysUsed >= cycle
}

// domain/services/billing-cycle.service.ts
export function calculateNextBilling(currentBilling: Date, cycle: BillingCycle): Date;
export function getReferenceMonth(date: Date): string; // 'YYYY-MM'
```

#### Eventos (Observer Pattern)

```typescript
// domain/events/domain-events.ts
export type DomainEventType = /* ... */ | 'subscription.created' | 'subscription.cancelled'
  | 'subscription.expired' | 'subscription.renewed' | 'subscription.paused'
  | 'subscription.resumed' | 'subscription.updated' | 'subscription.invoice.created';

export interface DomainEvent {
  eventId: string; eventType: DomainEventType; clientId: string; tenantId: string;
  invoiceId?: string; timestamp: string; metadata: Record<string, unknown>;
}
export function createDomainEvent(eventType, data, eventId?): DomainEvent;
```

### Application

#### Use Cases (assinatura padrão: `execute(input): Promise<Either<ApplicationError, Subscription>>`)

| Use Case | Input | Regras-chave | Evento publicado |
|----------|-------|--------------|------------------|
| `CreateSubscriptionUseCase` | `{tenantId, clientId, plan, amount, billingCycle, trialDays?, gracePeriodDays?, autoRenew?}` | valida client no tenant; calcula `nextBilling` | `subscription.created` |
| `CancelSubscriptionUseCase` | `{id, tenantId}` | `CANCELLED` → 409 | `subscription.cancelled` |
| `ExpireSubscriptionUseCase` | `{subscriptionId, tenantId}` | só `ACTIVE` | `subscription.expired` |
| `RenewSubscriptionUseCase` | `{subscriptionId, tenantId}` | não em trial; `ACTIVE`/`EXPIRED`/`GRACE_PERIOD`; `GRACE_PERIOD_EXPIRED` → 409 | `subscription.renewed` |
| `PauseSubscriptionUseCase` | `{subscriptionId, tenantId}` | só `ACTIVE` | `subscription.paused` |
| `ResumeSubscriptionUseCase` | `{subscriptionId, tenantId}` | só `PAUSED` | `subscription.resumed` |
| `UpgradeSubscriptionUseCase` | `{subscriptionId, tenantId, newPlan, newAmount, billingCycle?, trialDays?}` | `ACTIVE`/`TRIAL`; prorata → invoice de crédito; `startTrial` se trialDays>0 | `subscription.updated` |
| `StartTrialSubscriptionUseCase` | `{subscriptionId, tenantId, trialDays}` | `trialDays ≤ 0` → `INVALID_TRIAL` 400 | `subscription.updated` (`action: trial.started`) |
| `SetGracePeriodSubscriptionUseCase` | `{subscriptionId, tenantId, days}` | `days ≤ 0` → `INVALID_GRACE_PERIOD` 400 | `subscription.updated` (`action: grace_period.set`) |
| `ToggleAutoRenewSubscriptionUseCase` | `{subscriptionId, tenantId, autoRenew}` | — | `subscription.updated` (`action: auto_renew.toggled`) |
| `AutoRenewSubscriptionUseCase` | `{subscriptionId, tenantId}` | `autoRenew===false` → 409; trial → 409; `ACTIVE`/`GRACE_PERIOD`; invoice +7d; limpa carência | `subscription.renewed` |

Dependências injetadas (padrão): `SubscriptionRepositoryPort`, `InvoiceRepositoryPort` (upgrade/auto-renew), `ClientRepositoryPort` (create), `EventBusPort`, `IdGeneratorPort`.

```typescript
// application/ports/repositories/subscription.repository.port.ts
export interface SubscriptionRepositoryPort {
  create(subscription: Subscription): Promise<Subscription>;
  findById(id: string, tenantId?: string): Promise<Subscription | null>;
  findByTenantId(tenantId: string): Promise<Subscription[]>;
  findByClientId(clientId: string, tenantId?: string): Promise<Subscription[]>;
  findActiveByNextBillingBefore(date: Date): Promise<Subscription[]>;
  findDueForRenewal(from: Date, to: Date): Promise<Subscription[]>;
  getSubscriptionsForAnalytics(tenantId: string, from: Date, to: Date): Promise<Subscription[]>;
  update(id: string, data: Partial<Subscription>): Promise<Subscription>;
  cancel(id: string, tenantId: string): Promise<Subscription>;
}
```

### Infrastructure

- `infrastructure/database/repositories/subscription.repository.ts` — `PrismaSubscriptionRepository implements SubscriptionRepositoryPort` (mapeia `subscriptions` via `infrastructure/database/mappers/subscription.mapper.ts`)
- `infrastructure/queue/auto-renew.worker.ts` — fila BullMQ `auto-renew`, cron diário `0 5 * * *`; `renewDueSubscriptions` chama `AutoRenewSubscriptionUseCase` para assinaturas com `nextBilling` no dia
- Event handlers: `auto-pay.handler.ts` (ver spec de billing recorrente) e `register-event-handlers.ts` assinam `subscription.invoice.created`

### Presentation

`routes/subscription.routes.ts` — todas autenticadas via Bearer (AuthPlugin):

| Método/rota | Descrição | Status |
|-------------|-----------|--------|
| `POST /api/subscriptions` | Criar assinatura | 201 |
| `GET /api/subscriptions` | Listar por tenant/client (`?tenantId`, `?clientId`) | 200 |
| `GET /api/subscriptions/analytics` | MRR/churn/LTV (`?from&to`) | 200 |
| `GET /api/subscriptions/:id` | Buscar por id (tenant-scoped) | 200/404 |
| `DELETE /api/subscriptions/:id` | Cancelar | 200/409/404 |
| `PATCH /api/subscriptions/:id/expire` | Expirar | 200/409/404 |
| `PATCH /api/subscriptions/:id/renew` | Renovar manualmente | 200/409/404 |
| `PATCH /api/subscriptions/:id/pause` | Pausar | 200/409/404 |
| `PATCH /api/subscriptions/:id/resume` | Retomar | 200/409/404 |
| `PATCH /api/subscriptions/:id/trial` | Iniciar trial (`{trialDays}` 1..365) | 200 |
| `PATCH /api/subscriptions/:id/grace-period` | Definir carência (`{days}` 1..90) | 200 |
| `PATCH /api/subscriptions/:id/auto-renew` | Alternar auto-renovação (`{autoRenew}`) | 200 |
| `PATCH /api/subscriptions/:id/upgrade` | Upgrade com prorata (`{newPlan, newAmount, billingCycle?, trialDays?}`) | 200 |

Erros: `ApplicationError` → `errorHandler` (presentation/handler.ts): 400/404/409 conforme código.

---

## Requisitos Não-Funcionais

| ID | Requisito | Detalhe |
|----|-----------|---------|
| NFR1 | Tenant isolation | Todas as leituras/escritas escopadas por `tenantId` (busca via `findById(id, tenantId)`) |
| NFR2 | Atomicidade | Use cases com múltiplas escritas (ex: upgrade → invoice de crédito + update) devem ser revisados para `UnitOfWorkPort.run()` em iterop; hoje não usam UoW |
| NFR3 | Observabilidade | Eventos de ciclo de vida publicados no `EventBusPort` para consumo assíncrono |

---

## Design Patterns Declarados Explicitamente

| Padrão | Onde Aplicado | Justificativa |
|--------|---------------|---------------|
| **State transition (maquina de estados)** | `cancelSubscription`/`expireSubscription`/`pauseSubscription`/`resumeSubscription` + validação de status no Use Case | Transições de status são regras de negócio explicitas e testadas |
| **Observer / Domain Events** | `createDomainEvent` + `EventBusPort` | Efeitos colaterais (billing, analytics, alertas) desacoplados do ciclo de vida |
| **Service (domain)** | `GracePeriodService`, `ProrationService`, `BillingCycleService` | Lógica pura reutilizável e testável sem I/O |
| **Factory** | `presentation/factories/create-*-subscription.factory.ts` (singletons) | Composição de dependências única |

> Nota de acurácia: a entity `Subscription` **não** segue o padrão class+`create()`/`instance()` do `clean-architecture-refactor.spec.md` — é uma interface + funções puras. Não alterar sem ADR.

---

## Definition of Done

- [ ] AC1–AC17 cobertos por testes automatizados (ver coluna de verificação)
- [ ] Zero violação de camada: Domain/Application não importam `infrastructure/`
- [ ] Suíte `__tests__/routes/subscription.routes.test.ts` e `__tests__/e2e/client-flow.e2e.test.ts` verdes

---

## Rastreabilidade (AC → Testes)

| AC | Teste |
|----|-------|
| AC1–AC2 | `__tests__/domain/subscription.test.ts`, `create-subscription.usecase.test.ts` |
| AC3 | `create-subscription.usecase.test.ts` |
| AC4 | `cancel-subscription.usecase.test.ts` |
| AC5 | `expire-subscription.usecase.test.ts`, `__tests__/integration/recurring-billing-flow.test.ts` |
| AC6 | `pause-subscription.usecase.test.ts` |
| AC7 | `resume-subscription.usecase.test.ts` |
| AC8 | `renew-subscription.usecase.test.ts` |
| AC9 | `upgrade-subscription.usecase.test.ts`, `proration.service.test.ts` |
| AC10 | `start-trial-subscription.usecase.test.ts` |
| AC11 | `set-grace-period-subscription.usecase.test.ts` |
| AC12 | `toggle-auto-renew-subscription.usecase.test.ts` |
| AC13 | `auto-renew-subscription.usecase.test.ts`, `__tests__/infrastructure/auto-renew.worker.test.ts` |
| AC14 | `renew-subscription.usecase.test.ts`, `__tests__/integration/recurring-billing-flow.test.ts` (idempotência por `getReferenceMonth`) |
| AC16 | `get-subscription-analytics.usecase.test.ts`, `subscription-analytics.service.test.ts` |
| AC17 | `__tests__/routes/subscription.routes.test.ts` |

---

## Decisões de Implementação (registradas a partir do código)

1. **Downgrade não existe**: sem `DowngradeSubscriptionUseCase` — sinalizar ao PM se a regra de negócio exigir (diferente de upgrade para valor menor).
2. **`autoRenew` default `true`** no `createSubscription`.
3. **Invoice de renovação**: vencimento `now + 7 dias` (prazo de pagamento); invoice de prorata vence imediatamente.
4. **Cron**: auto-renew diário 05:00 (fila `auto-renew`); invoice recorrente diário 02:00 (fila `recurring-invoices`).
