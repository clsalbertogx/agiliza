# Specs — Agiliza (SDD)

Especificações de Spec-Driven Development do backend `apps/backend`. Cada spec define **contratos binários** entre Domain / Application / Infrastructure / Presentation, critérios de aceitação mensuráveis e rastreabilidade para testes automatizados.

## Índice

| Spec | Status | Sprints | Descrição |
|------|--------|---------|-----------|
| [`clean-architecture-refactor.spec.md`](./clean-architecture-refactor.spec.md) | Implementado | 3 | Separação Domain/Application/Infrastructure/Presentation, Either, Ports, EventBus, UnitOfWork, Strategy (gateway) e Observer (events) |
| [`subscription-lifecycle.spec.md`](./subscription-lifecycle.spec.md) | Implementado | 5–6 | Ciclo de vida de assinatura: create/cancel/pause/resume/expire/renew/upgrade/trial/grace/auto-renew, serviços de domínio (proration, grace, billing cycle) e eventos `subscription.*` |
| [`recurring-billing.spec.md`](./recurring-billing.spec.md) | Implementado | 6–7 | Geração automática de invoices recorrentes (idempotente por mês de referência), cron diário 02:00, `AutoPayHandler` e worker de auto-renew |
| [`multi-provider-payments.spec.md`](./multi-provider-payments.spec.md) | Implementado | 8–10 | 5 gateways (Asaas, Mercado Pago, Stripe, PagBank, Polar) sob `PaymentGatewayPort`, `PaymentProviderFactory` per-tenant, criptografia AES-256-GCM e webhooks com HMAC per-tenant |
| [`observability.spec.md`](./observability.spec.md) | Implementado | 9–11 | Logging pino, métricas Prometheus (`/metrics`), `AlertService` + Slack, endpoints `/api/health` e `/api/ready` |
| [`security.spec.md`](./security.spec.md) | Implementado | 10–11 | Auth JWT HMAC-SHA256 + ApiKey, Helmet, rate limiting, error handler 4 camadas, isolamento de tenant, verificação HMAC de webhooks |

## Convenção

- `Status: Implementado` — spec de **backfill** (documenta o que já está no código; contratos extraídos as-is)
- Specs futuras devem nascer antes da implementação e marcar `Status: Planejado`
- A rastreabilidade AC → teste aponta para arquivos em `apps/backend/src/__tests__/`
- Divergências entre código e design (ex: entity `Subscription` como funções puras vs. padrão class) estão anotadas dentro de cada spec — alterar exige ADR
