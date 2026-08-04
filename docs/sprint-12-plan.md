# Sprint 12 Plan — Code Quality Hardening + Documentation

**Theme**: Code Quality Hardening + Documentation
**Period**: 2026-09-10 to 2026-09-17 (1 week)
**Target Release**: `v0.12.0`

---

## Pre-Sprint Context

Sprint 11 delivered alerting (Slack channel), Grafana/Prometheus dashboards, subscription analytics (MRR/churn/LTV), and a production CD with health-check + rollback, closing the last of the six major feature areas. Tag `v0.11.0` is cut. All six major feature areas are complete: payments multi-provider, subscription full lifecycle, recurring billing, observability + analytics, security, production CD.

**What exists now (verified in the repo):**

| Capability | Status |
|-----------|--------|
| Backend tests | ✅ 1028 |
| Frontend tests | ✅ 399 |
| TypeScript | ✅ 0 errors (`tsc --noEmit` clean, both apps) |
| Biome lint configured (`biome.json`: recommended preset, `a11y: warn`) | ✅ 403 files, **0 errors but 398 warnings** |
| CI workflow `.github/workflows/ci.yml` (lint-and-typecheck / test / coverage / e2e) | ✅ `npx biome ci .` exits 0 (warnings don't fail CI today) |
| E2E Playwright suite `e2e/playwright.config.ts` (baseURL `:3333`) + 5 spec files | ✅ `client-flow`, `invoice-flow`, `onboarding-flow`, `error-states` = API-level via `request`; **`dashboard-navigation` = browser-level (needs frontend at `:3000`)** |
| CI e2e job | ⚠️ starts **backend only** (see `ci.yml`), so the browser-level `dashboard-navigation.spec.ts` runs against a dead `:3000` → **fails in CI** |
| Swagger — `@fastify/swagger` + `@fastify/swagger-ui` at `/docs` (dev/test only, registered before auth) | ⚠️ `/docs` exists (45 endpoints) but some response schemas are loose/`additionalProperties` |
| `specs/` directory | ⚠️ only `clean-architecture-refactor.spec.md`; **no specs for Sprints 3–11 features** |
| `scripts/e2e-setup.sh` (docker-compose.e2e + backend + playwright) | ✅ local API-level e2e |
| `README.md` | ⚠️ header still **`v0.9.0 — Sprint 9`**; missing observability/analytics section |

---

## The five items this sprint closes (from remaining-gaps audit)

| Gap | Sprint 12 Item | Priority |
|-----|---------------|----------|
| 398 Biome warnings (noExplicitAny 197, noUnusedImports 52, noNonNullAssertion 51, a11y 25) — noise that hides real errors | **Item 1 — Biome warnings reduction** | 🔴 High |
| `specs/` only has `clean-architecture-refactor.spec.md`; unverifiable history for Sprints 3–11 features | **Item 2 — SDD spec backfill** | 🔴 High |
| Playwright browser spec (`dashboard-navigation`) has no live frontend → **fails in CI**; browser e2e not verified | **Item 3 — e2e Playwright integration** | 🔴 High |
| `/docs` exists but some response schemas are stubbed/loose | **Item 4 — Swagger completeness** | 🟡 Medium |
| `README.md` stale (says v0.9.0); observability/analytics undocumented | **Item 5 — README refresh** | 🟢 Low |

**Out of scope this sprint (mapped to backlog/future):**

| Gap | Priority | Where it lands |
|-----|----------|----------------|
| Clean-architecture fitness function (dependency-cruiser in CI) | 🟢 Low | Backlog — optional hard-gate after Item 1 baseline is green |
| Reintroduce test-double strategy gaps / security hardening beyond current | — | Existing `security-specialist` workflow |
| Any feature/new endpoint work | — | Sprint 13+ |

---

## Sprint Goal

Turn v0.11.0 (feature-complete) into a **hardened, documented, verifiable baseline**: cut Biome warnings from 398 to one decisive target with zero errors (Item 1), backfill the missing SDD specs so every shipped feature has an inspectable contract (Item 2), make the Playwright suite truly run in CI — browser smoke only when a frontend is actually up (Item 3), tighten the Swagger response schemas on the main endpoints (Item 4), and refresh the README to v0.12.0 with observable/analytics (Item 5). Each item produces contracts + tests only, per SDD.

---

## Dependency Graph

```
┌────────────────────────────────────────────────────────────────┐
│ Item 1: Biome warnings reduction (1.5d)          🔴 Stream A   │
│   - noExplicitAny (197): proper types or biome-ignore          │
│   - noUnusedImports (52): remove                              │
│   - noNonNullAssertion (51): proper guards                    │
│   - a11y (25) + misc (73): fix or document                     │
│   - Target per Item AC: 398 -> <200 (stretch <100)             │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 2: SDD spec backfill (2d)                   🔴 Stream A   │
│   - specs/subscription-lifecycle.spec.md                       │
│   - specs/recurring-billing.spec.md                            │
│   - specs/multi-provider-payments.spec.md                      │
│   - specs/observability.spec.md                                │
│   - specs/security.spec.md                                     │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 3: e2e Playwright integration (1d)        🔴 Stream A     │
│   - Fix browser smoke to gate on real frontend URL             │
│   - Keep vitest app.inject for API logic                       │
│   - CI: run browser smoke only when backend+frontend up        │
└──────────────┬─────────────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────────────┐
│ Item 4: Swagger response schemas (0.5d)      🟡 Stream B       │
│   - Complete response schemas for main endpoints               │
└────────────────────────────────────────────────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| Item 1 → Item 2 | The spec backfill reads *implemented* code; a clean, type-safe, warning-free codebase yields accurate contracts. Fixing warnings first makes the contracts reflect the intended final shape, not `any` stubs |
| Item 2 → Item 3 | Specs give the QA/browser tests their unambiguous acceptance contract; browser smoke asserts behaviors the spec pins |
| Item 3 → Item 4 | With e2e green, the Swagger response schemas can be matched 1:1 against verified real responses (no drift between docs and running API) |
| Item 4 (parallel Stream B) | Swagger schema tightening is independent of linting/specs — runs concurrently with Stream A |

---

## Parallel Streams

| Stream | Items | Total Effort | Dependency |
|--------|-------|-------------|------------|
| **Stream A (Quality Hardening)** | Item 1 → Item 2 → Item 3 | ~4.5 days | Fully sequential |
| **Stream B (API Documentation)** | Item 4 | ~0.5 day | Parallel, only needs the running backend to diff schemas |

> **Item 5 (README)** is a low-effort (~0.25d) slack-filler, taken during review/buffer at the end of the week; it does not sit on the critical path.

### Stream Diagram

```
Week 1 (Sep 10 - Sep 17):
┌─────────────────────────────────────────────────────────────────────────────┐
│ Day 0-2 (Sep 10-12):                                                          │
│   A: Item 1 — Biome warnings (1.5d) ─────► Item 2 — SDD backfill (2d) ───►  │
│   B: Item 4 — Swagger schemas (0.5d) ════════ (starts in parallel)           │
│                                                                               │
│ Day 3-4 (Sep 13-16):                                                          │
│   A: Item 2 (cont.) ────► Item 3 — Playwright e2e integration (1d) ─────►    │
│                                                                               │
│ Day 5-6 (Sep 15-17):                                                          │
│   A: Item 3 (cont.) / Shared Buffer / Item 5 README / Release Prep           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Critical Path

**Stream A: Item 1 (1.5d) → Item 2 (2d) → Item 3 (1d) + Item 5 (0.25d buffer) = ~4.75 calendar days**
**Stream B: Item 4 (0.5d) = 0.5 calendar day (fully parallel)**

Stream A completes within the week with ~0.25-day buffer for review, CTO validation, and release prep. Stream B finishes on day 1 and is fully absorbed.

---

## Item 1: Code warnings reduction (🔴 High, 1.5d)

**Effort**: 1.5 days
**Theme**: Quality
**Stream**: A
**Blocking**: Item 2
**Dependencies**: `biome.json` already configured; CI `biome ci .` step

### Description

Reduce the 398 Biome warnings to a single decisive target while keeping 0 errors. Currently warnings pass CI silently (`lint/typecheck` runs `npx biome ci .`), which defeats the purpose of a linter: the codebase carries 197 `noExplicitAny`, 52 `noUnusedImports`, 51 `noNonNullAssertion`, 25 `a11y`, and ~73 others. The three dominant categories are pure removal/refactor wins.

**Warning baseline (authoritative):**

| Rule category | Count | Action |
|---------------|-------|--------|
| `noExplicitAny` | 197 | Replace with proper types where feasible; targeted `// biome-ignore lint/suspicious/noExplicitAny: <reason>` only at genuine third-party/type-boundary (e.g. `any` payloads of untyped webhook bodies, `Function` in internal DI). Goal ≤ 40 remaining |
| `noUnusedImports` | 52 | Delete unused imports — mechanical, zero risk. Goal 0 |
| `noNonNullAssertion` | 51 | Replace `!` with explicit guards/`Either`/`if` (prefer existing `Result`). Goal ≤ 15 |
| `a11y` | 25 | Functional fixes where feasible (frontend); `// biome-ignore a11y/noLabelWithoutControl` only for genuinely decorative cases. Goal ≤ 15 |
| misc (rest) | ~73 | Triage: fix or document per category. Goal ≤ 40 |
| **Total** | **398** | **Goal `< 100`, floor at `<200` (explicit)** |

**Target resolution (documented to kill ambiguity):**
- **Primary (Definition of Done):** warnings `< 200`. This is the non-negotiable sprint gate.
- **Stretch (<100):** desired end-of-sprint; the dependency-graph number. If third-party `any` boundaries honestly block further reduction, the remaining gap goes to Sprint 13 with a documented list rather than being force-fixed with weak types.

**Note on CI semantics:** `npx biome ci .` exits non-zero only on *errors*; warnings pass. To make this hardening permanent, add `--error-on-warnings` to the lint step at the end of the sprint (after the warning count is gated at <200). This converts "exists" into "enforced".

### Deliverables

- Mapping of the 398 warnings (file × rule buckets) updated after each sub-pass.
- For non-mechanical `any` fixes: a `biome-ignore` comment with a 1-line reason (reviewable by CTO).

### Acceptance Criteria

- [ ] Biome reports **< 200 warnings total** (stretch: < 100); **0 errors** unchanged
- [ ] `npx biome check .` shows the new total; breakdown captured for CTO in the PR description
- [ ] `npx tsc --noEmit` clean (backend **and** frontend)
- [ ] All backend (1028+) and frontend (399+) tests still pass
- [ ] `noUnusedImports` → 0; `noNonNullAssertion` reduced per baseline targets
- [ ] Every remaining `any`/`a11y` disabled moment carries an inline `// biome-ignore <rule>: <reason>` — no bare disables
- [ ] `npx biome ci .` exits 0 (unchanged), and (stretch) `--error-on-warnings` toggle proven green at <100
- [ ] No behavioral change: fixture `curl`/spot tests pass; zero new Dependency Rule violations

---

## Item 2: SDD spec backfill (🔴 High, 2d)

**Effort**: 2 days
**Theme**: Documentation/SDD
**Stream**: A (blocked-by Item 1)
**Dependencies**: Item 1 (clean codebase → accurate contracts); existing `clean-architecture-refactor.spec.md` as the template

### What's needed

Backfill the `specs/` directory so Sprint 3–11 delivered features are inspectable as SDD contracts (context, architecture decision, contracts between layers, ACs that map to the *implemented* code, references). Each spec follows the shared template used in `clean-architecture-refactor.spec.md` (Contexto de Negócio / Escopo / ACs mensuráveis / Contratos entre camadas / Design Patterns / Definição de Pronto).

### Spec list (5+ files)

```
specs/subscription-lifecycle.spec.md     # create/cancel/pause/resume/expire/renew/upgrade/downgrade/TRIAL/GRACE_PERIOD/auto-renew (Sprint 6-10)
specs/recurring-billing.spec.md          # BillingCycle, calculateNextBilling(), auto-renew/recurrence + DLQ (Sprint 3-10)
specs/multi-provider-payments.spec.md    # PaymentProviderFactory + PaymentGatewayPort, Strategy, Asaas/Mercado Pago/Stripe/PagBank/Polar, webhooks+DLQ (Sprint 6-10)
specs/observability.spec.md              # pino JSON, /metrics + /health + /ready, Prometheus, Grafana, alerting (Sprint 10-11)
specs/security.spec.md                  # JWT, ApiKey, encryption, security headers, RBAC (Sprint 3-11)
```

> Scope note: if the `subscription-lifecycle` and `recurring-billing` specs partially overlap, keep each bounded (subscriptions = status lifecycle; recurring = billing-cycle math/invoice recurrence). The `security` spec can reference the existing `docs/security-spec.md` as upstream context.

Each spec MUST be traceable to real code — do a `grep`/read pass on the relevant `src/domain`, `src/application/ports`, and `src/routes` before writing ACs. The AC is "accurate to the implemented code" — no invented contracts.

### Acceptance Criteria

- [ ] At least **5 spec files** exist under `specs/` named as above (plus the existing `clean-architecture-refactor.spec.md`)
- [ ] Every spec follows the shared template (Contexto de Negócio / Escopo Incluído+Fora / ACs mensuráveis / Contratos entre camadas / Design Patterns / DoD)
- [ ] Each spec references the real symbols it pins: entities (`Subscription`, `Invoice`), ports (`PaymentGatewayPort`, `EventBusPort`, `Analytics*RepositoryPort`), routes (`/api/subscriptions`, `/api/analytics/subscriptions`, etc.), and/or domain events
- [ ] ACs in each spec are binary/testable (e.g. `grep` counts, HTTP status codes, formula outputs) — no "pode melhorar"
- [ ] Contracts between Domain / Application / Infrastructure / Presentation are unambiguous (types + methods + expected exceptions)
- [ ] `specs/` directory is listed in the Sprint 12 release notes as a new deliverable
- [ ] No change to runtime code is required to make the specs accurate (documentation-only, no source edits)

---

## Item 3: e2e Playwright integration (🔴 High, 1d)

**Effort**: 1 day
**Theme**: CI/E2E
**Stream**: A (last)
**Dependencies**: Item 2 (specs give the browser-level smoke its assertion contract); existing Playwright config + `e2e/` specs; `scripts/e2e-setup.sh`; CI `e2e` job

### What exists (verified)

- `e2e/playwright.config.ts`: `testDir: ./tests`, baseURL `:3333`, `reporter: html+list`, `retries: 2` in CI, chromium project only.
- Specs: `client-flow`, `invoice-flow`, `onboarding-flow`, `error-states` are **API-level** (use `request` fixture + `API_URL`/`AUTH_HEADERS`). `dashboard-navigation` is **browser-level** (`page.goto`, `BASE_URL`).
- `scripts/e2e-setup.sh`: starts `docker-compose.e2e` + backend + `npx playwright test` — backend-only.
- CI `ci.yml` **e2e job**: installs Chromium, runs `migrate deploy`, **starts backend only**, sets `BASE_URL=http://localhost:3000` — i.e. **the frontend never runs** → `dashboard-navigation.spec.ts` hits a dead `:3000` and fails.

### Decision (recommended)

Keep **two distinct slices that never contend**:

1. **API-level Playwright** (`client-flow`, `invoice-flow`, `onboarding-flow`, `error-states`) → run against the **real backend** (works today, in CI after backend-only start). These run in the browser suite but exercise the HTTP contract, not the DOM.
2. **Browser-level smoke** (`dashboard-navigation`) → run **only when a frontend is actually available**, gated by an env flag (e.g. `E2E_FRONTEND_URL`). When unset/absent → `test.skip` (with a clear log), never silently fail. When set → assert dashboard loads + navigates.

**Wiring for CI:** split CI's e2e into two jobs (or two `playwright` invocations):
- `e2e-api`: starts backend only; runs the 4 API-level spec files (`--grep` filter or a separate `project`).
- `e2e-browser`: starts backend **and** frontend (build+start `apps/frontend`, or serve a static export), exports `E2E_FRONTEND_URL=http://localhost:3000`, runs `dashboard-navigation.spec.ts`.

Baseline coverage: both slices must be green (or explicitly skipped-with-reason) before the sprint closes.

### Deliverables / Acceptance Criteria

- [ ] `e2e/playwright.config.ts` remains **a valid config** (`npx playwright test --list` runs clean)
- [ ] `dashboard-navigation.spec.ts` browser smoke (dashboard loads + navigates) runs green when `E2E_FRONTEND_URL` points at a live frontend, and **skips with reason** when it isn't (no false failure)
- [ ] Chromium-only, deterministic waits (`no flaky "networkidle"`)
- [ ] Maintain 4 API-level specs **green** against real backend in CI (backend-only start remains sufficient)
- [ ] CI `.yml` updated: e2e job(s) run Playwright only when the relevant target(s) (backend / backend+frontend) are up
- [ ] `scripts/e2e-setup.sh` documents how to bring up both services locally for the browser slice
- [ ] Bonus (low, in this sprint if budget allows): fix the stale `|| echo "Frontend tests not configured yet"` in the CI **test** job — frontend vitest IS configured; the `|| echo` silently masks frontend failures. Remove the fallback.

---

## Item 4: Swagger completeness (🟡 Medium, 0.5d)

**Effort**: 0.5 days
**Theme**: API Docs
**Stream**: B (parallel)
**Dependencies**: existing `@fastify/swagger` + `/docs`/json output

### What's needed

`/docs` exposes 45 endpoints, but some response schemas are stubbed/loose (`additionalProperties`) for the main read/create paths. Tighten the OpenAPI response models for the top entities so consumers (frontend + future SDKs) have a contract, without touching runtime behavior.

Primary contracts to complete:
- `Client` — `POST/GET /api/clients`, `GET /api/clients/:id`
- `Invoice` — `POST/GET /api/invoices`, `GET /api/invoices/:id`
- `Subscription` — `POST /api/subscriptions`, `GET /api/subscriptions/:id`
- Align with the `packages/shared` types where they exist (single source of truth).

### Deliverables

- JSON Schema response bodies (in the Fastify route `schema.response` — the Fastify way). Resolving `additionalProperties` → explicit `properties`/`required`.
- No behavior change: `tags`/docs wording edits only.

### Acceptance Criteria

- [ ] `/docs` (and `/docs/json`) show **defined shapes** (typed `properties`/`required`, no `additionalProperties: true` stub) for `client`/`invoice`/`subscription` get/create responses
- [ ] Response shapes match actual runtime responses (verify with e2e round-trip from Item 3 + a spot `curl`)
- [ ] `npx tsc --noEmit` clean
- [ ] All backend tests still pass (schema-only change; zero route/handler logic touched)

---

## Item 5 (low priority): README refresh (🟢 Low, 0.25d)

- Bump header to `v0.12.0` and reflect the sprint/status line (currently says `v0.9.0 (Sprint 9)`)
- Add **Observability & Analytics** section: pino, `/metrics`, Prometheus+Grafana dashboards, alerting channels, MRR/churn/LTV endpoint (Sprint 10-11)
- Refresh the ADR list to include the new architectural facts (alert Port/Adapter, analytics projection, CD/rollback)
- Update test/quality badges/numbers to the Sprint 12 baseline (backend 1028+, frontend 399+, Biome 0 errors)

### Acceptance Criteria

- [ ] README first block states `v0.12.0`
- [ ] Observability & Analytics section documents `/metrics`, dashboards, alerting, analytics endpoint
- [ ] No stale feature claims left from v0.9.0 (spot-check against `src/routes`)

---

## Effort Summary Table

| Item | Description | Days | Theme | Stream | Depends On | Blocks |
|------|-------------|------|-------|--------|------------|--------|
| 1 | **Biome warnings reduction (398 → <200 gate, <100 stretch)** | 1.5 | Quality | A | — | Item 2 |
| 2 | **SDD spec backfill (5+ specs for Sprints 3-11)** | 2.0 | Documentation | A | Item 1 | Item 3 |
| 3 | **e2e Playwright integration (API-level + browser smoke gating)** | 1.0 | E2E | A | Item 2 | — |
| 4 | **Swagger response schemas (client/invoice/subscription)** | 0.5 | API Docs | B | — | — |
| 5 | **README refresh (v0.12.0 + observability)** | 0.25 | Docs | A (buffer) | — | — |
| | **Total** | **5.25 days** | | | 2 streams | |

### Sprint Capacity

- **Total effort**: 5.25 days (Stream A 4.75 + Stream B 0.5)
- **Sprint duration**: 1 week (5 working days)
- **Stream factor**: Stream A (4.75d) + Stream B (0.5d parallel) + Item 5 slack-filler (~0.25d inside the buffer)
- **Calendar time**: ~4.75 days along the critical path → fits with ~0.25d review/release buffer
- **Feasibility**: ✅ Fits within 1-week sprint

---

## Risk Register

### 🔴 High Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Any/types at third-party boundaries can't be fully removed within 1.5d | High | Medium | Define gate at **<200 (floor)** with **<100 stretch**; documents remaining `any` → Sprint 13 carry-over list. Gate = <200, not perfection |
| CI e2e `dashboard-navigation` continues to fail against a non-running frontend | Medium | High | Item 3 gates the browser slice via `E2E_FRONTEND_URL`; when unset it **skips with reason** — no false reds, no false greens |
| Spec backfill drifts from implemented code (invented contracts) | Medium | High | Write each spec from `src/domain`/`ports`/`routes` via grep/trace first; CTO audits contracts vs code |

### 🟡 Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `--error-on-warnings` toggle flips CI red after biasing | Medium | Medium | Only enable it once count gated at <100 confirmed green; merged separately, reversible via a single line |
| Loose schemas in `/docs` cause downstream reader drift | Medium | Low | Match schemas to real responses (Item 4 spot + e2e round-trip); single source of truth in `packages/shared` |

### 🟢 Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| README numbers already stale next week | Low | Low | State "baseline at sprint start" (v0.12.0, 1028+/399+), not a frozen promise |
| 5th spec dropping coverage of a minor Sprint-3 security feature | Low | Low | `security.spec.md` covers the affected features; edge cases self-documented in Out-of-Scope footnotes |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] **Item 1**: warnings **398 → <200** (stretch <100), 0 errors; `noUnusedImports` → 0; mechanical `any`/`!` replaced or ignored-with-reason; `--error-on-warnings` toggle proven at <100
- [ ] **Item 2**: **5+ SDD specs** created/backfilled in `specs/` (subscription-lifecycle, recurring-billing, multi-provider-payments, observability, security), each accurate to the implemented code
- [ ] **Item 3**: Playwright e2e **green** (API-level against real backend; browser smoke gated on `E2E_FRONTEND_URL` → runs when frontend up, skips-with-reason otherwise); CI wired
- [ ] **Item 4**: Swagger response schemas improved for main endpoints (client/invoice/subscription)
- [ ] **Item 5**: README reflects **v0.12.0** + observability/analytics section

### Stretch Goals

- [ ] Biome warnings **<100** (not just <200)
- [ ] `npx biome ci --error-on-warnings .` green (permanent regression gate)

### Quality Gates

- [ ] Backend tests **1028+** pass; frontend tests **399+** pass
- [ ] `tsc --noEmit` clean (backend **and** frontend)
- [ ] `npx biome check .` → 0 errors (warnings per AC)
- [ ] Zero new Dependency Rule violations (rechecked by `cto`)
- [ ] Previous e2e failure scenario fixed: browser smoke no longer red against non-running frontend

### Architecture Checks (for the `cto`)

- [ ] No `switch`/`if` by provider/gateway added; all new bindings honor Strategy Pattern
- [ ] Any new Specs reflect the actual layer boundaries (Domain/Application/Infrastructure/Presentation)
- [ ] `packages/shared` stays the single source of truth for Swagger responses
- [ ] Every disabled `any`/`a11y`/`noNonNullAssertion` has a human reason, not a blanket toggle

### Release

- [ ] **Tag `v0.12.0`** created
- [ ] Release notes written (Sprint 12 summary — lint hardening, spec backfill, e2e wiring, Swagger, README)
- [ ] README header bumped to `v0.12.0`
- [ ] `.github/workflows/ci.yml` reflects the hardened lint + e2e layout (no stale test fallback)

---

## Agile Sprint Specs to Generate

These SDD specs are the *new* work products of this sprint (distinct from the *backfilled* specs in Item 2):

| Spec | Contracts covered | Priority |
|------|-------------------|----------|
| `specs/code-quality-baseline.spec.md` | Biome gates (0 errors, <200 warn, `--error-on-warnings`), accepted disable patterns + rationale | High (before Item 1) |

The SDD backfill in Item 2 is itself the documentation deliverable; no additional runtime spec is authored for Items 3-5 (they are infra/docs/e2e chores covered by ACs).

---

## GitHub Workflow Metadata (for `scrum-master`)

Each of the 4 sprint items becomes a ticket (via `to-tickets`) as an issue linked to the relevant spec / ACs; the label/Milestone convention follows `scrum-github-mapping`:

- Milestone: **`Sprint 12 — Code Quality Hardening + Documentation`**, due `2026-09-17T23:59:59Z`
- Labels: `type:chore` for Items 1, 5; `type:docs` for Item 2; `type:test` for Item 3; `type:feature` for Item 4; `priority:high` for Items 1-3, `priority:medium` for Item 4, `priority:low` for Item 5
- DoR checklist on each issue: spec ref, copied ACs, size (P/M/G), `blocked by #N` edges (Item 2 blocked by Item 1, Item 3 blocked by Item 2)

---

*Plan prepared by: Architect Agent*
*Date: 2026-09-09*
*Related documents: `docs/sprint-11-plan.md`, `docs/security-spec.md`, `specs/clean-architecture-refactor.spec.md`, `.github/workflows/ci.yml`, `e2e/playwright.config.ts`*