# Parecer — Re-auditoria de segurança dos fixes Wave 1 (env fail-closed, webhook fail-closed + allowlist, tenantId fora da querystring)

## 2026-08-07 — APROVADO COM RESSALVAS (não-bloqueante)

**Veredicto do Security Specialist:** `APROVADO COM RESSALVAS` — re-auditoria executada a pedido do
compliance-auditor (HEAD `9d7955c` + waves não commitadas). Os 3 fixes Wave 1 verificados
independentemente, todos verdes; ressalvas registradas abaixo são pré-existentes/baixas e
endereçadas na wave de consolidação — nenhuma bloqueia o parecer final do CEO.

### Evidência verificada de forma independente
- Arquitetura: `npx vitest run src/__tests__/architecture/dependency-rule.test.ts` → **1/1 PASS** (0 imports app→infra).
- Segurança: `npx vitest run src/__tests__/security src/__tests__/config src/__tests__/routes/webhook.routes.test.ts` → **19 arquivos / 168 testes PASS** (16.0s), incluindo `webhook.routes.test.ts` (10 testes), `auth-plugin.test.ts` (fail-closed JWT/MASTER/ASAAS) e `env-contract.test.ts`.
- Greps: `query.tenantId` em `apps/backend/src` → **0 ocorrências**. Secrets hardcoded (`agiliza-dev-secret`, `agiliza-dev-api-key-*`, `sandbox-key`, `dev-key`) → presentes **somente** em `.env.example` (placeholders), fixtures de teste (backend `__tests__/security/*`, `e2e/tests/*`) e docs/placares passados — **0 em src de produção**.

### Checklist OWASP aplicável
- [x] **A01 Broken Access Control** — tenantId fora da querystring; JWT (`request.tenantId`) é a única fonte autoritativa em todas as rotas auditadas (client, invoice×2, reminder, report×3, subscription).
- [x] A07 Identification and Authentication Failures — webhook Evolution fail-closed (sem chave → 401), allowlist de IP opcional; JWT/MASTER/ASAAS_API_KEY exigidos no schema (sem default → boot falha).
- [x] A03 Injection — input do webhook validado por mapa de provedor fixo + assinatura obrigatória; nenhum `tenantId` extraível de query.
- Cross-cutting — secrets fora do código-fonte (env/CI), sem default hardcoded nos 3 secrets críticos.

### Tabela de verificação (fixes Wave 1)

| # | Item verificado | Resultado | Evidência (file:line) |
|---|---|---|---|
| 1a | JWT_SECRET fail-closed, sem default | ✅ | `apps/backend/src/config/env.ts:22` `z.string().min(1)` — sem `.default(`; README `.env.example:25` documenta required. Teste: `__tests__/security/auth-plugin.test.ts:93-99` (safeParse({}) falha com issue). |
| 1b | MASTER_API_KEY fail-closed, sem default | ✅ | `apps/backend/src/config/env.ts:27` `z.string().min(1)` — sem default; `.env.example:32` required. Teste: `auth-plugin.test.ts:103-117`. |
| 1c | ASAAS_API_KEY fail-closed, sem default | ✅ | `apps/backend/src/config/env.ts:32` `z.string().min(1)`; teste `auth-plugin.test.ts:122-134` (CODE-19, sem `sandbox-key` default). |
| 1d | Secrets hardcoded fora de src de produção | ✅ | Grep: 0 em `apps/backend/src` não-teste; ocorrências só `.env.example:25/32`, fixtures `e2e/tests/*.spec.ts:12-13`, `__tests__/security/{auth-plugin,auth,jwt-verification}.test.ts`. |
| 2a | Webhook Evolution: sem `x-api-key` → 401 | ✅ | `apps/backend/src/routes/webhook.routes.ts:115-121`; teste `__tests__/routes/webhook.routes.test.ts:69-73`. |
| 2b | Chave errada → 401 | ✅ | `webhook.routes.ts:118` (`apiKey !== expectedKey`); teste `:75-83`. |
| 2c | Unconfigured (sem EVOLUTION_API_KEY) → 401 (fail-closed) | ✅ | `webhook.routes.ts:116-119` (`!expectedKey ||`); teste `:96-105`. |
| 2d | IP não-allowlisted → 401 com allowlist configurada | ✅ | `webhook.routes.ts:126-134` (`env.EVOLUTION_ALLOWED_IPS` split/trim/filter + `includes(request.ip)`); `env.ts:17` schema; teste `:109-120`. |
| 2e | Key correta + IP allowlisted → 200 | ✅ | teste `webhook.routes.test.ts:122-132`; allowlist vazia = sem filtro (200 para qualquer IP, `:134-144`). |
| 3 | `query.tenantId` — 0 ocorrências em todas as rotas | ✅ | Grep `query.tenantId` em `apps/backend/src` → **0**. Handlers usam exclusivamente `request.tenantId` (JWT): `report.routes.ts:41-45`, `invoice.routes.ts:105/159/200`, `reminder.routes.ts:51/105/166`, `subscription.routes.ts:186/239/281/320`, `onboarding.routes.ts:56`, `decision.routes.ts:37`. |
| 3b | Scoping por tenantId da JWT em reads de repo | ✅ | `reminder.routes.ts:59,113` `getInvoiceWithClientRaw(invoiceId, tenantId)`; `subscription.routes.ts:323` `findById(id, tenantId)`; `invoice.routes.ts:364` `findByIdRaw(id, request.tenantId)`; `reminder.routes.ts:229` `eventRepo.findByIdRaw(id, request.tenantId)`. |
| 4 | Architecture: sem import app→infra | ✅ | `dependency-rule.test.ts` → 1/1 PASS (5ms). |
| 5 | Suítes de segurança/config/webhook | ✅ | 19 arquivos / 168 testes PASS (4.96s). |

### Findings residuais (não-bloqueantes)
1. **Médio (doc) — EVOLUTION_API_KEY: doc ≠ código (pré-existente, escopo da consolidação).** `README.md:236` declara "sem default; a ausência falha rápido", mas `env.ts:14` mantém `EVOLUTION_API_KEY: z.string().default('')` — o boot NÃO falha sem a chave. O fail-closed existe apenas no roteador (`webhook.routes.ts:116-119` → 401, nunca aceita tráfego desconfigurado) e no allowlist. **Avaliação do especialista: aceitável** — a superfície de ataque está fechada no endpoint (webhook sem chave → 401 sempre), o que é o requisito de segurança; o mismatch é de documentação (promessa de fail-fast no boot), fixando na consolidação trocando a palavra do README por "sem chave o endpoint bloqueia com 401" (e, opcionalmente, tornando o schema hint de hard-fail em produção via `NODE_ENV==='production'`). Sem fix aqui (conforme instrução).
2. **Info — Drift de schema:** `report.routes.ts:26` (querystring de `/reports/forecast`) ainda declara `tenantId` opcional no **schema de querystring** — `invoice.routes.ts:144` idem — mas handlers ignoram query e usam `request.tenantId` (JWT): `report.routes.ts:41-45`, `invoice.routes.ts:159`. Não é vetor de autorização (valor ignorado), mas é declaração morta + descrição stale ("unless a tenantId is passed") em `invoice.routes.ts:139` — remover na consolidação.
3. **Info — Semântica de `request.ip` atrás de proxy:** `Fastify({ logger: ... })` sem `trustProxy` (`index.ts:51`), então `request.ip` é o endereço do socket — atrás de nginx/reverso, a allowlist (`webhook.routes.ts:131`) vê o IP do proxy, não do chamador. A chave continua sendo o controle primário (allowlist é defesa-em-profundeza); documentar na consolidação (configurar `trustProxy` no proxy de entrada — nunca confiar em `x-forwarded-for` sem ele).

### Instrução de autocorreção
Nenhuma — veredito não-bloqueante. Itens 1-3 acima são endereçados pelo `tech-nucleus-lead` na wave de consolidação (documentação README + limpeza de schema/descrições + nota de deploy por trás de proxy).

### Strengths
- Fail-closed triplo em `env.ts` sem regressão de testes: os 3 secrets críticos agora quebram boot sem ambiente — com teste de contrato `envSchema.safeParse({})` (tanto direto em `auth-plugin.test.ts` quanto via `env-contract.test.ts:37-51`, que mantém `envSchema` ↔ `.env.example` em sincronia).
- Webhook Evolution com testes negativos completos, incluindo o cenário mais fácil de regredir: **chave não configurada** (`webhook.routes.test.ts:96`).
- O par "schema por env + allowlist por env" foi implementado por `state`-proxy no teste (`webhook.routes.test.ts:23-36`), evitando mutação de `process.env` após o snapshot do schema.
- Zero `query.tenantId` em todo `apps/backend/src` — o padrão "JWT authoritative" descrito no parecer anterior está agora uniforme em todas as rotas.

---

## Parecer do Tech Nucleus Lead — 2026-08-07

**Status: APROVADO COM RESSALVAS (não-bloqueante)** — re-auditoria independente executada pelo
security specialist com evidência reprodutível; os 3 fixes Wave 1 verdes + 0 regressões nos 168
testes de security/config/webhook + arch-test verde (0 import app→infra). Os findings que ficam —
drift README EVOLUTION_API_KEY (doc-vs-código, fail-closed no roteador) e schema morto de
`tenantId` na querystring (`report.routes.ts:26`, `invoice.routes.ts:139/144`) — são alvo exato da
consolidação já programada; sem impacto no parecer final do CEO.