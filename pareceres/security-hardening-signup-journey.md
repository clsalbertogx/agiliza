# Parecer — security hardening + signup flow + journey UX/data corrections

## 2026-08-06 — APROVADO COM RESSALVAS (não bloqueante)

**Veredicto do Tech Nucleus Lead:** `APROVADO COM RESSALVAS` — commits `e8d1c3d` + `edf1ab6`.
Estágio 1 (conformidade) e Estágio 2 (qualidade) ambos aprovados; 2 findings low-severity
registrados abaixo com instrução de autocorreção; tech debt pré-registrado em STATE.md
confirmado e corretamente escopado.

### Evidência verificada de forma independente
- Suíte backend completa: 1059 tests / 102 files PASS (`npx vitest run`).
- Suíte frontend completa: 438 tests / 33 files PASS.
- `tsc --noEmit` 0 erros em backend e frontend.
- Security + rotas tocadas: 262/262 PASS (auth-plugin 6, tenant-isolation 12, signup 8, rate-limiting, reminder, client/invoice/subscription).
- Grep `agiliza-dev-secret` em src não-teste: 0. Grep frontend por chamada a GET /api/tenants: 0 (só POST signup e rotas /:id).
- `depcruise` NÃO configurado no repo (STATE.md:39 confirmado) — fitness function pendente, não bloqueio desta entrega.

### Strengths
- E2 fail-closed íntegro: `env.ts:19` sem default + `.min(1)`; `auth.plugin.ts:41` `?? ''` sem fallback; `verifyToken` fail-closed (3 partes, timing-safe, claims obrigatórias, exp) — testado com token forjado `agiliza-dev-secret` → 401.
- E1 corrigido: ApiKey validada contra MASTER_API_KEY (garbage → 401; válida → null tenant).
- a1: guard `isOwnTenant` → 403 imediato SEM lookup nas 5 rotas /:id; GET /api/tenants removida com negativo unit (404) + probe journey.
- a2/a3: defesa em profundidade (rota pré-checa `getInvoiceWithClientRaw(id, tenantId)`; serviço `sendReminderNow` usa `findById(invoiceId, tenantId)`; repos `findByIdRaw`/`getInvoiceWithClientRaw` filtram por tenantId via findFirst). Negativos cross-tenant 404 + regressões 200.
- Padrão "JWT tenantId autoritativo" consistente: query string não sobrescreve JWT (testado em tenant-signup.test.ts). `findById(id, tenantId?)` já era convenção dos ports client/invoice/subscription — a mudança em reminder.service.ts apenas alinha o serviço ao padrão existente.
- Clean Architecture respeitada: guards em rotas (presentation), scoping em repos (infrastructure), uma mudança application-layer passando tenantId pelo port existente. Zero mudança de domínio, zero dependência nova.
- Rate limit per-IP honesto com racional documentado (limiter roda em onRequest, antes do tenantId); signup 20/min por IP testado com controle positivo de IPs distintos.
- UUID format nas rotas + guard UUID em `tenant.repository.findById` (404 em vez de 500) — testado.
- Frontend: risk/reports sem fallback demo (ErrorState/EmptyState), settings com guarda de sessão sem tenantId, register grava tenant_id + JWT, drawer mobile com Esc/overlay.

### Findings (todos low — não bloqueantes)
1. **Low — Drift de spec OpenAPI**: `tenant.routes.ts:127` POST /api/tenants declara `security: [{ bearerAuth: [] }]` mas é pública por design (bypass no auth plugin). Swagger mostra lock em endpoint público. Responsável: fullstack-engineer.
2. **Low — Gap de teste E3**: único teste negativo de role existe para PATCH /config (`tenant-isolation.test.ts:150`). PUT /payment-provider (`tenant.routes.ts:408`) e PUT /decision-config (`:509`) usam o MESMO guard `!isOwnTenant || !isOwner` sem teste negativo explícito. Responsável: qa-engineer.
3. **Info — Drift de contagem STATE.md:37**: `tenant-isolation.test.ts` tem 12 testes (`it`), STATE.md diz 13.
4. **Obs — Dashboard demo mode**: `dashboard/page.tsx:35-167` mantém dados fake atrás de `NEXT_PUBLIC_DEMO_MODE==='true'` (off por default). Não viola a claim de journey (era risk/reports); decisão consciente de manter/remover.

### Instrução de autocorreção (não-bloqueante)
Endereçada a: fullstack-engineer
- Remova `security: [{ bearerAuth: [] }]` do schema do POST /api/tenants em `apps/backend/src/routes/tenant.routes.ts:127` (ou substitua por declaração `security: []` explícita + `description: "Público — signup"`) para a documentação OpenAPI refletir o comportamento real.
Endereçada a: qa-engineer
- Adicione em `apps/backend/src/__tests__/security/tenant-isolation.test.ts` (describe a1/E3) dois testes negativos: (a) role `'user'` PUT /api/tenants/:id/payment-provider → 403; (b) role `'user'` PUT /api/tenants/:id/decision-config → 403, replicando o padrão do teste existente na linha 150.
Endereçada a: (docs)
- Corrija `STATE.md` linha 37: tenant-isolation.test.ts = 12 testes (7 a1/E3 + 5 a2/a3).

### Tech debt registrado (confirmado corretamente escopado p/ próximo sprint)
1. `env.ts:21` MASTER_API_KEY ainda fail-open (`'agiliza-dev-api-key-change-in-production'`) — confirmado no código; alinhar a JWT_SECRET exige CI/testes setando a env. Escopo correto.
2. `reminder.service.ts:103` `clientRepo.findById(invoice.clientId)` sem tenantId — confirmado no código; defense-in-depth (fatura já é do tenant). Escopo correto.

---

## Parecer do Creative Nucleus Lead — 2026-08-06

**Status: APROVADO COM RESSALVAS** (não-bloqueante) — método: avaliação estática linha a linha (browser MCP indisponível no ambiente; telas validadas pela entrega em browser headed).

Checklist: [x] especificação de interface completa (register, drawer, error/empty/loading) [x] acessibilidade mensurável (padrão forte na base: role=alert, aria-modal, focus rings) [x] consistência com Design System (shadcn/Card/Button/Input/Label, paleta gray/green/primary) [x] copy pt-BR uniforme.

Pontos fortes: register com <h1> único "Criar conta" + labels htmlFor + aria-invalid + role=alert no erro de slug; drawer mobile com hamburger aria-label, role=dialog + aria-modal + aria-label "Menu móvel", fecha em Escape/backdrop/X/link; remoção dos fallbacks silenciosos de mock em risk/reports (honestidade de produto); api.ts com mensagens reais (fim do [object Object]); estados uniformes nas 6 telas (LoadingSkeleton variant=page, ErrorState com retry, EmptyState descritivo); guard de sessão no settings.

Findings:
- P2: drawer sem gerenciamento de foco APG (foco permanece no hamburger atrás do overlay; sem focus trap; sem retorno ao trigger) — sidebar.tsx:100-133
- P2: backdrop é <button> focável e primeiro na ordem do DOM (WCAG 2.4.3) — sidebar.tsx:102-107
- P3: hamburger sem aria-expanded/aria-controls e dialog sem id — sidebar.tsx:89-97,108-112
- P3: scroll do body não bloqueado com drawer aberto
- P3: register sem autocomplete (organization/email/off)
- P3: botão submit sem feedback de envio ("Criando conta...")
- P3: ErrorState/EmptyState usam <h3> (salto h1→h3, padrão pré-existente propagado)
- P3: api.ts erros de rede em inglês ("Failed to fetch", "HTTP <status>")
- P3: RiskBadge com id="risk-badge-tooltip" duplicado (HTML inválido) — pré-existente

Instrução de autocorreção (P2, implementada): foco no drawer no padrão APG; aria-expanded/aria-controls; backdrop não-focável (div role=presentation aria-hidden); scroll lock. Recomendações de polish (próximo sprint, não-bloqueantes): label da página atual na top bar mobile; limpar erro de slug ao digitar; useId() no RiskBadge; fallback de erro humano localizado no api.ts; CTA no EmptyState de clientes/risco.

---

## Parecer do Compliance Auditor — 2026-08-06

**Status: APROVADO COM RESSALVAS** (não-bloqueante) — processo SDD→TDD→Secure-by-Design→DoD substancialmente seguido; sem salto de etapa; security-specialist com poder de veto respeitado (BLOCKED→correções→re-auditoria APPROVED); sem bouncing repetido.

Checklist: [x] SDD (parcial) — specs/frontend-ui-consistency-corrections.spec.md + specs/security.spec.md cobrem jornada e hardening; [NOTA] signup público sem AC de spec (ver finding 1) [x] TDD — testes negativos codificam comportamento que o código pai violava (E1/E2/a1/a2/a3/E3); nota: testes+implementação no mesmo commit (padrão histórico, não não-conformidade) [x] Secure-by-Design — security antes e depois, findings rastreados em STATE.md [x] CI/SAST configurado (.github/workflows/ci.yml + security.yml CodeQL/Trivy/Gitleaks); depcruise não configurado (pendência de ambiente) [x] DoD — 66 PASS/0 FAIL browser, backend 1059, frontend 438, tsc/biome 0 erros.

Findings: [Média] signup (POST /api/tenants + JWT + register page) sem AC de spec — rastreabilidade AC→teste ausente; security.spec.md AC5 não lista POST /api/tenants como público [Baixa] security.spec.md AC7/contrato bootstrap declaram keyGenerator por tenantId mas servidor real é per-IP (decisão registrada em código+STATE, não na spec) [Baixa] cadeia de pareceres incompleta até este anexo [Baixa] drift de contagem tenant-isolation (13 vs 12; agora 14 após batch E3) [Baixa] DoD das specs sem checkboxes marcados.

Instrução de autocorreção: corrigir security.spec.md AC7 p/ per-IP + adicionar AC do signup público (referenciando tenant-signup.test.ts); anexar creative parecer antes deste; corrigir contagem; marcar DoD das specs; commitar batch de autocorreção e re-validar. Executado pelo CEO. A entrega pode prosseguir ao parecer final do CEO.
