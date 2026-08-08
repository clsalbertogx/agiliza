# Spec: Security — Autenticação, Headers, Rate Limit, Error Handler, Isolamento de Tenant

> Status: **Implementado (Sprint 10–11)** — spec backfill. Contratos extraídos do código atual.
> Fonte: `apps/backend/src/{infrastructure/plugins/auth.plugin.ts, infrastructure/auth/*, infrastructure/payment/*hmac*, presentation/handler.ts, src/index.ts, routes/*}`.

## Contexto de Negócio

O Agiliza é multi-tenant (B2B) e processa dados sensíveis (dados de clientes, credenciais de pagamento). O backend precisa garantir: autenticação por **JWT HMAC-SHA256** (Bearer) ou **API Key** (B2B), headers de segurança (**Helmet**), **rate limiting** global e por rota, **error handler** em 4 camadas sem vazar stack trace, **isolamento total de tenant** em todas as queries, e **verificação HMAC per-tenant** de webhooks.

---

## Escopo

### Incluído
- `AuthPlugin` (Fastify): pré-handler global, paths públicos, Bearer (JWT) + ApiKey
- `JwtStrategy` (createToken/verifyToken): HS256, HMAC-SHA256, timing-safe, claims obrigatórios + `exp`
- `Helmet` configurado (CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy)
- Rate limiting global (Redis) + overrides por rota (health 1000/min, webhooks burst 10/s)
- `errorHandler` 4 camadas (Zod → 400, ApplicationError → statusCode, Fastify → statusCode, desconhecido → 500)
- Isolamento de tenant: `tenantId` derivado do token, filtros em todos os repositórios, webhook por-tenant
- `PerTenantHmacVerifier` / `hmac-verifier` para webhooks
- Suíte `__tests__/security/*` (14 arquivos)

### Fora de Escopo
- Login/OAuth real e refresh-token rotation (testes cobrem o contrato; implementação de auth de usuário final fica na spec de auth do produto)
- Criptografia de PII em repouso — ver `multi-provider-payments.spec.md` (AES-256-GCM p/ credenciais) e `encryption.test.ts`
- LGPD (consent logs, deletion requests) — model Prisma `ConsentLog` existe, mas fora deste backfill de contrato de segurança HTTP
- Autorização RBAC refinada por recurso (testes descrevem cenário; implementação minimalista no payload `role: 'owner'|'user'`)

---

## Critérios de Aceitação (ACs)

| ID | Critério | Verificação |
|----|----------|-------------|
| AC1 | Requests sem header `Authorization` em rota protegida → 401 `Missing authorization header` | `__tests__/security/auth.test.ts` |
| AC2 | Bearer JWT inválido/expirado/malformado → 401; JWT assinado com **outro secret** (forja) → 401; algoritmo `none` rejeitado | `auth.test.ts`, `jwt-verification.test.ts` |
| AC3 | `verifyToken` valida claims obrigatórios (`tenantId`, `userId`, `role`) e `exp`; comparação de assinatura **timing-safe** com fail-fast em tamanho diferente | `jwt-verification.test.ts` |
| AC4 | ApiKey válida → request autenticado com `tenantId` default (`00000000-0000-0000-0000-000000000000`); ApiKey inválida → 401 | `auth.test.ts` |
| AC5 | Paths públicos sem auth: `POST /api/tenants` (signup), `/api/health`, `/api/ready`, `/api/webhooks/`, `/metrics`, `/docs` (dev) | `auth.test.ts`, `__tests__/e2e/health.e2e.test.ts`, `__tests__/routes/tenant-signup.test.ts` |
| AC6 | **Helmet**: CSP com `default-src 'self'`, HSTS (maxAge 1y, preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` | `helmet-headers.test.ts` |
| AC7 | **Rate limit global**: Redis, `RATE_LIMIT_MAX` (default 100) por minuto, `keyGenerator` por **IP** (`request.ip` — o limiter roda no hook `onRequest`, antes de o `tenantId` existir no request); retorna 429 | `rate-limiting.test.ts`, `brute-force.test.ts` |
| AC8 | **Rate limit por rota**: health/ready/metrics 1000/min; webhooks burst 10/s por IP; login (se existir) 20/min | `rate-limiting.test.ts` |
| AC9 | **Error handler 4 camadas**: (1) `ZodError` → 400 `VALIDATION_ERROR` com detalhes por campo; (2) `ApplicationError` → `statusCode`/`code` (404/409/401/403/400/500); (3) `FastifyError` com statusCode → code próprio; (4) desconhecido → 500 `INTERNAL_ERROR`, **sem stack trace em produção** | `error-handler.test.ts` |
| AC10 | **Isolamento de tenant**: acesso cross-tenant por ID → 404; listagem retorna só o próprio tenant; `tenantId` de query param é ignorado (derivado do auth); todos os repositórios filtram por `tenantId` | `auth.test.ts` (Tenant Isolation — SEC-08) |
| AC11 | Webhook HMAC per-tenant: `PerTenantHmacVerifier` busca secret por `tenantId+provider` no DB, valida inputs antes da lookup, HMAC-SHA256 com `timingSafeEqual`; sem secret → rejeita | `__tests__/security/webhook.test.ts` |
| AC12 | Rota webhook valida provider contra mapa de headers antes de qualquer processamento (provedor desconhecido → 400) | `webhook.routes.ts`, `__tests__/routes/webhook.routes.test.ts` |
| AC13 | CORS restrito a `FRONTEND_URL` (origem desconhecida não recebe `Access-Control-Allow-Origin`; webhooks não exigem CORS) | `cors.test.ts` |
| AC14 | Proteções: SQL/NoSQL injection (Prisma parametrizado + Zod), XSS (CSP + headers), SSRF (sem fetch a URLs arbitrárias), brute-force (lockout) | `sql-injection.test.ts`, `xss.test.ts`, `ssrf.test.ts`, `brute-force.test.ts` |
| AC15 | Logs/erros não expõem PII, segredos nem stack traces em produção | `audit-logging.test.ts`, `error-handler.test.ts` |
| AC16 | **Signup público** (`POST /api/tenants`): sem autenticação (público por design), retorna 201 + `{ data: { tenant }, token }` (JWT válido com `tenantId` do tenant criado); `tenantId` de querystring NÃO sobrescreve o do JWT; rate-limited 20/min por IP; slug duplicado → 409; corpo inválido → 400 | `__tests__/routes/tenant-signup.test.ts`, `__tests__/routes/tenant-openapi.test.ts` |

---

## Contratos entre Camadas

### Infrastructure

```typescript
// infrastructure/plugins/auth.plugin.ts (fastify-plugin)
// Decora: request.tenantId?, request.userId?, request.authPayload?
// preHandler: paths públicos → skip (incl. POST /api/tenants — signup); ausência de header → 401; 'Bearer ' → verifyToken; 'ApiKey ' → tenantId default; formato inválido → 401.

// infrastructure/auth/jwt.strategy.ts
export interface AuthPayload { tenantId: string; userId: string; role: 'owner' | 'user'; }
export function createToken(payload: AuthPayload, secret: string): string; // header{alg:HS256,typ:JWT} + body{...,iat,exp:+86400} + HMAC-SHA256 base64url
export function verifyToken(token: string, secret: string): AuthPayload | null; // timing-safe, valida claims + exp

// infrastructure/auth/api-key.strategy.ts
export function validateApiKey(apiKey: string, tenantApiKey: string): boolean; // compare exato (hash em produção)

// infrastructure/payment/per-tenant-hmac-verifier.ts
export class PerTenantHmacVerifier implements WebhookVerifierPort {
  verify(provider, rawBody, signature, tenantId): Promise<Either<ApplicationError, boolean>>; // secret do DB, timingSafeEqual
}
```

```typescript
// src/index.ts — segurança no bootstrap
app.register(cors, { origin: [env.FRONTEND_URL], credentials: true });
app.register(helmet, { contentSecurityPolicy: {...}, hsts: {...}, xFrameOptions: 'deny', xContentTypeOptions: true, referrerPolicy: 'strict-origin-when-cross-origin' });
app.register(rateLimit, { redis, global: true, max: env.RATE_LIMIT_MAX, timeWindow: '1 minute', keyGenerator: req => req.ip }); // per-IP: o limiter global roda em onRequest, antes de o tenantId existir
app.register(authPlugin); // depois de observability, antes das rotas
app.setErrorHandler(errorHandler); // depois das rotas
// Swagger UI (/docs) apenas em NODE_ENV !== 'production'
```

### Presentation

```typescript
// presentation/handler.ts — errorHandler(error, request, reply)
// 1) ZodError → 400 { error: { code: 'VALIDATION_ERROR', message, details: [{field, message}] } }
// 2) ApplicationError → reply.status(error.statusCode).send({ error: { code: error.code, message } })
// 3) FastifyError.statusCode → { error: { code: fastifyError.code || 'FASTIFY_ERROR', message } }
// 4) desconhecido → 500 { error: { code: 'INTERNAL_ERROR', message: prod ? 'Internal server error' : error.message } }
```

| Rota | Proteção |
|------|----------|
| `POST /api/tenants` (signup) | pública; rate limit 20/min por IP; retorna 201 + `{ data: { tenant }, token }` |
| `/api/health`, `/api/ready`, `/metrics` | pública; rate limit 1000/min |
| `/api/webhooks/payment/:provider`, `/api/webhooks/evolution` | pública; burst 10/s por IP; HMAC per-tenant (payment) / `x-api-key` (evolution) |
| `/api/clients`, `/api/invoices`, `/api/subscriptions`, `/api/payments`, `/api/reminders`, `/api/decision`, `/api/reports`, `/api/onboarding`, `/api/payment-providers/config` | Bearer (JWT) ou ApiKey; tenantId derivado do token |

---

### Env fail-closed contracts (bootstrap)

- `JWT_SECRET`, `MASTER_API_KEY`, `ASAAS_API_KEY`: **`z.string().min(1)` — sem default** em `config/env.ts`. Um ambiente sem essas vars falha **na inicialização** (env validation → `process.exit(1)`), nunca com default público conhecido — previne forja de JWT, impersonação do null-tenant e cobrança contra sandbox de conhecimento público (CODE-19).
- `EVOLUTION_API_KEY`: **schema-level default `''`** (não bloqueia boot) — o **fail-closed é na rota**: `POST /api/webhooks/evolution` retorna **401 `Invalid API key` quando a env está ausente OU `x-api-key` não confere** (S4 — webhook não configurado nunca aceita tráfego silenciosamente). Fábrica `create-evolution-message-provider` também lança se `EVOLUTION_API_URL` configurada sem key.
- `EVOLUTION_ALLOWED_IPS`: allowlist de IPs de origem (CSV) para `/api/webhooks/evolution`, aplicada **em cima** da API key (401 `IP not allowed`); vazio = sem allowlist (key check continua valendo).
- `POST /api/tenants` permanece **público** (signup deliberado) com rate limit 20/min por IP — exceção documentada no AC16.
- Verificação: `src/config/env.ts`; `routes/webhook.routes.ts` (S4); `presentation/factories/create-evolution-message-provider.factory.ts`.

---

## Requisitos Não-Funcionais

| ID | Requisito | Detalhe |
|----|-----------|---------|
| NFR1 | Timing-safe | Verificação de JWT e HMAC usam `timingSafeEqual`; fail-fast em tamanho diferente |
| NFR2 | Zero vazamento | Sem stack trace/PII/segredos em respostas de erro ou logs em produção |
| NFR3 | Defesa em profundidade | Zod (input) + VOs (domain) + queries parametrizadas (Prisma) |
| NFR4 | Multi-tenant | `tenantId` sempre derivado do contexto de auth; query params de tenant ignorados; webhooks resolvem tenant do payload + secret por-tenant |
| NFR5 | Disponibilidade | Health/ready/metrics com rate limit alto para monitoração nunca ser bloqueada |

---

## Design Patterns Declarados Explicitamente

| Padrão | Onde Aplicado | Justificativa |
|--------|---------------|---------------|
| **Interceptor / Hook** | `auth.plugin.ts` (preHandler), `observability.plugin.ts` (onRequest/onResponse) | Cross-cutting (auth/metrics) sem poluir handlers |
| **Strategy** | `verifyWebhookSignature`/`PerTenantHmacVerifier` por provider | Verificação intercambiável por provedor de webhook |
| **Error mapping centralizado** | `presentation/handler.ts` | Contrato estável de erro: `{error: {code, message, details?}}` |
| **Policy (rate limit)** | `@fastify/rate-limit` global + overrides | Limites por rota/cenário (login, webhooks, health) |

---

## Definition of Done

- [x] AC1–AC16 cobertos por testes automatizados (`__tests__/security/*` — 14 arquivos + `__tests__/routes/tenant-signup.test.ts`, `tenant-openapi.test.ts`)
- [x] `__tests__/e2e/security.e2e.test.ts` verde
- [x] Zero violação de camada: verificação de segurança em Infrastructure; contracts em Application Ports; erro formatado na Presentation
- [x] Testes negativos de segurança passando (forja de token, cross-tenant, injection, rate-limit, sem header, role `user` em PATCH/PUT de tenant)

---

## Rastreabilidade (AC → Testes)

| AC | Teste |
|----|-------|
| AC1–AC5 | `__tests__/security/auth.test.ts` |
| AC2–AC3 | `__tests__/security/jwt-verification.test.ts` |
| AC6 | `__tests__/security/helmet-headers.test.ts` |
| AC7–AC8 | `__tests__/security/rate-limiting.test.ts`, `brute-force.test.ts` |
| AC9, AC15 | `__tests__/security/error-handler.test.ts`, `audit-logging.test.ts` |
| AC10 | `auth.test.ts` (Tenant Isolation — SEC-08) |
| AC11 | `__tests__/security/webhook.test.ts`, `webhook-verifier.contract.test.ts` |
| AC12 | `__tests__/routes/webhook.routes.test.ts` |
| AC13 | `__tests__/security/cors.test.ts` |
| AC14 | `sql-injection.test.ts`, `xss.test.ts`, `ssrf.test.ts`, `brute-force.test.ts` |
| AC16 | `__tests__/routes/tenant-signup.test.ts`, `tenant-openapi.test.ts` |
