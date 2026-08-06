# STATE — Pós-inicialização do projeto (fora de sprint formal)

## Ticket atual
Nenhum ticket em loop — sessão de "iniciar o projeto + validar telas + corrigir infra Docker" concluída (commits 14e75d1, 1001658, 7e02299, 395e66e).

## Bloqueios ativos
Nenhum.

## Pareceres já emitidos (não repita a consulta)
Nenhum parecer formal emitido nesta sessão (correções de runtime + UI + infra, sem ciclo de feature).

## Últimas decisões (não repita a pergunta)
- RiskScore: canonical wire/storage = ClientRiskScore GREEN/YELLOW/RED; RiskLevel (LOW/MEDIUM/HIGH/CRITICAL) é refinamento interno de domínio; CRITICAL colapsa em RED na fronteira. Mapeamento vive no VO (fromClientRiskScore + clientRiskScore getter). Spec: specs/frontend-ui-consistency-corrections.spec.md
- Migration aditiva 20260805003801_add_subscription_trial_grace aplicada (drift: subscriptions.trialDays/gracePeriodDays/trialEndsAt/gracePeriodEndsAt/autoRenew + payment_provider_configs.environment estavam no schema mas nunca migrados).
- Backend roda via systemd --user: `systemctl --user status/restart agiliza-backend` (logs: journalctl --user -u agiliza-backend -f). Frontend: `agiliza-frontend`. (Nota: units são transientes — sobrevivem entre sessões mas NÃO persistem reboot; para boot-persistência seria preciso unit files reais + enable.)
- Frontend: sidebar 7 itens (Mensagens/templates removido — sem API de templates); páginas novas: clients, invoices, reminders; getTenantId() em src/lib/tenant.ts; settings usa GET/PUT /api/tenants/:id/payment-provider (não payment-config).
- Billing page é mock estático (PIX checkout); Lembretes vazio por design (EmptyState).

## Decisões de infra Docker (commit 7e02299 + 395e66e)
- docker-compose.dev.yml: serviço `evolution-api` REMOVIDO — a imagem `atendai/evolution-api:latest` não existe no registro (quebrava `up -d` inteiro). WhatsApp é opcional no dev (default EVOLUTION_API_URL=http://localhost:8080); compose de e2e/prod já não o incluíam. Se um dia houver imagem válida, re-adicionar via `--profile whatsapp`.
- docker-compose.dev.yml: atributo `version: "3.8"` removido (obsoleto).
- docker-compose.dev.yml: build context dos serviços backend/frontend corrigido de `../apps/backend` → `..` + `dockerfile: apps/*/Dockerfile` (Dockerfiles do monorepo exigem raiz como contexto — mesmo padrão do CI/CD cd.yml).
- apps/backend/Dockerfile: copia `apps/backend/node_modules` explicitamente (root cause do build fail: `@fastify/helmet` não é hoisted ao node_modules raiz no container — fica em apps/backend/node_modules); `prisma generate --schema=src/infrastructure/database/prisma/schema.prisma` explícito (schema em path não-padrão); removido COPY .prisma separado (agora coberto pelo copy de node_modules).
- .dockerignore na raiz criado (exclui node_modules/**.node_modules/.git/dist/.next/coverage/.env/e2e/*.md etc. do contexto de build — evita artefatos glibc do host entrarem na imagem Alpine).
- Build Docker do backend VERIFICADO: `docker compose -f docker/docker-compose.dev.yml build backend` → sucesso (imagem docker-backend:latest).

## Próximo passo assim que retomar
1. Validar build Docker do FRONTEND (ficou pendente — não verificado após o fix do backend; mesmo padrão de contexto, mas tem o npm ci do frontend + next build).
2. Follow-ups opcionais: (a) endpoint de message templates para re-adicionar página Mensagens; (b) GET /api/clients/:id deveria retornar ClientProfile com clientRiskScore em vez do raw entity (toJSON {level:'LOW'}) — decisão de spec pendente; (c) sprint formal seguinte (v0.13.0) a definir.
