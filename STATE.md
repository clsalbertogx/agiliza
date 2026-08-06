# STATE — Pós-inicialização do projeto (fora de sprint formal)

## Ticket atual
Sessão de security fixes + correções de journey CONCLUÍDA e COMMITADA. Re-auditoria de segurança: **APPROVED WITH FINDINGS**. Journey Playwright: **66 PASS / 0 FAIL**. Working tree limpo.

## Bloqueios ativos
Nenhum.

## Sessão security fixes + journey — entregue e commitada
Commit: `fix(auth,frontend): security hardening + journey UX/data corrections` (inclui STATE.md; `apps/frontend/tsconfig.tsbuildinfo` removido do controle de versão — artefato de build já ignorado por `*.tsbuildinfo`).
Testes: backend **1059/102 arquivos** (baseline 1039/100, +20), frontend **438/33**. `tsc --noEmit` 0 erros ambos; biome 0 erros (15 warnings `noExplicitAny` pré-existentes); coverage 80.33% (threshold 70). Grep `'agiliza-dev-secret'` em src não-teste: 0.

- **E1 ApiKey**: `validateApiKey(apiKey, MASTER_API_KEY)` no ramo ApiKey do auth plugin; 401 se não bate; null-tenant só p/ chave válida.
- **E2 JWT secret**: fallback `'agiliza-dev-secret'` removido de `env.ts` (schema exportado `envSchema`, `JWT_SECRET` obrigatório `.min(1)`), auth plugin, `tenant.routes.ts` e `scripts/generate-token.ts`. `.env`/`.env.example` já tinham `JWT_SECRET`.
- **a1 Tenant isolation**: `GET /api/tenants` (lista sem escopo) REMOVIDA (frontend não usa); guards `isOwnTenant` (403 imediato, sem lookup) em GET/PATCH `/:id`, `/:id/config`, GET/PUT `/:id/payment-provider`, GET/PUT `/:id/decision-config`.
- **a2 Messages tracking**: `event.repository.ts findByIdRaw(id, tenantId?)` com `findFirst` + filtro; tracking passa `request.tenantId` → 404 p/ evento alheio.
- **a3 Reminders**: `invoice.repository.ts getInvoiceWithClientRaw(id, tenantId?)`; schedule + send-now verificam fatura do tenant (404); `reminder.service.sendReminderNow` usa `findById(invoiceId, tenantId)`.
- **E3 Role enforcement**: PATCH config / PUT payment-provider / PUT decision-config exigem `authPayload.role === 'owner'` (tokens emitidos hoje só são owner; multi-role = trabalho futuro, documentado em comentário).
- **d Rate limit**: `keyGenerator` global = `request.ip` (per-IP honesto — limiter roda no onRequest, antes do tenantId existir); `POST /api/tenants` com 20/min por IP.

Journey UX/data (validação 66 PASS / 0 FAIL em browser real):
- register grava `tenant_id` no localStorage + h1 real; `getTenantId()` sem fallback `'demo'`.
- `api.ts` ignora params null/undefined e extrai mensagens de erro reais do envelope backend.
- Validação uuid nos params `:id` (client/invoice/subscription/tenant) + guard UUID no `tenant.repository` (400 em vez de 500).
- risk/reports exibem `ErrorState` em vez de fallback demo/mock; settings guarda sessão sem tenantId.
- Drawer hamburger no mobile (`sidebar.tsx`, `dashboard/layout.tsx`).

**Tech debt registrado (2 findings não-bloqueantes do re-audit → próximo sprint):**
1. `env.ts` mantém MASTER_API_KEY com default fail-open (`'agiliza-dev-api-key-change-in-production'`) — alinhar a fail-closed como JWT_SECRET (exigir env, remover default).
2. `reminder.service.ts:103` `clientRepo.findById(invoice.clientId)` sem tenantId — defense in depth (fatura já é do tenant; escopar o client lookup elimina o raciocínio multi-tenant na cadeia).

Decisões de negócio desta sessão (não reabrir sem evidência nova):
- `GET /api/tenants` removida em vez de role-gated — frontend nunca consumiu (settings usa `/api/tenants/:id/payment-provider` com id próprio).
- 403 imediato em id ≠ tenantId (não vaza existência de tenant); 2 testes pré-existentes ajustados 404→403.
- `JWT_SECRET: z.string().min(1)` (não `.min(32)`) porque CI usa secrets curtos (`ci-test-secret`).
- Auth plugin lê `process.env.JWT_SECRET` em request-time (padrão dos testes mantém; `tenant-signup.test.ts` seta a env pós-import).
- Tests novos: `__tests__/security/auth-plugin.test.ts` (6), `__tests__/security/tenant-isolation.test.ts` (13); atualizados: rate-limiting, tenant.routes, tenant-signup, reminder.service, client/invoice/subscription.routes.
- Journey tooling commitado como test tooling: `scripts/user-journey-full.mjs`, `scripts/user-journey-security.mjs`.
- Webhook NÃO tocado (HMAC per-tenant preservado). `depcruise` não configurado no repo.

## Pareceres já emitidos (não repita a consulta)
- Re-auditoria de segurança (security-specialist): **APPROVED WITH FINDINGS** — 2 findings não-bloqueantes registrados como tech debt acima.
- Nenhum parecer formal de nucleus lead nesta sessão (correções de runtime + UI + infra, sem ciclo de feature).

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
1. Sprint v0.13.0 formal a definir; tech debt do re-audit entra no backlog: (a) MASTER_API_KEY fail-closed como JWT_SECRET; (b) escopo tenant no client lookup de `reminder.service.ts`.
2. Validar build Docker do FRONTEND (pendente de sessão anterior — mesmo padrão de contexto do backend, mas tem o npm ci do frontend + next build).
3. Follow-ups opcionais antigos: (a) endpoint de message templates; (b) GET /api/clients/:id deveria retornar ClientProfile com clientRiskScore.
