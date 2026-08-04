# Spec: Recurring Billing — Geração Automática de Invoices para Assinaturas

> Status: **Implementado (Sprint 6–7)** — spec backfill. Contratos extraídos do código atual.
> Fonte: `apps/backend/src/{application/usecases/create-invoice-for-subscription.usecase.ts, infrastructure/queue/*.ts, application/events/handlers/auto-pay.handler.ts}`.

## Contexto de Negócio

Assinaturas ativas geram **cobrança recorrente**: todo mês (ou conforme o `BillingCycle`), o sistema precisa criar automaticamente um invoice PENDING por assinatura, avançar o `nextBilling` e tentar o **pagamento automático**. A geração é diária (cron 02:00), **idempotente por mês de referência**, e o pagamento é assíncrono: o handler `AutoPayHandler` processa o invoice e renova a assinatura somente se o pagamento for criado com sucesso.

---

## Escopo

### Incluído
- `CreateInvoiceForSubscriptionUseCase` — geração de invoices com idempotência por `referenceMonth`
- `RecurringInvoiceWorker` — fila BullMQ `recurring-invoices`, cron diário `0 2 * * *`
- `AutoPayHandler` — consome `subscription.invoice.created`, tenta `ProcessPaymentUseCase`, renova via `RenewSubscriptionUseCase` em caso de sucesso
- `AutoRenewSubscriptionUseCase` + worker (cron 05:00) — fluxo complementar de renovação
- `InvoiceRepositoryPort.findExistingForSubscription(subscriptionId, referenceMonth)`

### Fora de Escopo
- Ciclo de vida da assinatura em si (status, trial, carência) — ver `subscription-lifecycle.spec.md`
- Integração com gateway de pagamento (PIX, webhooks) — ver `multi-provider-payments.spec.md`
- Faturamento por `BillingSchedule` (modelo Prisma) — sem use case
- UI de manual-review do DLQ (TODO no código)

---

## Critérios de Aceitação (ACs)

| ID | Critério | Verificação |
|----|----------|-------------|
| AC1 | `CreateInvoiceForSubscriptionUseCase.execute()` (sem input) busca `findActiveByNextBillingBefore(now)` e retorna `{ created, skipped, errors }` | `__tests__/application/usecases/create-invoice-for-subscription.usecase.test.ts`, `__tests__/integration/recurring-billing-flow.test.ts` |
| AC2 | **Idempotência**: se já existe invoice para a assinatura no `referenceMonth` (`getReferenceMonth(nextBilling)` = `YYYY-MM`), o mês é pulado (`skipped++`) — teste de chamada dupla | `recurring-billing-flow.test.ts` — "skip when invoice already exists for the reference month" |
| AC3 | Invoice criado é `PENDING`, com `subscriptionId`, `amount = sub.amount`, `dueDate = sub.nextBilling`, `description = "${plan} - ${refMonth}"` | `create-invoice-for-subscription.usecase.test.ts` |
| AC4 | Após criar o invoice, `nextBilling` da assinatura é avançado via `calculateNextBilling` | `recurring-billing-flow.test.ts` — "create invoice, update nextBilling, and publish event" |
| AC5 | Evento `subscription.invoice.created` é publicado com `invoiceId`, `subscriptionId`, `refMonth`, `amount` | `recurring-billing-flow.test.ts`, `auto-pay.handler.test.ts` |
| AC6 | `RecurringInvoiceWorker` registra job repetido diário `0 2 * * *` na fila `recurring-invoices`, remove repetições antigas, e executa o use case no job `generate-recurring-invoices` | `infrastructure/queue/recurring-invoice.worker.ts` |
| AC7 | `AutoPayHandler` (evento `subscription.invoice.created`): se `ProcessPaymentUseCase` retorna sucesso → chama `RenewSubscriptionUseCase`; se falha (business error) → loga `warn` e **não** renova (invoice fica PENDING para pagamento manual) | `auto-pay.handler.test.ts` — sucesso e falha |
| AC8 | Erros lançados (transient) dentro de `AutoPayHandler` propagam para `handleWithRetry` (retry exponencial → DLQ) | `auto-pay.handler.test.ts` — "propagate thrown errors" |
| AC9 | `AutoRenewSubscriptionUseCase` + worker (`auto-renew`, cron `0 5 * * *`) renova assinaturas com `nextBilling` no dia e cria invoice de renovação (+7d) | `auto-renew-subscription.usecase.test.ts`, `__tests__/infrastructure/auto-renew.worker.test.ts` |
| AC10 | `findExistingForSubscription(subscriptionId, referenceMonth)` existe no `InvoiceRepositoryPort` e é usado como gate de idempotência | `application/ports/repositories/invoice.repository.port.ts` |
| AC11 | Worker loga `[RecurringInvoice] Created/Skipped/Errors` e trata falha por assinatura sem derrubar o job inteiro (try/catch por iteração) | `create-invoice-for-subscription.usecase.ts` (loop com try/catch), `recurring-invoice.worker.ts` |

---

## Contratos entre Camadas

### Application

```typescript
// application/usecases/create-invoice-for-subscription.usecase.ts
export interface RecurringInvoiceResult {
  created: number;
  skipped: number;
  errors: number;
}

export class CreateInvoiceForSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
    private readonly eventBus: EventBusPort,
  ) {}

  async execute(): Promise<RecurringInvoiceResult>;
}
```

Algoritmo (as-is):
1. `subscriptions = await subscriptionRepo.findActiveByNextBillingBefore(now)`
2. para cada sub:
   - `refMonth = getReferenceMonth(sub.nextBilling)`
   - se `invoiceRepo.findExistingForSubscription(sub.id, refMonth)` → `skipped++`
   - se client não existe → `errors++`
   - cria invoice `PENDING` com `subscriptionId`, `dueDate = sub.nextBilling`
   - `invoiceRepo.create(invoice)`
   - `subscriptionRepo.update(sub.id, { nextBilling: calculateNextBilling(...) })`
   - publica `subscription.invoice.created`
   - `created++`
3. erro por sub → `errors++` (job não falha)

```typescript
// application/ports/repositories/invoice.repository.port.ts (extra)
findExistingForSubscription(subscriptionId: string, referenceMonth: string): Promise<Invoice | null>;
```

```typescript
// application/events/handlers/auto-pay.handler.ts
export class AutoPayHandler extends RetryableWebhookHandler {
  constructor(
    private readonly processPayment: ProcessPaymentUseCase,
    private readonly renewSubscription: RenewSubscriptionUseCase,
    dlqPort?: DLQPort,
  ) {}
  getEventType(): string; // 'subscription.invoice.created'
  async handle(event: DomainEvent): Promise<void>;
}
```

Comportamento do `handle` (as-is):
- ignora se `!event.invoiceId || !event.metadata?.subscriptionId`
- `processPayment.execute({ invoiceId, tenantId })`
  - sucesso → log `[AutoPay] ... auto-paid` + `renewSubscription.execute({ subscriptionId, tenantId })`
  - falha (business) → `console.warn`, não renova, não lança (sem retry)

### Infrastructure

```typescript
// infrastructure/queue/recurring-invoice.worker.ts
createRecurringInvoiceQueue(): Queue                    // fila 'recurring-invoices'
scheduleRecurringInvoiceJob(queue): Promise<void>       // remove repeatable antigos; add job 'generate-recurring-invoices' com repeat '0 2 * * *'
startRecurringInvoiceWorker(useCase): Worker            // executa useCase.execute() no job

// infrastructure/queue/auto-renew.worker.ts
createAutoRenewQueue(): Queue                           // fila 'auto-renew'
scheduleAutoRenewJob(queue): Promise<void>              // repeat '0 5 * * *'
renewDueSubscriptions(useCase, subscriptionRepo): Promise<{ renewed, skipped, total }>
startAutoRenewWorker(useCase, subscriptionRepo): Worker
```

Fila compartilhada (definições) — `infrastructure/queue/queue-definitions.ts`:
```typescript
export const QueueNames = {
  RECONCILE_PAYMENT: 'reconcile-payment',
  SEND_NOTIFICATION: 'send-notification',
  PROCESS_WEBHOOK: 'process-webhook',
  SEND_MESSAGE: 'send-message',
  REMINDERS: 'reminders',
  FAILED_WEBHOOKS: 'failed-webhooks',   // DLQ
} as const;
// DEFAULT_JOB_OPTIONS: attempts=3, backoff exponencial 1s, removeOnComplete 1d/100, removeOnFail 7d
// DLQ_JOB_OPTIONS: attempts=1 (retry é in-process via RetryableWebhookHandler)
```

Wiring no bootstrap (`src/index.ts`):
- `scheduleRecurringInvoiceJob` + `startRecurringInvoiceWorker(createRecurringInvoiceUseCase())`
- `scheduleAutoRenewJob` + `startAutoRenewWorker(autoRenewUseCase, subscriptionRepo)`
- `registerEventHandlers` assina `subscription.invoice.created` → `autoPay.handleWithRetry`

### Presentation
- Sem endpoint HTTP dedicado (processamento em background). Pagamento manual de invoice PENDING via fluxo PIX (`POST /api/invoices/:id/pix-charge` — ver multi-provider spec).

---

## Requisitos Não-Funcionais

| ID | Requisito | Detalhe |
|----|-----------|---------|
| NFR1 | Idempotência | Falha de rede/replay não pode gerar invoice duplicado por mês de referência |
| NFR2 | Resiliência de worker | Falha em uma assinatura não derruba o job (per-subscription try/catch) |
| NFR3 | Retry/DLQ | Handlers retry com backoff exponencial (3 tentativas, `handleWithRetry`); DLQ `failed-webhooks` para inspeção manual + alerta (`AlertService.alertWebhookDrained`) |
| NFR4 | Latência | Geração e auto-pay são assíncronos — nunca bloqueiam request HTTP |

---

## Design Patterns Declarados Explicitamente

| Padrão | Onde Aplicado | Justificativa |
|--------|---------------|---------------|
| **Observer / Domain Events** | `subscription.invoice.created` → `AutoPayHandler` | Cobrança automática desacoplada da geração do invoice |
| **Queue/Worker (BullMQ)** | `recurring-invoices`, `auto-renew`, `failed-webhooks` | Trabalho em background com retry, cron e DLQ |
| **Idempotency key** | `referenceMonth` (YYYY-MM) por `subscriptionId` | Garante uma invoice por mês mesmo com reprocessamento |
| **DLQ pattern** | `BullMQDLQPublisher` + `startDeadLetterWorker` | Preservação de eventos falhos para revisão manual |

---

## Definition of Done

- [ ] AC1–AC11 cobertos por testes automatizados (ver coluna de verificação)
- [ ] Teste de integração `__tests__/integration/recurring-billing-flow.test.ts` verde (cobre criação, idempotência, auto-pay sucesso/falha, lifecycle)
- [ ] Workers registrados e agendados no bootstrap com graceful shutdown (`SIGINT`/`SIGTERM`)

---

## Rastreabilidade (AC → Testes)

| AC | Teste |
|----|-------|
| AC1, AC3, AC4 | `create-invoice-for-subscription.usecase.test.ts` |
| AC2 | `__tests__/integration/recurring-billing-flow.test.ts` ("idempotency") |
| AC5 | `auto-pay.handler.test.ts`, `recurring-billing-flow.test.ts` |
| AC6 | `infrastructure/queue/recurring-invoice.worker.ts` (impl); cobertura indireta em `recurring-billing-flow.test.ts` |
| AC7 | `auto-pay.handler.test.ts` (sucesso e falha), `recurring-billing-flow.test.ts` (AutoPayHandler success/failure) |
| AC8 | `auto-pay.handler.test.ts` (propagate thrown errors), `__tests__/events/retryable-webhook-handler.test.ts` |
| AC9 | `auto-renew-subscription.usecase.test.ts`, `__tests__/infrastructure/auto-renew.worker.test.ts` |
| AC10 | `__tests__/application/ports/repositories.test.ts` (contract) |
| AC11 | impl (per-subscription try/catch); logs verificados nos testes de worker |
