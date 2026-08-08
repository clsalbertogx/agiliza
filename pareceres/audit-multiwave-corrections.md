# Parecer — Auditoria multi-wave + correções (consolidação final da auditoria completa)

## 2026-08-07 — APROVADO COM RESSALVAS (não-bloqueante) — delivery commit

Cadeia de pareceres de governança da entrega que consolida as correções das 3 waves da
auditoria completa (security, funcional P0, hygiene/P3) + docs/specs + flake fixes.
Registrada em ordem: tech-nucleus-lead → creative-nucleus-lead → compliance-auditor.

---

## 1. Parecer do Tech Nucleus Lead

### Status: APROVADO COM RESSALVAS (não-bloqueante)

Estágio 1 (conformidade) e Estágio 2 (qualidade) aprovados. As correções das 3 waves
foram verificadas contra as evidências de teste/arquitetura; 7 findings P3 (todos de
prioridade baixa, não-bloqueantes) registrados, dos quais **6 executáveis foram
implementados nesta entrega** e **1 posição deferida para o backlog v0.13.0+**.

### Evidência verificada
- Suíte backend completa: **1104 tests / 115 files PASS** (inclui `architecture/dependency-rule.test.ts` 1/1 — 0 imports app→infra; `architecture/payment-provider-enum.test.ts`; `config/env-contract.test.ts`; `integration/event-bus-wiring.test.ts`; `integration/multi-provider-resolution.test.ts`; `routes/webhook.routes.test.ts`; `application/events/start-onboarding.handler.test.ts`).
- Suíte frontend completa: **258 tests / 25 files PASS**.
- `tsc --noEmit` 0 erros em backend e frontend; `biome check` 0 erros nos arquivos tocados nesta entrega (11 erros pré-existentes em tooling/`smoke.test.ts`/`get-tenant.ts` fora do escopo).
- Grep `query.tenantId` em `apps/backend/src` → **0 ocorrências** (handlers usam exclusivamente `request.tenantId` — JWT autoritativo; schemas OpenAPI mortos de querystring removidos na consolidação).
- Arch rule: `dependency-rule.test.ts` (1/1 PASS) — zero imports `application→infrastructure`.

### Findings P3 (7; 6 executáveis nesta entrega)

| # | P3 | Veredito | Evidência |
|---|---|---|---|
| 1 | **Single source of truth de versão** — OpenAPI/`health` hardcoded `0.8.0`, package.jsons `0.1.0`, sidebar `v0.12.0` | ✅ implementado | `src/config/version.ts` (lê `npm_package_version`, fallback `0.12.0`); `apps/frontend/src/lib/version.ts`; `index.ts` swagger `version: VERSION`; `health.routes.ts` idem; sidebar `Agiliza v{VERSION}`; package.jsons `0.12.0` |
| 2 | Worker/event-bus sem log estruturado (multiplicidade de `console.log`) | ✅ implementado | `logger` pino em `auto-renew.worker`, `dead-letter.worker`, `queue-manager`, `recurring-invoice.worker`, `redis.service`, `worker.ts`, `in-memory-event-bus.ts` (substituiu `console.*`) |
| 3 | Indexes ausentes detectados por auditoria de dados (DATA-12) | ✅ implementado | migration `20260807120000_add_missing_indexes` (`invoices(subscriptionId)`, `subscriptions(nextBilling)`, `tenants(email)`) — idempotente (`CREATE INDEX IF NOT EXISTS`) |
| 4 | Seed não-re-executável + shape canônico de config ausente | ✅ implementado | `prisma/seed.ts` → `upsert` idempotente + `PaymentProviderConfig` row do tenant demo (`tenantId_provider` unique) |
| 5 | 8 componentes frontend órfãos + testes órfãos (dead code) | ✅ implementado | 8 componentes deletados (`client-detail-card`, `collection-timeline`, `exception-panel`, `kanban-board`, `message-tracking`, `notification-banner`, `onboarding-wizard`, `payment-history`) + `components/index.ts` + 7 testes órfãos; ver parecer creative-nucleus (deleção segura) |
| 6 | HTML inválido: `<button>` dentro de `<button>` (RiskBadge no dropdown do listbox de invoices) + flake de teste | ✅ implementado | `invoice-form.tsx`: dropdown do cliente usa `<Badge>` plano (com `levelToVariant`/`levelLabel` exportados do `risk-badge.tsx`) em vez do `RiskBadge` interativo dentro do botão — elimina nested-button e flake |
| 7 | `ErrorState`/`EmptyState` com `<h3>` (salto h1→h3) — padrão pré-existente propagado | ◻ deferido (explícito) | Estado registrado em STATE.md (SKIP explícito permitido: 10+ call sites heterogêneos, não riscar escopo); revisitado no v0.13.0+ |

### Posições deferidas para o backlog v0.13.0+ (registradas em STATE.md e no commit)
- **Next.js 14 → 16 upgrade** (9 HIGH CVEs — supply-chain/SSRF/RCE recentes);
- **Cookie httpOnly auth + CSP no frontend** (JWT em localStorage roubável via XSS);
- **Asaas real API calls (COD-16)** — PIX hoje simulado; ligar SDK real + contract tests;
- **`/billing` real** (`pix-payment-flow` + `invoice-form` + `POST /api/invoices/:id/pix-charge`) — página atual mock estático;
- **Error envelope A7** — `{error:{code,message,details}}` não uniforme em ~80 call sites;
- **`@agiliza/shared`** (ARCH-16) — dependência invertida (frontend importa de `apps/backend/src`);
- **Onboarding persistence** — `StartOnboardingHandler`/service guardam estado em memória (perde no restart);
- **UoW wiring** — `create-invoice` + payment não transacionais;
- **Depcruise config** — README/CI citam depcruise mas repo não tem config (fitness function pendente);
- **Docs/sprint cleanup** — claims obsoletas na tabela de releases;
- **`webhook.test.ts:419` simulated allowlist test** — substituir por teste real de rota;
- **Unit tests p/ 6 list/read usecases** — cobertura apenas via rotas;
- **E2E duplication** — `e2e/` × `scripts/user-journey-*` consolidar.

### Strengths
- Wave 2 eliminou **0 imports app→infra** confirmado por teste de arquitetura (não por convenção).
- `PaymentGatewayResolverPort` mantém Domain/Application sem menção ao provedor específico; envio de `provider` no payload reflete o gateway **realmente usado**.
- Enum único lowercase + migration A3 idempotente cobre storage legado sem break de contrato.
- `npm_package_version` como fonte única elimina os 3 hardcodes de versão sem custo de build.

---

## 2. Parecer do Creative Nucleus Lead

### Status: APROVADO (sem ressalvas bloqueantes)
Método: avaliação estática do diff de UI/UX + teste de componentes (browser validado nas
sessões anteriores em headed).

### Checklist
[x] especificação de interface completa (deleção de órfãos não afeta telas: grep 0 usos)
[x] consistência com Design System (fluxo dropdown em `invoice-form` = `Badge` + variantes existentes)
[x] não regressão visual em telas validadas (ciente do `Badge` plano no dropdown)
[x] copy pt-BR preservada (`levelLabel` exportado — "Baixo/Médio/Alto Risco")

### Findings
- **Orphan deletion — sem risco**: os 8 componentes deletados não são importados por
  nenhuma página/rota (grep 0 usos em `apps/frontend/src/app` e `__tests__`); eram código
  morto de etapas anteriores do Design System. Deleção segura, acompanhada dos 7 testes
  órfãos que só os testavam.
- **Nested-button fix — correto**: `RiskBadge` (que renderiza `<button>` com tooltip) dentro
  do `<button>` do dropdown do `invoice-form` gerava HTML inválido aninhado e flake na
  interação de teste. A troca por `<Badge>` plano (via `levelToVariant`/`levelLabel`)
  mantém o nível de risco visível no dropdown sem duplicar interatividade.
- **Componentes mantidos — justificados**: `invoice-form`, `pix-payment-flow`, `risk-badge`,
  `sidebar`, `error-state`, `empty-state` e demais foram **retidos** com uso efetivo em
  páginas; nenhum componente com uso real foi removido. `error-state`/`empty-state` mantêm
  `h3` conforme decisão da sessão anterior (SKIP explícito permitido pelo parecer).

---

## 3. Parecer do Compliance Auditor

### Status: APROVADO COM RESSALVAS (não-bloqueante)

Checklist SDD→TDD→Secure-by-Design→DoD: [x] specs de backfill presentes
(`specs/security.spec.md`, `specs/multi-provider-payments.spec.md`) e atualizadas nesta
entrega; [x] testes novos codificam o comportamento exigido pelas waves (negative tests
de fail-closed, arch test, wiring); [x] re-auditoria de segurança registrada
(`pareceres/security-wave1-rereview.md`); [x] DoD executado (1104/258 suites verdes, tsc
limpo, biome limpo nos tocados); [x] backlog registrado (STATE.md v0.13.0+).

### Instrução de autocorreção (6 itens) — status EXECUTADA

1. **Re-auditoria de segurança registrada** — ✅ `pareceres/security-wave1-rereview.md`
   (2026-08-07, security-specialist APROVADO COM RESSALVAS + tech-nucleus) adicionado ao
   commit de consolidação.
2. **Specs da entrega atualizadas** — ✅ `specs/multi-provider-payments.spec.md` (AC4/AC9/AC15
   → Port `PaymentGatewayResolverPort` + enum lowercase canônico) e `specs/security.spec.md`
   (S4: webhook fail-closed + allowlist de IPs) revisadas no diff.
3. **`specs/security.spec.md` — contratos de env fail-closed** — ✅ seção "Env fail-closed
   contracts (bootstrap)" adicionada (JWT_SECRET/MASTER_API_KEY/ASAAS_API_KEY `.min(1)` sem
   default; EVOLUTION_API_KEY fail-closed na rota; EVOLUTION_ALLOWED_IPS) — validada por
   `src/__tests__/config/env-contract.test.ts`.
4. **STATE.md — backlog registrado** — ✅ seção "Backlog v0.13.0+" adicionada com 14 itens
   deferidos (rationale de uma linha cada) + seção desta entrega nos pareceres.
5. **Este commit de consolidação** — ✅ todos os artefatos da auditoria multi-wave
   commitados como baseline (waves 1-3, P3, pareceres).
6. **README alinhado** — ✅ tabela de env com fail-closed sem default (JWT_SECRET,
   MASTER_API_KEY, ASAAS_API_KEY), nomenclatura `MERCADO_PAGO_*`, `EVOLUTION_ALLOWED_IPS`,
   release notes v0.10-12, stack atualizada (event bus singleton, resolver F2).

---

**Veredito consolidado**: APROVADO COM RESSALVAS — todos não-bloqueantes; a entrega
multi-wave + correções pode ser o novo baseline e prosseguir ao parecer final do CEO.