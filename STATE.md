# STATE — Pós-inicialização do projeto (fora de sprint formal)

## Ticket atual
Delivery commit da **auditoria multi-wave + correções** (Wave 1 security, Wave 2 event-bus/IdGeneratorPort/multi-provider/enum, Wave 3 versão/logger/dados/órfãos, P3 hygiene, docs/specs, pareceres) CONCLUÍDA e commitada. Backend **1104/115 arquivos**, frontend **258/25**. `tsc --noEmit` 0 erros ambos; biome 0 erros nos arquivos tocados nesta entrega (11 erros pré-existentes em tooling/`get-tenant.ts`/`smoke.test.ts` preservados como estão); `grep query.tenantId` em `apps/backend/src` → 0; arch test `dependency-rule.test.ts` 1/1 PASS (0 imports app→infra).

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
1. ~~`env.ts` mantém MASTER_API_KEY com default fail-open~~ — **RESOLVIDO nesta sessão**: `env.ts` exige `MASTER_API_KEY: z.string().min(1)` (fail-closed como JWT_SECRET e ASAAS_API_KEY); documentado em `specs/security.spec.md` (Env fail-closed contracts).
2. `reminder.service.ts:103` `clientRepo.findById(invoice.clientId)` sem tenantId — defense in depth (fatura já é do tenant; escopar o client lookup elimina o raciocínio multi-tenant na cadeia) — segue no backlog v0.13.0+.

Decisões de negócio desta sessão (não reabrir sem evidência nova):
- `GET /api/tenants` removida em vez de role-gated — frontend nunca consumiu (settings usa `/api/tenants/:id/payment-provider` com id próprio).
- 403 imediato em id ≠ tenantId (não vaza existência de tenant); 2 testes pré-existentes ajustados 404→403.
- `JWT_SECRET: z.string().min(1)` (não `.min(32)`) porque CI usa secrets curtos (`ci-test-secret`).
- Auth plugin lê `process.env.JWT_SECRET` em request-time (padrão dos testes mantém; `tenant-signup.test.ts` seta a env pós-import).
- Tests novos: `__tests__/security/auth-plugin.test.ts` (6), `__tests__/security/tenant-isolation.test.ts` (14); atualizados: rate-limiting, tenant.routes, tenant-signup, reminder.service, client/invoice/subscription.routes.
- Journey tooling commitado como test tooling: `scripts/user-journey-full.mjs`, `scripts/user-journey-security.mjs`.
- Webhook NÃO tocado (HMAC per-tenant preservado). `depcruise` não configurado no repo.

## Auditoria multi-wave + correções — entregue e commitada (novo baseline)
Commit de consolidação com todo o batch (1104 backend / 258 frontend). Waves documentadas no commit message e nos pareceres em `pareceres/audit-multiwave-corrections.md`.

- **Wave 1 (security)**: `MASTER_API_KEY`/`ASAAS_API_KEY` fail-closed em `env.ts` (`.min(1)`, sem default — boot quebra sem env); webhook Evolution fail-closed (`!expectedKey ||` → 401) + allowlist de IPs `EVOLUTION_ALLOWED_IPS` (401 `IP not allowed`, aplicada além da key); `tenantId` removido da querystring em **todas** as rotas (grep `query.tenantId` = 0; JWT `request.tenantId` autoritativo), incluindo schemas OpenAPI mortos removidos (invoice/reminder/report/subscription/client); `MERCADOPAGO_WEBHOOK_SECRET` → `MERCADO_PAGO_WEBHOOK_SECRET` (nomenclatura unificada, `hmac-verifier.ts` A4) com teste de contrato `env-contract.test.ts` sincronizando `envSchema` ↔ `.env.example`; `reminder.service.ts` escopa lookup de client por tenant (SEC-10, `findById(invoice.clientId, tenantId)`).
- **Wave 2 (funcional P0)**: event bus compartilhado — `getEventBus()` singleton module-level (`in-memory-event-bus.ts`) para factories/composition root usarem a MESMA instância (eventos chegam aos handlers registrados; `integration/event-bus-wiring.test.ts`); `IdGeneratorPort` (`domain/ports/id-generator.port.ts`) injetado em services — **0 imports app→infra** (arch test `dependency-rule.test.ts` valida); `PaymentGatewayResolverPort` (`resolveForTenant`/`resolveForTenantAndProvider`) + `PaymentProviderFactory implements` — `ProcessPaymentUseCase` desacoplado do Asaas hardcoded, resolve per-tenant (fallback env Asaas), gravando `provider` = gateway realmente usado; enum `PaymentProvider` canônico lowercase em `domain/contracts/enums.ts` (`asaas`/`mercadopago`/`stripe`/`pagbank`/`polar`) + migration A3 `lower()` idempotente + normalização `toLowerCase()` em `tenant.ts`.
- **Wave 3 (hygiene)**: fonte única de versão (`config/version.ts` + `lib/version.ts`, lido do `npm_package_version`/tag `v0.12.0` — remove o `0.8.0` hardcoded do OpenAPI/health e o `0.1.0` dos package.json base); pino `logger` nos workers de fila (substituiu `console.log`); migration `20260807120000_add_missing_indexes` (invoices.subscriptionId, subscriptions.nextBilling, tenants.email — DATA-12); seed `upsert` idempotente + `PaymentProviderConfig` do tenant demo; **8 componentes órfãos front-end deletados** (`client-detail-card`, `collection-timeline`, `exception-panel`, `kanban-board`, `message-tracking`, `notification-banner`, `onboarding-wizard`, `payment-history` + `index.ts` + 7 testes órfãos — ver parecer creative); invoice-form sem nested-button (`RiskBadge` que renderiza `<button>` dentro de `<button>` do listbox → `Badge` plano) — fix de flake.
- **P3 hygiene**: `levelToVariant`/`levelLabel` exportados no `risk-badge.tsx` (uso direto com `Badge` no dropdown); versão na Sidebar via `VERSION` do `lib/version.ts`.
- **Docs/specs**: `specs/multi-provider-payments.spec.md` (AC4/AC9/AC15 → Port F2 + enum lowercase), `specs/security.spec.md` (Env fail-closed contracts + EVOLUTION_ALLOWED_IPS), `README.md` (tabela env, stack, release notes v0.10–12), `docs/sprint` corrigido; backlog registrado na seção abaixo.
- **Pareceres desta auditoria** (chain completo registrado em `pareceres/`): `security-wave1-rereview.md` (security-specialist APROVADO COM RESSALVAS + tech-nucleus) e `audit-multiwave-corrections.md` (tech-nucleus APROVADO COM RESSALVAS, creative-nucleus APROVADO, compliance APROVADO COM RESSALVAS — 6 itens de autocorreção marcados EXECUTADOS).

## Autocorreção batch (pareceres tech + creative nucleus) — commitado nesta consolidação
- OpenAPI drift: `POST /api/tenants` agora `security: []` + `description: 'Público — signup sem autenticação'` (era `[{bearerAuth}]` num endpoint público de verdade). Novo `__tests__/routes/tenant-openapi.test.ts` (2) valida o doc OpenAPI via `app.swagger()`. Comportamento de auth intocado.
- E3 negativo (regression locks): `tenant-isolation.test.ts` +2 — role 'user' `PUT /payment-provider` e `PUT /decision-config` → 403. O guard `!isOwnTenant || !isOwner` já bloqueava ambos (verde de primeira — confirma o parecer).
- Drawer mobile a11y (`sidebar.tsx`): P2-1 foco entra no dialog ao abrir / retorna ao hamburger ao fechar (Escape, backdrop, X, nav link) + focus trap (Tab/Shift+Tab cicla); P2-2 backdrop virou `<div role="presentation" aria-hidden>` (não-focável, fora da tab order); P3 hamburger `aria-expanded`/`aria-controls`, dialog `id="mobile-menu-dialog"`, `tabIndex={-1}`, body scroll bloqueado. +7 testes em `sidebar.test.tsx`.
- Register (`register/page.tsx`): `autocomplete` org/email/off; botão "Criando conta..." + disabled durante submit (estado `submitting` já existia). +2 testes.
- error-state/empty-state h3→h2: **NÃO alterado** — decisão do parecer (padrão pré-existente, 10+ call sites heterogêneos, não riscar o escopo; SKIP explícito permitido).

## Pareceres já emitidos (não repita a consulta)
- security-specialist (re-auditoria): **APPROVED WITH FINDINGS** — 2 findings não-bloqueantes registrados como tech debt acima.
- Cadeia de 3 pareceres de governança registrada em `pareceres/security-hardening-signup-journey.md`:
  1. **tech-nucleus-lead** — APROVADO COM RESSALVAS (2 findings low + instrução de autocorreção: OpenAPI drift, gap E3, contagem, demo mode).
  2. **creative-nucleus-lead** — APROVADO COM RESSALVAS (2 findings P2 a11y no drawer + 7 P3; autocorreção P2 implementada no batch).
  3. **compliance-auditor** — APROVADO COM RESSALVAS (1 finding média: signup sem AC de spec; instrução de autocorreção executada nesta consolidação).
- Veredicto consolidado: **APROVADO COM RESSALVAS** (todos não-bloqueantes) — entrega pode prosseguir ao parecer final do CEO.
- Auditoria multi-wave desta entrega (pareceres em `pareceres/security-wave1-rereview.md` + `pareceres/audit-multiwave-corrections.md`):
  1. **security-specialist (re-auditoria Wave 1)** — APROVADO COM RESSALVAS (0 findings novos; 3 residuais não-bloqueantes: README EVOLUTION_API_KEY doc-vs-schema — corrigido; dead querystring schemas — removidos na consolidação; nota trustProxy/documentação).
  2. **tech-nucleus-lead** — APROVADO COM RESSALVAS (7 findings P3; 6 executáveis implementados, 1 posicionado no backlog — ver parecer).
  3. **creative-nucleus-lead** — APROVADO (deleção de órfãos segura; nested-button fix; componentes mantidos justificados).
  4. **compliance-auditor** — APROVADO COM RESSALVAS (checklist SDD/TDD/Secure-by-Design/DoD; 6 itens de autocorreção marcados EXECUTADOS com evidência — ver parecer).

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

## Backlog v0.13.0+ (registrado na auditoria completa)

> Itens deferidos deliberadamente durante a auditoria/autocorreção — fora do escopo desta sessão (doc-only). Cada item com rationale de uma linha; prontos para virar tickets no planejamento do v0.13.0.

| Item | Rationale |
|------|-----------|
| Next.js 14 → 16 upgrade | 9 HIGH CVEs no Next 14 (supply-chain/SSRF/RCE recentes) |
| Cookie httpOnly auth + CSP no frontend | JWT em localStorage é roubável via XSS; httpOnly + CSP mitiga na borda |
| Asaas real API calls (COD-16) | PIX hoje simulado em testes (factory injetável); ligar SDK real + contract tests |
| `/billing` real (pix-payment-flow + invoice-form + `POST /api/invoices/:id/pix-charge`) | página atual é mock estático; sem o POST não existe cobrança de verdade |
| Error envelope A7 (~80 pontos) | envelope `{error:{code,message,details}}` não é uniforme em ~80 call sites |
| `@agiliza/shared` package (ARCH-16) | dependência invertida: frontend importa de `apps/backend/src`; shared deve ser a borda do contrato |
| Onboarding persistence (in-memory) | `StartOnboardingHandler`/service guardam estado em memória — perde no restart; precisa de store |
| UoW wiring (create-invoice + payment transacional) | `create-invoice` + `create-payment` não são transacionais (Unit of Work não conectado) |
| Depcruise config (arch fitness function) | README/CI citam depcruise mas o repo não tem config — gate de arquitetura sem execução real |
| docs/sprint references cleanup | README/tabela de releases com claims obsoletas (contagens de teste, gateways) |
| README EVOLUTION_API_KEY doc-vs-schema mismatch | doc dizia "sem default"; schema é `default('')` com fail-closed na rota — corrigido nesta sessão; item mantido como lembrete de verificação pós-merge |
| webhook.test.ts:419 simulated allowlist test | teste mocka a rota em vez de asserts na rota real — substituir por teste real de rota |
| Unit tests p/ 6 list/read usecases | use cases de leitura sem suite própria (cobertura via rotas apenas) |
| E2E duplication | `e2e/` e `scripts/user-journey-*` duplicam gatilhos — consolidar |

## Próximo passo assim que retomar
1. Sprint v0.13.0 formal a definir — backlog acima já registrado; tech debt (a) MASTER_API_KEY fail-closed **implementado**, (b) escopo tenant no client lookup de `reminder.service.ts` segue no backlog.
2. Validar build Docker do FRONTEND (pendente de sessão anterior — mesmo padrão de contexto do backend, mas tem o npm ci do frontend + next build).
3. Follow-ups opcionais antigos: (a) endpoint de message templates; (b) GET /api/clients/:id deveria retornar ClientProfile com clientRiskScore.
