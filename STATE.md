# STATE — Pós-inicialização do projeto (fora de sprint formal)

## Ticket atual
Nenhum ticket em loop — sessão de "iniciar o projeto + validar telas" concluída (commit 14e75d1).

## Bloqueios ativos
Nenhum.

## Pareceres já emitidos (não repita a consulta)
Nenhum parecer formal emitido nesta sessão (correções de runtime + UI, sem ciclo de feature).

## Últimas decisões (não repita a pergunta)
- RiskScore: canonical wire/storage = ClientRiskScore GREEN/YELLOW/RED; RiskLevel (LOW/MEDIUM/HIGH/CRITICAL) é refinamento interno de domínio; CRITICAL colapsa em RED na fronteira. Mapeamento vive no VO (fromClientRiskScore + clientRiskScore getter). Spec: specs/frontend-ui-consistency-corrections.spec.md
- Migration aditiva 20260805003801_add_subscription_trial_grace aplicada (drift: subscriptions.trialDays/gracePeriodDays/trialEndsAt/gracePeriodEndsAt/autoRenew + payment_provider_configs.environment estavam no schema mas nunca migrados).
- Backend roda via systemd --user: `systemctl --user status/restart agiliza-backend` (logs: journalctl --user -u agiliza-backend -f). Frontend: `agiliza-frontend`.
- Frontend: sidebar 7 itens (Mensagens/templates removido — sem API de templates); páginas novas: clients, invoices, reminders; getTenantId() em src/lib/tenant.ts; settings usa GET/PUT /api/tenants/:id/payment-provider (não payment-config).
- Billing page é mock estático (PIX checkout); Lembretes vazio por design (EmptyState).

## Próximo passo assim que retomar
1. Avaliar gap de UX: dashboard mostra nomes de clientes resolvidos (feito); próximo candidato: rota de payment-provider tem 7 testes frontend que usam tenant demo — ok.
2. Follow-ups opcionais: (a) endpoint de message templates para re-adicionar página Mensagens; (b) GET /api/clients/:id deveria retornar ClientProfile com clientRiskScore em vez do raw entity (toJSON {level:'LOW'}) — decisão de spec pendente; (c) sprint formal seguinte (v0.13.0) a definir.
