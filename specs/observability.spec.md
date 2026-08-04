# Spec: Observability — Logging Estruturado, Métricas Prometheus, Alertas Slack, Health/Ready

> Status: **Implementado (Sprint 9–11)** — spec backfill. Contratos extraídos do código atual.
> Fonte: `apps/backend/src/{config/logger.ts, infrastructure/observability/metrics.ts, infrastructure/plugins/observability.plugin.ts, infrastructure/alerting, application/services/alert.service.ts, routes/health.routes.ts}`.

## Contexto de Negócio

Para operar o Agiliza de forma confiável é preciso **observar** o sistema em produção: logs estruturados por request, métricas Prometheus (`/metrics`) para dashboards Grafana, alertas proativos (falha de pagamento, DLQ drenado, rate limit) via Slack, e endpoints de liveness/readiness para orquestradores (K8s/Docker/health checks). Tudo isso sem afetar a latência dos requests.

---

## Escopo

### Incluído
- Logger estruturado **pino** (`config/logger.ts`) com serializers req/res/err e pino-pretty em dev
- Registro de métricas **prom-client** (`infrastructure/observability/metrics.ts`): `http_request_duration_seconds`, `http_requests_total`, `active_subscriptions`, `invoices_created_total` + métricas default com prefixo `agiliza_`
- `ObservabilityPlugin` (Fastify): hooks `onRequest`/`onResponse` (startTime, duration), log por request, registro de métricas, endpoint `GET /metrics`
- `AlertChannelPort` + `SlackAlertChannel` (webhook URL, cores por severidade)
- `AlertService`: `alertPaymentFailed`, `alertWebhookDrained`, `alertRateLimitHits` (threshold)
- Handlers/workers de alerta: `AlertOnPaymentFailedHandler` (evento `payment.failed`), `startDeadLetterWorker` (DLQ drenado)
- Health/Ready: `GET /api/health`, `GET /api/ready` (verifica DB e Redis)

### Fora de Escopo
- Dashboards Grafana em si (JSON de provisioning — fora deste repo/backfill)
- Distributed tracing (OpenTelemetry) — não implementado
- Métricas de negócio avançadas (MRR por métrica Prometheus) — apenas `active_subscriptions` e `invoices_created_total` existem

---

## Critérios de Aceitação (ACs)

| ID | Critério | Verificação |
|----|----------|-------------|
| AC1 | Logger pino: nível por `LOG_LEVEL`/env (`info` prod, `debug` dev), serializers `req`/`res`/`err` | `config/logger.ts`, `__tests__/security/audit-logging.test.ts` |
| AC2 | Métricas custom registradas com prefixo `agiliza_`: `agiliza_http_request_duration_seconds` (histogram, buckets 0.01..5s, labels method/route/status_code), `agiliza_http_requests_total` (counter), `agiliza_active_subscriptions` (gauge), `agiliza_invoices_created_total` (counter) | `infrastructure/observability/metrics.ts` |
| AC3 | `ObservabilityPlugin` registra `startTime` no `onRequest`; no `onResponse` loga `{method, url, statusCode, durationMs}` e observa histograma/counter | `observability.plugin.ts` |
| AC4 | `GET /metrics` retorna texto Prometheus com `Content-Type` correto (`registry.contentType`) e rate limit próprio 1000/min | `observability.plugin.ts`, `__tests__/e2e/health.e2e.test.ts` |
| AC5 | `AlertChannelPort.sendAlert(alert)` com `{title, message, severity: info\|warning\|critical, metadata?}`; `SlackAlertChannel` faz POST no webhook com attachment colorido (danger/warning/good) e **no-op silencioso** se URL não configurada | `alert-channel.port.ts`, `slack-alert.channel.ts`, `__tests__/unit/alerting/slack-alert.channel.test.ts` |
| AC6 | `AlertService.alertPaymentFailed` (warning), `alertWebhookDrained` (critical), `alertRateLimitHits` (critical, só se `count > 10`) | `alert.service.ts`, `__tests__/unit/alerting/alert.service.test.ts` |
| AC7 | `AlertOnPaymentFailedHandler` reage somente a `payment.failed` e chama `alertPaymentFailed` com invoice/tenant/client/reason | `alert-on-payment-failed.handler.test.ts` |
| AC8 | `startDeadLetterWorker` consome `failed-webhooks` (DLQ), loga erro e chama `alertWebhookDrained` | `dead-letter.worker.ts`, `__tests__/events/event-bus.integration.test.ts` |
| AC9 | `GET /api/health` (público, rate limit alto 1000/min) retorna `{status:'ok', timestamp, uptime, version}` — sem dados sensíveis | `health.routes.ts`, `__tests__/e2e/health.e2e.test.ts`, `__tests__/security/auth.test.ts` |
| AC10 | `GET /api/ready` verifica `SELECT 1` no Postgres e `PING` no Redis; retorna `{status:'ok'\|'degraded', checks:{database, redis}}` | `health.routes.ts`, `__tests__/e2e/health.e2e.test.ts` |
| AC11 | Registro de plugins no bootstrap: observability antes do auth (startTime em todo request), error handler global depois das rotas | `src/index.ts` |
| AC12 | Logs não vazam PII/segredos (máscara de CPF/telefone/e-mail; nunca loga API keys; sem stack trace em prod) | `__tests__/security/audit-logging.test.ts` |

---

## Contratos entre Camadas

### Application

```typescript
// application/ports/gateways/alert-channel.port.ts
export interface AlertMessage {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface AlertChannelPort {
  sendAlert(alert: AlertMessage): Promise<void>;
}

// application/services/alert.service.ts
export class AlertService {
  constructor(channel: AlertChannelPort) {}
  alertPaymentFailed(metadata: Record<string, unknown>): Promise<void>;   // warning — '⚠️ Payment Failed'
  alertWebhookDrained(metadata: Record<string, unknown>): Promise<void>;  // critical — '🔥 Webhook Failed (DLQ)'
  alertRateLimitHits(tenantId: string, count: number): Promise<void>;     // critical — '🚨 High Rate Limit Activity' (threshold count > 10)
}

// application/events/handlers/alert-on-payment-failed.handler.ts
export class AlertOnPaymentFailedHandler {
  constructor(alertService: AlertService) {}
  handle(event: DomainEvent): Promise<void>; // no-op se eventType !== 'payment.failed'
}
```

### Infrastructure

```typescript
// infrastructure/alerting/slack-alert.channel.ts
export class SlackAlertChannel implements AlertChannelPort {
  constructor(webhookUrl?: string); // fallback process.env.SLACK_WEBHOOK_URL
  sendAlert(alert: AlertMessage): Promise<void>; // POST attachment; no-op se sem URL
}

// infrastructure/observability/metrics.ts
export const httpRequestDuration: promClient.Histogram; // agiliza_http_request_duration_seconds
export const httpRequestsTotal: promClient.Counter;     // agiliza_http_requests_total
export const activeSubscriptionsGauge: promClient.Gauge;  // agiliza_active_subscriptions
export const totalInvoicesCreated: promClient.Counter;  // agiliza_invoices_created_total
export function getMetrics(): Promise<string>;
export function getMetricsContentType(): Promise<string>;

// infrastructure/plugins/observability.plugin.ts (fastify-plugin)
// hooks onRequest/onResponse + GET /metrics (rateLimit 1000/min)

// infrastructure/queue/dead-letter.worker.ts
export function startDeadLetterWorker(alertService?: AlertService): Worker; // fila 'failed-webhooks' → alertWebhookDrained
```

### Presentation

`routes/health.routes.ts`:

| Rota | Público | Resposta |
|------|---------|----------|
| `GET /api/health` | sim (auth-plugin ignora) | `{status:'ok', timestamp, uptime, version:'0.8.0'}` |
| `GET /api/ready` | sim | `{status:'ok'\|'degraded', checks:{database, redis}}` (SELECT 1 + PING) |

`GET /metrics` (plugin observability) — público, rate limit 1000/min.

---

## Requisitos Não-Funcionais

| ID | Requisito | Detalhe |
|----|-----------|---------|
| NFR1 | Performance | Coleta de métricas via hooks não bloqueia resposta; `startTime` é decorado no request |
| NFR2 | Privacidade | Logs mascarados (CPF/phone/email); sem body/query params; sem secrets (`audit-logging.test.ts`) |
| NFR3 | Disponibilidade | Health endpoints com rate limit alto (1000/min) para nunca bloquearem monitoração |
| NFR4 | Escalabilidade de alertas | `AlertService` centraliza políticas; canais são Ports (trocar Slack = nova implementação de `AlertChannelPort`) |

---

## Design Patterns Declarados Explicitamente

| Padrão | Onde Aplicado | Justificativa |
|--------|---------------|---------------|
| **Strategy / Port** | `AlertChannelPort` + `SlackAlertChannel` | Canal de alerta intercambiável (Slack hoje; e-mail/PagerDuty amanhã) sem tocar no `AlertService` |
| **Observer** | evento `payment.failed` → `AlertOnPaymentFailedHandler`; DLQ → `startDeadLetterWorker` | Alerta desacoplado da origem do evento |
| **Plugin (Fastify)** | `observability.plugin.ts` | Instrumentação transversal (hooks) sem poluir handlers |
| **Facade de métricas** | `metrics.ts` (registry + métricas) | Ponto único de definição/leitura de métricas |

---

## Definition of Done

- [ ] AC1–AC12 cobertos por testes automatizados (ver coluna de verificação)
- [ ] `/metrics` expõe texto Prometheus válido; `/api/health` e `/api/ready` verdes em `__tests__/e2e/health.e2e.test.ts`
- [ ] Alertas configurados sem `SLACK_WEBHOOK_URL` fazem no-op (não quebram em dev)
- [ ] Zero violação de camada: `AlertService` (Application) não importa Slack; `SlackAlertChannel` (Infrastructure) implementa a Port

---

## Rastreabilidade (AC → Testes)

| AC | Teste |
|----|-------|
| AC1, AC12 | `__tests__/security/audit-logging.test.ts` |
| AC2–AC4 | impl em `metrics.ts`/`observability.plugin.ts`; `__tests__/e2e/health.e2e.test.ts` (metrics reachable) |
| AC5 | `__tests__/unit/alerting/slack-alert.channel.test.ts` |
| AC6 | `__tests__/unit/alerting/alert.service.test.ts` |
| AC7 | `__tests__/events/alert-on-payment-failed.handler.test.ts` |
| AC8 | `__tests__/events/event-bus.integration.test.ts`; impl `dead-letter.worker.ts` |
| AC9–AC10 | `__tests__/e2e/health.e2e.test.ts`, `__tests__/security/auth.test.ts` (health sem auth) |
| AC11 | `src/index.ts` (ordem de registro) |
