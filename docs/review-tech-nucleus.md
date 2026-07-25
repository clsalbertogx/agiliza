# Tech Nucleus Lead — Review

**Reviewer**: Tech Nucleus Lead  
**Date**: 2026-07-25  
**Project**: Agiliza MVP v0.1  
**Status**: 🟡 **APROVADO COM RESSALVAS**

---

## 1. Summary

This review evaluated the Agiliza MVP project across 6 dimensions: spec compliance, code quality, architecture, security, testing, and infrastructure. The project is in **TDD Red phase** — all 336 tests are intentionally failing (`expect(true).toBe(false)`) — and is characterized as a scaffold/Skeleton to be iterated upon in Sprint 1.

The SDD (2,428 lines) and Security Spec (1,565 lines) provide an **excellent, detailed architectural target**. The implementation currently achieves roughly 20% of the target architecture, with the gap being intentional and documented as architectural debt with Sprint 2 remediation plans.

**Key positives**: HMAC webhook verification is production-grade with `timingSafeEqual`; auth plugin structure is correct (global preHandler, public path exemptions, request decoration); domain services contain proper business logic; 336 well-structured tests with detailed Given/When/Then comments; Docker setup with proper services and healthchecks.

**Key concerns**: JWT signature verification is **completely broken** (C-07 — doesn't verify signature); rate limiting package is installed but never registered; no security headers; BaseRepository.findById() lacks tenant isolation; env.ts is missing critical variables (JWT_SECRET, ENCRYPTION_KEY).

---

## 2. What's Working Well

### 2.1 Documentation
- **SDD** (`docs/sdd.md`): Comprehensive 2,428-line spec with 14 Gherkin ACs, detailed API contracts (Zod schemas), Clean Architecture layer structure, event schemas, domain model with invariants, and 3 ADRs. This is the gold standard for a project spec.
- **Security Spec** (`docs/security-spec.md`): 1,565-line threat model using STRIDE per component, with 14 detailed security test cases (SEC-01 through SEC-14), RBAC scope definitions, webhook HMAC verification specs, PII encryption design, and OWASP Top 10 compliance mapping.
- **CTO Review** (`docs/review-cto.md`): Thorough architectural analysis with clear scorecard, documented ressalvas, and prioritized remediation plan.

### 2.2 Security Foundations
- **HMAC Webhook Verification** (`infrastructure/payment/hmac-verifier.ts`): Production-grade implementation using `crypto.createHmac` + `crypto.timingSafeEqual` (timing attack protection). Provider-specific configs for Asaas and Mercado Pago.
- **Auth Plugin Structure** (`infrastructure/plugins/auth.plugin.ts`): Correct Fastify global preHandler pattern with public path exemptions (`/health`, `/api/webhooks/`). Request decoration with `tenantId` and `userId`. Dual auth flow (Bearer JWT + ApiKey header).
- **Evolution API Webhook Security** (`routes/webhook.routes.ts`, lines 33-43): API key validation on webhook endpoint, preventing unauthorized webhook calls.

### 2.3 Domain Logic
- **Invoice Status State Machine** (`domain/entities/invoice.ts`, lines 53-62): `canTransitionTo()` correctly implements the state machine (PENDING→PAID|OVERDUE|CANCELLED, PAID→REFUNDED, etc.).
- **Risk Score Service** (`application/services/risk-score.service.ts`): Well-structured heuristic with cold-start GREEN, progressive risk levels based on overdue count and avg delay, and explainable reasons.
- **Decision Engine Service** (`application/services/decision-engine.service.ts`): Clean decision pipeline based on risk score, client preferences, and niche benchmarks. Proper separation of concerns from routes.
- **Domain Events** (`domain/events/domain-events.ts`): Typed event system with 11 event types and a factory function — ready for EventBus integration.

### 2.4 Test Structure
- **336 tests across 16 files**: All tests have detailed Given/When/Then comments that serve as living documentation.
- **Coverage areas**: Routes (client, invoice, payment, reminder, decision, report, tenant), domain entities (client, invoice, payment), security (auth, webhook, sql-injection, xss, cors, brute-force, encryption, audit-logging, ssrf, lgpd), decision engine (risk-score, next-action), repositories (client, invoice), events.
- **Security tests map to OWASP Top 10**: Each test references its OWASP item (e.g., SEC-01 → A07).

### 2.5 Infrastructure
- Docker Compose with PostgreSQL (pgvector), Redis, Evolution API, backend, and frontend services.
- Proper healthchecks, depends_on conditions, and network isolation.
- Frontend scaffold with Next.js 14, Tailwind, Zustand, React Query.
- Monorepo with Turborepo, shared package.

---

## 3. Issues Found

### 🔴 CRITICAL — Must Fix Before Any Real Data

| # | Issue | File | Detail |
|---|-------|------|--------|
| **I-01** | **JWT signature verification is broken** | `apps/backend/src/infrastructure/auth/jwt.strategy.ts` | `verifyToken()` receives a `secret` parameter but **never uses it**. It only base64-decodes the body and checks `exp`. Any 3-part token with valid `exp` is accepted. An attacker can forge JWTs with arbitrary `tenantId`, `userId`, and `role`. The `secret` parameter is completely ignored (lines 18-28). **Fix**: Add signature recomputation + `timingSafeEqual` comparison (see CTO review lines 123-144 for the fix). |
| **I-02** | **Rate limiting not registered** | `apps/backend/src/index.ts` | `@fastify/rate-limit` is in `package.json` (line 19) but never registered in the server. All endpoints are vulnerable to DoS/brute-force. The security spec defines 100 req/min per tenant, 20/min for auth, 10/s for webhooks but none of this is active. **Fix**: Register `@fastify/rate-limit` with Redis store in `index.ts`. |
| **I-03** | **BaseRepository.findById() lacks tenant isolation** | `apps/backend/src/infrastructure/database/repositories/base.repository.ts` | `findById()` (line 8-10) queries by `id` only — no `tenantId` filter. This means any authenticated user could access any record across tenants by ID. The derived repositories (ClientRepository, InvoiceRepository) add tenantId in some methods but the base method remains vulnerable. **Fix**: Add tenantId to base `findById()` signature. |

### 🟡 HIGH — Must Fix in Sprint 2

| # | Issue | File | Detail |
|---|-------|------|--------|
| **I-04** | **Routes import domain/infrastructure directly** | `routes/client.routes.ts`, `routes/webhook.routes.ts` | `client.routes.ts` line 3 imports `clientSchema` from `domain/entities/client` (presentation → domain). `webhook.routes.ts` line 2 imports from `infrastructure/payment/hmac-verifier` (presentation → infrastructure). Both violate the Dependency Rule. Acceptable for MVP scaffold but MUST be fixed in Sprint 2 per CTO conditions. |
| **I-05** | **No security headers (Helmet)** | `apps/backend/src/index.ts` | `@fastify/helmet` not installed or configured. The security spec (section 5.2) defines CSP, HSTS, X-Frame-Options, etc., but none are active. Production deployment risk. |
| **I-06** | **env.ts is missing critical variables** | `apps/backend/src/config/env.ts` | Missing: `JWT_SECRET`, `ENCRYPTION_KEY`, `REDIS_PASSWORD`, `MASTER_API_KEY`, `ASAAS_WEBHOOK_SECRET`, `MERCADOPAGO_WEBHOOK_SECRET`. The code references `process.env.JWT_SECRET` and `process.env.MASTER_API_KEY` directly (bypassing typed env). `.env.example` has these (lines 26-38) but `env.ts` doesn't validate them. |
| **I-07** | **HMAC config uses global env vars, not per-tenant** | `infrastructure/payment/hmac-verifier.ts` | Lines 10-23: `PROVIDER_CONFIGS` uses hardcoded `process.env.ASAAS_WEBHOOK_SECRET` and `process.env.MERCADOPAGO_WEBHOOK_SECRET`. In production, each tenant has different webhook secrets stored encrypted in DB. `PaymentProviderConfig` table exists in schema but HMAC doesn't use it. |

### 🟡 MEDIUM — Architectural Debt (Documented in CTO Review)

| # | Issue | CTO Ref | Detail |
|---|-------|---------|--------|
| **I-08** | Domain as Zod schemas, no VOs/Entity base | C-01 | No `domain/value-objects/`, no `domain/errors/`, no `Entity<T>` base class. Using `crypto.randomUUID()` instead of UUID v7. Accepted for MVP with Sprint 2 conditions. |
| **I-09** | No use cases or application ports | C-02 | No `application/usecases/`, no `application/ports/`, no Either monad, no ApplicationError. Two domain services exist but are not wired. Accepted for MVP with Sprint 2 conditions. |
| **I-10** | No DI/factories | C-06 | No composition root, no factories. Services exist but are never instantiated. Accepted for MVP with Sprint 2 conditions. |
| **I-11** | Payment provider configs (PagBank, Polar) missing in HMAC | `infrastructure/payment/hmac-verifier.ts` | Only Asaas and Mercado Pago have HMAC configs. PagBank and Polar return `console.warn` and `false`. |

### 🟢 LOW — Minor Issues

| # | Issue | Detail |
|---|-------|--------|
| **I-12** | `updateRiskScore()` has no tenantId guard | `client.repository.ts` line 32-39 uses `update` without `tenantId` filter — risk of cross-tenant update. |
| **I-13** | `markAsPaid()` has no tenantId guard | `invoice.repository.ts` line 41-55 uses `update` without `tenantId` filter. |
| **I-14** | Shared package types duplicated in domain | `packages/shared/src/index.ts` defines `InvoiceStatus`, `PaymentMethod`, `MessageChannel`, etc. which duplicate domain enums. Risk of drift. |
| **I-15** | Prisma schema diverges from SDD appendix A | SDD schema (Appendix A) has `PaymentProviderConfig`, `BillingSchedule`, `Subscription` models. Actual `schema.prisma` has a different Tenant model structure (inline config vs separate models). |
| **I-16** | Docker containers run as root | `docker-compose.dev.yml` doesn't specify `user: "node:node"` for backend/frontend. Security spec section 6.1 defines non-root but not implemented. |

---

## 4. CTO Ressalvas Assessment

### C-01: Domain as Zod Schemas — 🟡 ACCEPTABLE FOR MVP

**Current state**: Domain entities use Zod schemas + inferred types instead of class-based entities with VOs.

**My assessment**: Acceptable for MVP scaffold. The domain IS anemic — no VOs, no Entity base, no DomainError — but:
- `Invoice.canTransitionTo()` (lines 53-62) is proper domain logic
- `RiskScoreService` and `DecisionEngineService` contain business rules
- Domain events are typed with a factory
- Zod provides runtime validation at boundaries

**Risk if deferred beyond Sprint 2**: 🔴 HIGH. Business logic will scatter. The Sprint 2 conditions (Entity base, VOs, DomainError) are non-negotiable.

### C-02: No Use Cases — 🟡 ACCEPTABLE FOR MVP

**Current state**: No `application/usecases/`, no ports, no Either monad.

**My assessment**: Acceptable for scaffold because routes are stubs. However, I'm more concerned than the CTO about this. Without port interfaces, infrastructure implementations have no contract to implement against — increasing the risk of wrong abstractions in Sprint 2.

**Risk if deferred beyond Sprint 2**: 🔴 CRITICAL. Ports must be defined before infrastructure is built. This is the highest architectural debt.

### C-03: Routes Access Domain Directly — 🟡 ACCEPTABLE FOR MVP

**Current state**: `client.routes.ts` imports from domain; `webhook.routes.ts` imports from infrastructure.

**My assessment**: Acceptable for MVP. The webhook route importing HMAC is actually defensible — HMAC verification at the entry point is a cross-cutting security concern, not business logic. The Dependency Rule violation is real but acceptable for the scaffold phase.

**Risk if deferred beyond Sprint 2**: 🔴 HIGH. Every new endpoint reinforces the wrong pattern.

### C-06: No DI — 🟡 ACCEPTABLE FOR MVP

**Current state**: No composition root, no factories.

**My assessment**: ✅ Acceptable. There are no use cases to inject dependencies into. Manual DI (factory functions) is the right approach per team guidelines. No issue here.

### C-07: JWT Signature Verification Broken — ⚠️ STRONG RESSALVA

**Current state**: `verifyToken()` (jwt.strategy.ts, lines 18-28) ignores the `secret` parameter entirely.

**My assessment**: This is the **most impactful technical issue** in the codebase. The function is named `verifyToken` but performs **no verification** — only base64 decoding and expiration check.

**Why I accept it for MVP despite the severity**:
1. The API key auth path works correctly (env var comparison with literal string match)
2. All routes are stubs — there is no real data to expose
3. The auth plugin structure (global preHandler, public path exemptions, request decoration) is architecturally correct
4. The fix is well-understood (~30 min, code provided in CTO review)

**🔴 BUT — My condition is STRONGER than the CTO's**: This MUST be fixed **before any endpoint that returns real data or performs mutations is deployed**. Not just "before production data" — I require it before any non-stub endpoint. The current Bearer auth is equivalent to having **no auth at all** for the JWT flow.

---

## 5. Verdict

```diff
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│           🟡  VERDICT: APROVADO COM RESSALVAS                    │
│                                                                  │
│   The project can proceed to Sprint 1 iteration under the        │
│   following conditions:                                          │
│                                                                  │
│   ✅ SDD is comprehensive and provides a clear target            │
│   ✅ Security Spec is thorough (STRIDE per component)            │
│   ✅ HMAC webhook verification is production-grade               │
│   ✅ Auth plugin structure is architecturally correct            │
│   ✅ Domain services have proper business logic                  │
│   ✅ 336 tests with excellent structure (even if Red)           │
│   ✅ Docker setup is functional                                  │
│                                                                  │
│   🔴 BLOCKING if not resolved before real data:                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ I-01: JWT signature broken — FIX IMMEDIATELY before     │   │
│   │       any non-stub endpoint is deployed                  │   │
│   │ I-02: Rate limiting not registered — FIX in Sprint 1    │   │
│   │ I-03: BaseRepository lacks tenantId — FIX in Sprint 1   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   🟡 Architectural debt (C-01, C-02, C-03, C-06) is accepted    │
│       with documented Sprint 2 commitments.                     │
│                                                                  │
│   My approval is CONDITIONAL on:                                │
│   1. I-01 (JWT) fixed before any real data endpoint              │
│   2. I-02 (rate limiting) fixed by end of Sprint 1              │
│   3. I-03 (tenant isolation) fixed by end of Sprint 1           │
│   4. Sprint 2 delivers on all CTO conditions                     │
│                                                                  │
│   The core question — "Can we start Sprint 1 iteration?" —      │
│   is YES. The scaffold is safe enough (API key auth works,      │
│   HMAC works, no real data at risk) and well-documented.        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Conditions for Unblocking

| # | Condition | Severity | Required By | Owner |
|---|-----------|----------|-------------|-------|
| 1 | Fix JWT signature verification (I-01) | 🔴 Critical | Before any non-stub endpoint | Fullstack Engineer |
| 2 | Register rate limiting plugin (I-02) | 🔴 Critical | Sprint 1 end | Fullstack Engineer |
| 3 | Add tenantId to BaseRepository.findById() (I-03) | 🔴 Critical | Sprint 1 end | Fullstack Engineer |
| 4 | Clean Architecture remediation (C-01, VOs, Entity) | 🟡 High | Sprint 2 end | Fullstack Engineer |
| 5 | Application layer ports + use cases (C-02) | 🟡 High | Sprint 2 end | Fullstack Engineer |
| 6 | Routes refactored through application layer (C-03) | 🟡 High | Sprint 2 end | Fullstack Engineer |
| 7 | Composition root with factories (C-06) | 🟡 Medium | Sprint 2 end | Fullstack Engineer |
| 8 | Security headers (helmet) | 🟡 Medium | Sprint 2 end | Fullstack Engineer |
| 9 | HMAC per-tenant config (I-07) | 🟡 Medium | Sprint 2 end | Fullstack Engineer |

### Deferred Items
- PagBank/Polar HMAC configs (I-11) — Sprint 2 when those providers are integrated
- Docker non-root user (I-16) — Sprint 2 pre-production hardening
- Prisma schema alignment with SDD (I-15) — Sprint 2 
- Shared package deduplication (I-14) — Sprint 3

---

## Appendix: Clean Architecture Compliance Score

| Layer | Items Met | Total Items | Score |
|-------|-----------|-------------|-------|
| Domain (VOs, Entities, Errors) | 1/4 | 4 | 25% |
| Application (Use Cases, Ports, Either) | 0/5 | 5 | 0% |
| Infrastructure (Repository pattern, Ports impl, UoW) | 1/4 | 4 | 25% |
| Presentation (Routes, Factories, Error Handler) | 2/4 | 4 | 50% |
| **Overall** | **4** | **17** | **24%** |

This aligns with the CTO's 19/100 score. The architecture debt is intentional, documented, and has a clear remediation path.

---

*Review prepared by: Tech Nucleus Lead*  
*Escalation path: Fullstack Engineer (remediation) → CTO Agent (re-review on Sprint 1 completion) → Compliance Auditor (pre-production)*  
*Skills used: clean-architecture-reference (Section 9 checklist), codebase-design (deep module analysis)*
