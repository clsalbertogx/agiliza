# Sprint 6.1 Plan — Consistency & Architecture Hardening

**Theme**: Hotfix Sprint — Resolve All Audit Inconsistencies  
**Period**: 1 day  
**Target Release**: `v0.6.1`  
**Type**: 🔴 Hotfix (zero new features — only fixes)

---

## Pre-Sprint Context

Sprint 6 delivered **6 items** — PaymentRepositoryPort + Recording, Subscription Module (create/cancel), Payment History API, EventBus Integration Tests, Frontend Remaining Component Tests (138→204 tests), and Dashboard Real Data. The codebase now has **~210 backend source files**, **~14 active Port interfaces**, **14 use cases**, **~72 backend test files (~750 tests passing)**, **~12 frontend test files (~204 tests passing)**.

During the **full project audit** (covering architecture, security, compliance, code quality), **15 findings** were identified across 4 dimensions. These findings range from Dependency Rule violations (entities importing from `@/application/`) to dead code, misconfigured CI, and missing frontend coverage.

**Why a dedicated hotfix sprint (6.1) instead of rolling into Sprint 7:**
1. **Architecture correctness**: 5 entities violate the Dependency Rule by importing `Either` from `@/application/` — this breaks the fundamental Clean Architecture invariant that domain depends on nothing.
2. **Security surface**: The UUID v7 migration is incomplete — 5 production files still use `crypto.randomUUID()` instead of `generateUUID()`, which means UUIDs are not sortable and tenant isolation queries relying on monotonic ordering are unreliable.
3. **Shared package rot**: `@agiliza/shared` is published but unused; the `PaymentEvent` alias exports the wrong type; the frontend is missing it as a dependency.
4. **CI gaps**: Frontend coverage is not enforced in CI; Docker image alignment is broken; E2E healthcheck is flaky.

These issues compound each Sprint if left unfixed — Sprint 7 would start with architectural debt that undermines all new feature work.

### Findings Inventory

| # | Dimension | Finding | Severity |
|---|-----------|---------|----------|
| F01 | Architecture | `Either` imported from `@/application/` by 5 domain entities | 🔴 Critical |
| F02 | Security | `crypto.randomUUID()` in 5 production files instead of `generateUUID()` | 🔴 Critical |
| F03 | Package | `@agiliza/shared` unused; `PaymentEvent` alias wrong type; frontend missing dep | 🔴 Critical |
| F04 | Architecture | Use cases missing from barrel; factory barrel missing `register-event-handlers`; dead `entity.ts` | 🔴 Critical |
| F05 | Config | `REDIS_PASSWORD` missing from `.env.example`; `@vitest/coverage-v8` version mismatch; `build=lint` scripts | 🔴 Critical |
| F06 | Frontend | 4 unused components; 6 untested; 1 zombie test; inconsistent barrel | 🟡 Medium |
| F07 | CI | Frontend coverage thresholds not enforced in CI pipeline | 🟡 Medium |
| F08 | Config | Docker image alignment; E2E healthcheck flakiness; CI error swallowing | 🟢 Low |

---

## Sprint Goal

**Zero audit findings, zero regressions.** Close all 15 findings (grouped into 8 fix items) across 4 parallel streams. The codebase must pass every architecture invariant (Dependency Rule, UUID v7, barrel completeness, CI gate) by end of day.

---

## Dependency Graph

```
                     ┌─────────────────────────────────────────────┐
                     │           Stream A: Architecture            │
                     │  (Items 1, 2, 4 — 1.5d parallelizable)     │
                     │                                             │
                     │  ┌───────────────────┐                     │
                     │  │ Item 1: Domain    │                     │
                     │  │ Dependency Rule   │  0.5d               │
                     │  └────────┬──────────┘                     │
                     │           │                                 │
                     │  ┌────────▼──────────┐                     │
                     │  │ Item 2: UUID v7   │                     │
                     │  │ Migration         │  0.5d (parallel)    │
                     │  └────────┬──────────┘                     │
                     │           │                                 │
                     │  ┌────────▼──────────┐                     │
                     │  │ Item 4: Barrel    │                     │
                     │  │ Exports + Dead    │  0.5d (parallel)    │
                     │  │ Code              │                     │
                     │  └───────────────────┘                     │
                     └─────────────────────────────────────────────┘

                     ┌─────────────────────────────────────────────┐
                     │           Stream B: Package                 │
                     │  (Items 3, 5 — 1d, parallel with A)        │
                     │                                             │
                     │  ┌───────────────────┐                     │
                     │  │ Item 3: Fix       │                     │
                     │  │ Shared Package    │  0.5d               │
                     │  └────────┬──────────┘                     │
                     │           │                                 │
                     │  ┌────────▼──────────┐                     │
                     │  │ Item 5: Fix       │                     │
                     │  │ Config Gaps       │  0.5d               │
                     │  └───────────────────┘                     │
                     └─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐   ┌──────────────────────┐
│           Stream C: Frontend                │   │   Stream D: CI       │
│  (Item 6 — 1d, parallel with A+B)          │   │  (Items 7, 8 — 0.5d) │
│                                             │   │                      │
│  ┌──────────────────────────────────────┐   │   │  ┌────────────────┐  │
│  │ Item 6: Frontend Cleanup             │   │   │  │ Item 7: CI     │  │
│  │ • Remove 4 unused components         │   │   │  │ Coverage for  │  │
│  │ • Test 6 untested components         │   │   │  │ Frontend      │  │
│  │ • Delete zombie test                 │   │   │  └───────┬────────┘  │
│  │ • Fix barrel exports                 │   │   │          │           │
│  └──────────────────────────────────────┘   │   │  ┌───────▼────────┐  │
│                                             │   │  │ Item 8: Minor │  │
│  Total: 1d (full parallel with A+B)         │   │  │ Config Fixes  │  │
└─────────────────────────────────────────────┘   │  └────────────────┘  │
                                                  │                      │
                                                  │  Total: 0.5d         │
                                                  │  (depends on A done) │
                                                  └──────────────────────┘
```

### Dependency Rationale

| Edge | Rationale |
|------|-----------|
| Stream A → Stream D | CI config fixes (Item 7, 8) should run after architecture fixes (Items 1, 2, 4) are merged — ensures CI gates test the corrected code. Can run in parallel if branches are independent. |
| Stream A items | Fully parallel — `Either` fix touches domain files, UUID v7 touches infrastructure/domain, barrel touches factories. No file conflicts. |
| Stream B | Fully parallel with Stream A — shared package and config are independent of domain/architecture changes. |
| Stream C | Fully parallel with Streams A and B — frontend cleanup is a separate application. |

---

## Item 1: Fix Domain Entity Dependency Rule (🔴 Critical, 0.5d)

**Effort**: 0.5 day  
**Theme**: Architecture  
**Stream**: A  
**Dependencies**: None  
**Findings**: F01

### Description

5 domain entities currently import `Either` from `@/application/types/either`, which violates the Clean Architecture **Dependency Rule** — the Domain layer must depend on nothing; it should be the innermost, most stable layer.

**The problem:**

```typescript
// domain/entities/some-entity.ts  ← WRONG: domain importing from application
import { Either } from '@/application/types/either';
```

This creates a circular dependency potential and couples the domain to application types. The `Either` type is a general-purpose functional programming construct — it belongs in the domain layer, not in application.

**The fix:**

1. **Move `Either` to `@/domain/types/either.ts`** — create a new file that re-exports the existing `Either`, `success()`, `failure()` implementation. This is a pure type/utility with zero infrastructure dependencies.
2. **Update all 5 domain entities** to import from `@/domain/types/either`.
3. **Update the re-export in `@/application/types/either`** to re-export from `@/domain/types/either` (backward compatibility for existing application-layer imports).
4. **Verify**: zero domain files import from `@/application/` or any layer above.

**Affected files (5 entities):**

| File | Current Import | Fix To |
|------|---------------|--------|
| `domain/entities/invoice.ts` | `@/application/types/either` | `@/domain/types/either` |
| `domain/entities/client.ts` | `@/application/types/either` | `@/domain/types/either` |
| `domain/entities/payment.ts` | `@/application/types/either` | `@/domain/types/either` |
| `domain/entities/subscription.ts` | `@/application/types/either` | `@/domain/types/either` |
| `domain/entities/decision.ts` (or similar) | `@/application/types/either` | `@/domain/types/either` |

**Application layer files** that import `Either` continue to work via the re-export shim:

```typescript
// application/types/either.ts — backward compat shim
export { Either, success, failure } from '@/domain/types/either';
```

### Acceptance Criteria

- [ ] `@/domain/types/either.ts` created with `Either`, `success()`, `failure()` definitions
- [ ] All 5 domain entities import `Either` from `@/domain/types/either` (not from `@/application/`)
- [ ] `@/application/types/either.ts` re-exports from `@/domain/types/either` (backward compat)
- [ ] Zero domain files import from `@/application/` or `@/infrastructure/` (verified by grep)
- [ ] `tsc --noEmit` passes on backend
- [ ] All existing backend tests continue to pass (~750)
- [ ] Zero new Dependency Rule violations (CTO gate)

---

## Item 2: Complete UUID v7 Migration (🔴 Critical, 0.5d)

**Effort**: 0.5 day  
**Theme**: Architecture / Security  
**Stream**: A  
**Dependencies**: None  
**Findings**: F02

### Description

5 production files still use `crypto.randomUUID()` (which generates UUID v4) instead of the project's `generateUUID()` function (which generates UUID v7). UUID v7 is time-sortable, which enables:
- Monotonic ordering in database indexes (better B-tree performance)
- Chronological sorting without a separate `createdAt` column
- Consistent ID generation across the application

**The problem:**

```typescript
// Some file still using v4
const id = crypto.randomUUID();  // v4 — wrong

// Should be
const id = generateUUID();        // v7 — correct
```

**Affected files (hypothetical locations — verify via grep before fixing):**

| # | Likely File | Pattern |
|---|-------------|---------|
| 1 | `infrastructure/database/mappers/*.mapper.ts` | `crypto.randomUUID()` in test/factory helpers |
| 2 | `infrastructure/auth/*.ts` | Token or session ID generation |
| 3 | `domain/entities/*.ts` | Entity factory/default methods |
| 4 | `application/usecases/*.test.ts` | Test fixtures using `randomUUID()` |
| 5 | `presentation/factories/*.ts` | Factory test helpers |

**The fix:**

1. **Grep all `crypto.randomUUID()` occurrences** across backend production files (exclude `node_modules`, exclude test files that explicitly test UUID generation).
2. For each occurrence:
   - Replace `crypto.randomUUID()` with `generateUUID()` (imported from the project's UUID utility)
   - If `crypto` is only used for `randomUUID()` in that file, remove the `crypto` import
3. Verify all 5 occurrences are eliminated.
4. Update the project's `generateUUID()` utility if it doesn't already exist at a standard location (e.g., `@/infrastructure/uuid.ts` or `@/domain/ports/id-generator.port.ts`).

**Note**: If `generateUUID()` does not exist yet, create it using a UUID v7 library (e.g., `uuidv7` package) and wire it through `IdGeneratorPort`:

```typescript
// domain/ports/id-generator.port.ts
export interface IdGeneratorPort {
  generate(): string;
}

// infrastructure/uuid.ts
import { uuidv7 } from 'uuidv7';
export const generateUUID = (): string => uuidv7();
```

### Acceptance Criteria

- [ ] Zero `crypto.randomUUID()` calls in production backend code (grep confirms)
- [ ] All ID generation uses `generateUUID()` (UUID v7) or `IdGeneratorPort.generate()`
- [ ] `IdGeneratorPort` (or equivalent) exists and is injected in use cases
- [ ] `tsc --noEmit` passes on backend
- [ ] All existing backend tests continue to pass
- [ ] No duplicate `generateUUID()` implementations — single source of truth

---

## Item 3: Fix Shared Package (🔴 Critical, 0.5d)

**Effort**: 0.5 day  
**Theme**: Package / Dependencies  
**Stream**: B  
**Dependencies**: None  
**Findings**: F03

### Description

The `@agiliza/shared` package is suffering from 3 problems:

1. **Unused**: The package is published/compiled but no source file imports it (dead weight in the monorepo).
2. **Wrong `PaymentEvent` type**: The alias/re-export of `PaymentEvent` at the shared package boundary exports an incorrect type — it does not match the canonical `PaymentEvent` domain event definition. Any consumer importing from `@agiliza/shared` gets the wrong type signature.
3. **Frontend missing dependency**: The frontend package does not list `@agiliza/shared` as a dependency, even though it may need shared types for payment events, invoice statuses, etc.

**The fix:**

#### 3A: Audit `@agiliza/shared` Usage

- Grep all workspace files for `from '@agiliza/shared'` imports
- If zero imports exist (except `package.json`), the package is truly unused

#### 3B: Fix `PaymentEvent` Type

- Locate the `PaymentEvent` type/interface in the shared package
- Compare it to the canonical `PaymentEvent` in domain events
- Align the types — export exactly the same shape
- Add a barrel export test that verifies `PaymentEvent` matches the domain definition

#### 3C: Add Frontend Dependency

- Add `@agiliza/shared` to `apps/frontend/package.json` dependencies
- Update the shared package's `package.json` to ensure its `main`/`exports` point to valid compiled output
- Ensure the shared package compiles without errors (`tsc` in the shared workspace)

#### 3D: Decision — Keep or Remove

If the package is truly unused and the frontend doesn't need it after audit:

- **Option A (keep)**: Fix the types, add the dependency, document the package's purpose in its README
- **Option B (remove)**: Delete the package, remove it from workspace config, update all references

**Recommended**: Keep and fix. Shared types for domain events, invoice statuses, and payment events are valuable for cross-package contracts. Removing creates future re-integration work.

### Acceptance Criteria

- [ ] `PaymentEvent` type in `@agiliza/shared` matches canonical domain event definition
- [ ] `@agiliza/shared` is importable and type-checks correctly (`tsc` passes in the package)
- [ ] Frontend `package.json` includes `@agiliza/shared` as a dependency (if the package is kept)
- [ ] Barrel export test verifies `PaymentEvent` type alignment
- [ ] No compile errors in shared package
- [ ] `tsc --noEmit` passes across all workspaces

---

## Item 4: Fix Barrel Exports + Dead Code (🔴 Critical, 0.5d)

**Effort**: 0.5 day  
**Theme**: Architecture / Code Quality  
**Stream**: A  
**Dependencies**: None  
**Findings**: F04

### Description

Three related code quality issues found during audit:

1. **Use cases not in barrel**: Some use cases exist in `application/usecases/` but are not exported from the barrel file (`application/usecases/index.ts` or equivalent). This means:
   - They can only be imported by direct path (fragile refactoring)
   - Automated dependency analysis tools miss them
   - New team members don't discover them via the barrel

2. **`register-event-handlers` not in factory barrel**: The event handler registration function lives in `presentation/factories/register-event-handlers.ts` but is not exported from the factories barrel (`presentation/factories/index.ts`). Factories are the composition root — every entry point should be discoverable through the barrel.

3. **Dead `entity.ts`**: An orphaned `domain/entities/entity.ts` file exists (likely an older `BaseEntity` or `Entity<T>` that was replaced). It is imported by zero files and can be safely removed. If it contains the canonical `BaseEntity` class, verify that all entities now use `@/domain/entities/base-entity.ts` (or wherever `BaseEntity` now lives).

**The fix:**

#### 4A: Audit Use Case Barrel

```typescript
// application/usecases/index.ts — verify all use cases are listed
export { CreateClientUseCase } from './create-client.usecase';
export { CreateInvoiceUseCase } from './create-invoice.usecase';
export { ProcessPaymentUseCase } from './process-payment.usecase';
export { ProcessPaymentWebhookUseCase } from './process-payment-webhook.usecase';
export { GetNextDecisionUseCase } from './get-next-decision.usecase';
export { ListInvoicesUseCase } from './list-invoices.usecase';
export { GetInvoiceUseCase } from './get-invoice.usecase';
export { ListClientsUseCase } from './list-clients.usecase';
export { GetClientUseCase } from './get-client.usecase';
export { GetInvoiceStatsUseCase } from './get-invoice-stats.usecase';
export { CreateSubscriptionUseCase } from './create-subscription.usecase';
export { CancelSubscriptionUseCase } from './cancel-subscription.usecase';
export { ListPaymentsForInvoiceUseCase } from './list-payments-for-invoice.usecase';
// ... add any missing use cases
```

- Grep the use cases directory for all `.ts` files (excluding `.test.ts`)
- Compare against the barrel
- Add missing exports

#### 4B: Add `register-event-handlers` to Factory Barrel

```typescript
// presentation/factories/index.ts — add missing export
export { registerEventHandlers } from './register-event-handlers';
```

#### 4C: Handle Dead `entity.ts`

- If `domain/entities/entity.ts` exists and is not imported anywhere:
  - Move any unique/valuable code to the correct file (e.g., `base-entity.ts`)
  - **Delete** the dead file
- If it IS the canonical `BaseEntity`, rename/reorganize it properly

### Acceptance Criteria

- [ ] All use cases in `application/usecases/` are exported from the barrel index
- [ ] `registerEventHandlers` (or equivalent) is exported from `presentation/factories/index.ts`
- [ ] Dead `domain/entities/entity.ts` is either removed or properly consolidated into `base-entity.ts`
- [ ] Zero files import from the deleted dead file path (grep confirms)
- [ ] `tsc --noEmit` passes on backend after all changes
- [ ] All existing tests continue to pass
- [ ] No duplicate exports or naming conflicts in barrels

---

## Item 5: Fix Config Gaps (🔴 Critical, 0.5d)

**Effort**: 0.5 day  
**Theme**: Config / Dev Experience  
**Stream**: B  
**Dependencies**: None  
**Findings**: F05

### Description

Three configuration gaps found during audit:

1. **`REDIS_PASSWORD` missing from `.env.example`**: The application uses Redis (via BullMQ), and the production/staging environments likely require a Redis password. But `.env.example` does not document it. This means:
   - New developers don't know they need to configure it
   - CI/deployment scripts may fail silently if Redis auth is enabled
   - Security best practice (always set a Redis password in production) is not documented

2. **`@vitest/coverage-v8` version mismatch**: The installed version of `@vitest/coverage-v8` in the backend does not match the version required by the project's Vitest configuration. This causes:
   - Coverage reporting to fail or produce incorrect results
   - CI coverage gates to be unreliable
   - Warning/error messages during test runs

3. **`build=lint` scripts**: Some `package.json` scripts conflate build and lint checks (e.g., `"build": "lint && tsc"` or `"lint": "tsc --noEmit"`). This means:
   - You cannot build without linting (linter failures block builds even when code compiles)
   - CI build steps are slower than necessary
   - The separation of concerns between static analysis and compilation is lost

**The fix:**

#### 5A: Add `REDIS_PASSWORD` to `.env.example`

```env
# .env.example (add to existing Redis section)
REDIS_PASSWORD=your_redis_password_here
```

- If the app reads `REDIS_PASSWORD` in config, document it
- If the app doesn't read it yet, add the config variable and wire it into the Redis/BullMQ connection
- Default to empty string (no password) for local development

#### 5B: Fix `@vitest/coverage-v8` Version

- Check the installed version: `npm ls @vitest/coverage-v8` in the backend package
- Check the required version in Vitest config or `package.json` peer dependencies
- Align the version — update `package.json` or lock file

#### 5C: Fix Build/Lint Script Separation

```jsonc
// package.json — separate concerns
{
  "scripts": {
    "lint": "tsc --noEmit",          // type-check only
    "build": "tsc",                   // compile only
    "ci": "lint && build && test"     // full CI pipeline
  }
}
```

- Ensure `build` does NOT call `lint` (or vice versa)
- Ensure CI pipeline calls both explicitly: `lint` first, then `build`, then `test`

### Acceptance Criteria

- [ ] `REDIS_PASSWORD` documented in `.env.example` with clear comment
- [ ] App config reads `REDIS_PASSWORD` and passes it to Redis/BullMQ connection
- [ ] `@vitest/coverage-v8` version matches project requirements — no version mismatch warnings
- [ ] `npm install` resolves cleanly (no peer dependency warnings for coverage)
- [ ] `build` script does NOT call `lint` (or vice versa) — concerns are separated
- [ ] `lint` runs `tsc --noEmit` (or equivalent) independently
- [ ] `ci` script (or CI pipeline) calls `lint && build && test` in sequence
- [ ] All existing tests continue to pass
- [ ] `npm run build` produces correct output

---

## Item 6: Frontend Cleanup (🟡 Medium, 1d)

**Effort**: 1 day  
**Theme**: Frontend / Quality  
**Stream**: C  
**Dependencies**: None  
**Findings**: F06

### Description

Four frontend issues found during audit:

1. **4 unused components**: Components that exist in the source tree but are imported by zero files (dead code). This inflates bundle size, confuses new developers, and adds maintenance surface area.
2. **6 untested components**: Components with zero test coverage, below the project's quality threshold.
3. **1 zombie test**: A test file that passes trivially (no assertions), tests deleted functionality, or is skipped/disabled — providing false confidence.
4. **Inconsistent barrel**: The frontend components barrel (`components/index.ts` or equivalent) is missing some components or has inconsistent export patterns.

**The fix:**

#### 6A: Identify and Remove Unused Components

- Use a tool (`ts-prune`, `unimported`, or manual grep) to find components exported but never imported
- For each unused component:
  - **Remove** the component file
  - Remove its barrel export
  - If it has a test file, remove it too
- Document removed components in the PR description (for easy resurrection if needed)

#### 6B: Test 6 Untested Components

Priority order for the 6 untested components:

| Priority | Component | Minimum Test Cases |
|----------|-----------|-------------------|
| P0 | Any component used in dashboard or invoice flow | Happy path, loading state, error state |
| P1 | Any shared/reusable component | Render variants, props reflected in DOM |
| P2 | Any feature-specific component | Core behavior, empty state |

Test patterns (consistent with existing frontend tests):

```typescript
import { render, screen } from '@testing-library/react';
import { ComponentName } from '@/components/component-name';

describe('ComponentName', () => {
  it('renders in default state', () => {
    render(<ComponentName />);
    expect(screen.getByTestId('component-name')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    render(<ComponentName loading />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('displays error state on failure', () => {
    render(<ComponentName error="Failed to load" />);
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });
});
```

#### 6C: Fix/Remove Zombie Test

- Identify the zombie test:
  - Grep for `test.skip`, `it.skip`, `describe.skip`
  - Check for test files with zero assertions (grep for `expect(`)
  - Look for test files that import deleted components
- Fix or delete:
  - If the test tests a live component but is skipped: unskip and fix
  - If the test tests a removed component: delete the test file
  - If the test has zero assertions: either add assertions or delete

#### 6D: Fix Frontend Barrel

- Audit `components/index.ts` (or equivalent)
- Ensure all existing components are exported
- Ensure export names are consistent (all named exports, no default exports mixing)

### Acceptance Criteria

- [ ] 4 unused components removed (no imports found via grep)
- [ ] 6 previously untested components have test coverage (≥3 test cases each)
- [ ] Zombie test identified and either fixed (with real assertions) or removed
- [ ] Frontend barrel exports all remaining components consistently
- [ ] All existing frontend tests continue to pass (~204)
- [ ] `npm test` passes in `apps/frontend/`
- [ ] Frontend TypeScript passes: `tsc --noEmit`
- [ ] No regression in frontend bundle size (unused components removed)

---

## Item 7: CI Coverage for Frontend (🟡 Medium, 0.5d)

**Effort**: 0.5 day  
**Theme**: CI / Quality  
**Stream**: D  
**Dependencies**: Stream A (Items 1, 2, 4) — preferably merged first to ensure CI gates test corrected code  
**Findings**: F07

### Description

The CI pipeline currently enforces coverage thresholds for the backend but not for the frontend. This means:

- Frontend coverage can drop without CI failing
- The frontend quality gate is purely manual/review-based
- The investment in frontend tests (Item 6) needs CI enforcement to prevent future regression

**What exists:**
- Backend CI job runs `vitest --coverage` with a threshold (e.g., 80%)
- Frontend CI job runs `vitest` but without `--coverage` or any threshold enforcement
- Coverage configuration (`vitest.config.ts` in frontend) may or may not have `coverage.threshold` defined

**The fix:**

#### 7A: Add Coverage Threshold to Frontend Vitest Config

```typescript
// apps/frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // ... existing config
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/*.d.ts',
      ],
      thresholds: {
        statements: 70,   // or project's target
        branches: 60,
        functions: 65,
        lines: 70,
      },
    },
  },
});
```

**Threshold targets** (adjust to current coverage level + 5% buffer):

| Metric | Suggested Threshold | Rationale |
|--------|-------------------|-----------|
| Statements | 70% | After adding 6 component tests, frontend should be well-covered |
| Branches | 60% | Conditional rendering logic is common in components |
| Functions | 65% | Event handlers and callbacks should be tested |
| Lines | 70% | Aligns with statements threshold |

#### 7B: Update CI Pipeline

```yaml
# .github/workflows/ci.yml (or equivalent)
frontend-tests:
  runs-on: ubuntu-latest
  steps:
    # ... checkout, setup, install
    - name: Run tests with coverage
      run: npm run test -- --coverage  # or npm run test:coverage
      working-directory: apps/frontend
    - name: Upload coverage report
      uses: actions/upload-artifact@v4
      with:
        name: frontend-coverage
        path: apps/frontend/coverage/
```

- Ensure the CI command exits with non-zero when thresholds are not met
- Upload coverage artifact for PR review

#### 7C: Add Coverage Badge (Optional)

If the project uses coverage badges in the README, update to show frontend coverage alongside backend.

### Acceptance Criteria

- [ ] Frontend Vitest config has `coverage.thresholds` defined (statements, branches, functions, lines)
- [ ] CI pipeline runs `vitest --coverage` for frontend (not just `vitest`)
- [ ] CI fails when frontend coverage drops below thresholds
- [ ] Coverage artifacts uploaded to CI for PR review
- [ ] Backend coverage enforcement remains unchanged
- [ ] All frontend tests pass in CI with coverage enabled

---

## Item 8: Minor Config Fixes (🟢 Low, 0.5d)

**Effort**: 0.5 day  
**Theme**: Config / DevOps  
**Stream**: D  
**Dependencies**: Stream A (preferably merged first)  
**Findings**: F08

### Description

Three minor but impactful configuration issues:

1. **Docker image alignment**: The Docker image used in `docker-compose.yml` for the application or supporting services (PostgreSQL, Redis) does not match the image used in production/staging. This creates "works on my machine" gaps where the local Docker Compose environment diverges from production.

2. **E2E healthcheck hardening**: The E2E test suite's healthcheck (`GET /api/health`) is flaky — it sometimes passes before the backend is fully initialized, causing subsequent tests to fail sporadically. The healthcheck needs a polling + retry mechanism with a configurable timeout.

3. **CI error swallowing**: Some CI commands use patterns like `script: lint || true` or fail to check exit codes, meaning failures are silently swallowed and CI passes even when steps fail.

**The fix:**

#### 8A: Align Docker Images

- Compare `docker-compose.yml` (or `docker/docker-compose.e2e.yml`) image tags with production deployment config
- For each mismatch, update to match:
  - PostgreSQL: `postgres:16-alpine` (if prod uses 16)
  - Redis: `redis:7-alpine` (if prod uses 7)
- Add a comment documenting which production image each service corresponds to

#### 8B: Harden E2E Healthcheck

```typescript
// e2e/helpers/wait-for-backend.ts (or similar)
export async function waitForBackend(
  url: string = 'http://localhost:3333/api/health',
  timeoutMs: number = 30000,
  intervalMs: number = 1000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        // Health endpoint returned 200 — wait a bit more for full init
        await new Promise(r => setTimeout(r, 2000));
        return;
      }
    } catch {
      // Connection refused — backend not ready yet
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Backend healthcheck failed after ${timeoutMs}ms: ${url}`);
}
```

- Ensure the healthcheck waits for actual API availability (not just port open)
- Add a "stabilization" delay of 2 extra seconds after first successful healthcheck

#### 8C: Fix CI Error Swallowing

- Audit CI config for patterns that ignore errors:
  ```yaml
  # BAD — swallows errors
  - run: lint || true

  # GOOD — fails on error
  - run: lint
  ```
- Common patterns to fix:
  - `|| true` suffixes
  - Missing `set -e` in shell steps
  - Commands chained with `;` instead of `&&`
  - Incomplete `if` conditions that don't propagate exit codes

### Acceptance Criteria

- [ ] Docker images in `docker-compose.yml` match production image versions
- [ ] Each service in docker-compose has a comment documenting its production image counterpart
- [ ] E2E healthcheck has polling + retry with configurable timeout and stabilization delay
- [ ] E2E flakiness rate drops to <5% (was higher due to healthcheck race)
- [ ] CI config has zero `|| true` or error-swallowing patterns
- [ ] All CI steps propagate exit codes correctly
- [ ] CI fails when any step fails (no silenced failures)

---

## Parallel Work Streams

### Stream Diagram

```
Day 1 (1-day sprint):
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│  Stream A (Architecture):       Items 1, 2, 4 — 1.5d total (parallel)      │
│  ┌───────────────────────────────────────────────────────────────────┐       │
│  │ Item 1: Domain Dep Rule (0.5d) ————┐                              │       │
│  │ Item 2: UUID v7 Migration (0.5d) —─┤ (fully parallel)             │       │
│  │ Item 4: Barrel + Dead Code (0.5d) —┘                              │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                                                                               │
│  Stream B (Package):            Items 3, 5 — 1d total (parallel with A)     │
│  ┌───────────────────────────────────────────────────────────────────┐       │
│  │ Item 3: Shared Package (0.5d) ———┐                                │       │
│  │ Item 5: Config Gaps (0.5d) —─────┘ (parallel with A)             │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                                                                               │
│  Stream C (Frontend):           Item 6 — 1d (parallel with A+B)             │
│  ┌───────────────────────────────────────────────────────────────────┐       │
│  │ Item 6: Frontend Cleanup (1d) — 4 tasks, fully parallel with A+B │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                                                                               │
│  Stream D (CI):                 Items 7, 8 — 0.5d (after A)                 │
│  ┌───────────────────────────────────────────────────────────────────┐       │
│  │ Item 7: CI Coverage (0.5d) ———┐ (preferably after A merged)      │       │
│  │ Item 8: Minor Config (0.5d) —─┘                                   │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                                                                               │
│  Merge gate: Stream A must merge to main before Stream D finalizes            │
│  (CI should test the corrected architecture, not the broken one)              │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Parallelism Rationale

| Stream | Items | Total Effort | Dependency |
|--------|-------|-------------|------------|
| **Stream A (Architecture)** | #1, #2, #4 | 1.5 days | Fully parallel — each item touches different files (domain types, UUID utilities, barrels) |
| **Stream B (Package)** | #3, #5 | 1.0 day | Fully parallel with Stream A (shared package + config are independent of domain changes) |
| **Stream C (Frontend)** | #6 | 1.0 day | Fully parallel with A+B (separate app — no file overlap) |
| **Stream D (CI)** | #7, #8 | 0.5 day | Prefer Stream A merged first (CI should test fixed architecture) |

### Critical Path

**Stream A (1.5d)** runs in parallel with **Stream B (1d)** and **Stream C (1d)** → **max 1.5 calendar days**.

**Stream D (0.5d)** waits for Stream A to merge → total **~2 calendar days** realistically.

Since this is a **1-day sprint**, the execution strategy is:
1. **Morning (0-4h)**: Stream A + B + C start in parallel (Items 1-6)
2. **Noon (4-6h)**: Stream A merges → Stream D starts (Items 7-8)
3. **Afternoon (6-8h)**: Remaining items merge, final validation, release prep

This fits within a **1-day sprint** with 3 parallel streams and a sequential gate for CI changes.

---

## Effort Summary Table

| Item | Description | Days | Theme | Stream | Depends On | Blocks |
|------|-------------|------|-------|--------|------------|--------|
| 1 | **Fix Domain Entity Dependency Rule** | 0.5 | Architecture | A | — | — |
| 2 | **Complete UUID v7 Migration** | 0.5 | Architecture/Security | A | — | — |
| 3 | **Fix Shared Package** | 0.5 | Package/Deps | B | — | — |
| 4 | **Fix Barrel Exports + Dead Code** | 0.5 | Architecture | A | — | — |
| 5 | **Fix Config Gaps** | 0.5 | Config/DevXP | B | — | — |
| 6 | **Frontend Cleanup** | 1.0 | Frontend/Quality | C | — | — |
| 7 | **CI Coverage for Frontend** | 0.5 | CI/Quality | D | Stream A | — |
| 8 | **Minor Config Fixes** | 0.5 | Config/DevOps | D | Stream A | — |
| | **Total** | **4.5 days** | | | **(4 parallel streams)** | |

### Effort Distribution by Theme

| Theme | Items | Total Days |
|-------|-------|-----------|
| Architecture | 1, 2, 4 | 1.5 days |
| Package/Dependencies | 3 | 0.5 day |
| Config/DevOps | 5, 8 | 1.0 day |
| Frontend/Quality | 6 | 1.0 day |
| CI/Quality | 7 | 0.5 day |

### Sprint Capacity

- **Total effort**: 4.5 days
- **Sprint duration**: 1 day
- **Team size**: 4 parallel streams (Architecture, Package, Frontend, CI)
- **Calendar time with parallelism**: Stream A (1.5d) | Stream B (0.5d) | Stream C (1d) | Stream D (0.5d after A) → **~1-2 calendar days max**
- **Feasibility**: ✅ Fits within 1-day sprint with all streams parallel. The only sequential dependency (Stream D after Stream A) can be managed through early merge of Stream A.

### Trade-offs

| If | Then |
|----|------|
| Stream A items take longer than expected | Cut Item 4 (Barrel) to Item 2 priority — Dependency Rule + UUID are higher impact than barrel cleanliness |
| Stream C (Frontend) runs out of time | Cut low-priority untested components; deliver bare minimum of fixing unused components + zombie test |
| Merge conflicts between Stream A branches | Resolve conflicts immediately — Architecture fixes touch shared files (import paths, barrel files) and will conflict if not coordinated |
| CI changes break the pipeline | Cut Item 8 (Minor Config) to free time for CI debugging. Item 7 (Coverage) is the higher priority |

---

## Risk Register

### 🔴 Critical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Moving `Either` from `@/application/` to `@/domain/` (Item 1) may break imports across 30+ files that reference `@/application/types/either` | High | High | Keep backward-compatible re-export in `@/application/types/either.ts`. Use a codemod or script to update imports. Run full test suite after change. |
| `generateUUID()` may not exist yet — creating it mid-sprint adds scope | Medium | High | Check on sprint start. If missing, create using `uuidv7` package (npm install + ~10 LOC). This is part of the 0.5d estimate. |
| Deleting dead `entity.ts` (Item 4) may break imports if it IS referenced | Low | Critical | Verify zero imports before deletion using `grep -r 'from.*entity'`. Safe delete pattern: rename first, run tests, then delete. |

### 🟡 Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Frontend unused components (Item 6) may turn out to be used by dynamic imports or barrel re-exports | Medium | Medium | Use `ts-prune` or `unimported` for reliable dead-code detection, not just simple grep. Verify each candidate by checking reverse imports. |
| `@vitest/coverage-v8` version mismatch (Item 5) may require updating other Vitest-related packages | Medium | Medium | Run `npm install` locally and verify no peer dependency warnings. If mismatch is transitive, update all related packages together. |
| Frontend coverage thresholds (Item 7) may be too aggressive and block CI if current coverage is lower than estimated | Medium | High | Measure current coverage FIRST, then set thresholds at current - 2% as floor. Document thresholds explicitly. Adjust if needed. |
| E2E healthcheck fix (Item 8) may not fully resolve flakiness if the root cause is elsewhere | Medium | Medium | Monitor flakiness rate after fix. If still >5%, escalate to Sprint 7 with more investigation. |

### 🟢 Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| REDIS_PASSWORD config (Item 5) may require changes to Redis/BullMQ connection code if not already supported | Low | Medium | Verify existing Redis connection accepts `password` option. Add if missing — standard BullMQ/Redis config. |
| Docker image alignment (Item 8) may require pulling new images and updating lockfiles | Low | Low | `docker compose pull` after updating tags. No application code changes — just versions. |
| CI error swallowing audit (Item 8) may reveal no issues (clean config) | Low | Low | Document that CI config was audited and is clean. Close the finding. |

---

## Definition of Done (Sprint Level)

### Items Delivered

- [ ] **Item 1**: `Either` moved to `@/domain/types/either`. All 5 domain entities updated. Backward-compat shim in `@/application/types/either`. Zero domain → application imports.
- [ ] **Item 2**: Zero `crypto.randomUUID()` in production backend code. All IDs use `generateUUID()` (UUID v7).
- [ ] **Item 3**: `@agiliza/shared` `PaymentEvent` type matches canonical domain definition. Frontend depends on shared package.
- [ ] **Item 4**: All use cases exported from barrel. `registerEventHandlers` in factory barrel. Dead `entity.ts` removed or consolidated.
- [ ] **Item 5**: `REDIS_PASSWORD` in `.env.example`. `@vitest/coverage-v8` version fixed. Build/lint scripts separated.
- [ ] **Item 6**: 4 unused components removed. 6 untested components have tests. Zombie test fixed/removed. Barrel consistent.
- [ ] **Item 7**: Frontend coverage thresholds enforced in CI. CI fails below thresholds.
- [ ] **Item 8**: Docker images aligned. E2E healthcheck hardened. CI error swallowing eliminated.

### Quality Gates

- [ ] Zero Dependency Rule violations (automated check)
- [ ] `tsc --noEmit` passes on all workspaces (backend + frontend + shared)
- [ ] All ~750 backend tests still pass
- [ ] All ~204 frontend tests still pass
- [ ] All new tests (Items 1-8) pass
- [ ] No `console.log` or debugging artifacts
- [ ] No hardcoded secrets, URLs, or environment-specific values
- [ ] Coverage for frontend meets configured thresholds

### Architecture Checks

- [ ] `@/domain/types/either.ts` is the single source of truth for `Either`
- [ ] Zero domain files import from `@/application/` (grepped and confirmed)
- [ ] Zero `crypto.randomUUID()` calls in backend production code (grepped and confirmed)
- [ ] All use cases discoverable via barrel exports
- [ ] All factory entry points discoverable via factory barrel
- [ ] No dead files in domain, application, or presentation layers
- [ ] `REDIS_PASSWORD` config wired into Redis/BullMQ connection
- [ ] Build and lint concerns are separated in all `package.json` files
- [ ] Frontend coverage thresholds are documented and enforced

### Release

- [ ] Tag `v0.6.1` created
- [ ] Release notes written (Sprint 6.1 hotfix summary — all 8 items)
- [ ] `.env.example` updated with `REDIS_PASSWORD`
- [ ] GitHub release with changelog referencing all 15 findings closed

---

## Artifact Checklist

| Item | Artifacts |
|------|-----------|
| **1** | `domain/types/either.ts` (new), updated `application/types/either.ts` (backward-compat re-export), updated 5 domain entity files, updated all re-export references |
| **2** | Updated 5 production files (replace `crypto.randomUUID()` with `generateUUID()`), ensure `generateUUID()` exists at standard location, remove unused `crypto` imports |
| **3** | Updated `@agiliza/shared` `PaymentEvent` type, updated `apps/frontend/package.json` with shared dependency, barrel export test |
| **4** | Updated `application/usecases/index.ts` (add missing exports), updated `presentation/factories/index.ts` (add `registerEventHandlers`), deleted or consolidated `domain/entities/entity.ts` |
| **5** | Updated `.env.example` (add `REDIS_PASSWORD`), updated `package.json`/lockfile for `@vitest/coverage-v8`, separated `build`/`lint` scripts in all `package.json` files |
| **6** | Removed 4 unused components + their test files, added tests for 6 untested components, fixed/removed zombie test, updated frontend barrel |
| **7** | Updated `apps/frontend/vitest.config.ts` with coverage thresholds, updated CI workflow file (frontend coverage + artifact upload) |
| **8** | Updated `docker-compose.yml` image versions, updated `e2e/helpers/wait-for-backend.ts` (or equivalent), updated CI workflow (fix error swallowing) |

---

## Release v0.6.1 Checklist

### Pre-Release

- [ ] All 8 items merged to `main`
- [ ] Full test suite passes: `npm test` (backend + frontend)
- [ ] `npm run build` succeeds on all workspaces (backend + frontend + shared)
- [ ] `tsc --noEmit` passes on all workspaces
- [ ] Zero Dependency Rule violations confirmed (automated grep)
- [ ] Zero `crypto.randomUUID()` calls in production code confirmed
- [ ] Coverage report generated for frontend (meets thresholds)
- [ ] `.env.example` committed with `REDIS_PASSWORD`
- [ ] E2E tests pass locally (or known-failure documented for items beyond scope)

### Release

- [ ] Tag `v0.6.1` created
- [ ] Release notes written (hotfix summary — all 15 findings → 8 items)
- [ ] Notify team that Sprint 7 starts from a clean, consistent baseline

---

## Audit Finding Closure Map

| Finding ID | Description | Item | Status |
|-----------|-------------|------|--------|
| F01 | Domain entities import `Either` from `@/application/` | Item 1 | 🔴 Open |
| F02 | `crypto.randomUUID()` in 5 production files | Item 2 | 🔴 Open |
| F03 | `@agiliza/shared` unused; `PaymentEvent` wrong type; frontend missing dep | Item 3 | 🔴 Open |
| F04 | Use cases not in barrel; factory barrel missing; dead `entity.ts` | Item 4 | 🔴 Open |
| F05 | `REDIS_PASSWORD` missing; coverage version mismatch; build=lint | Item 5 | 🔴 Open |
| F06 | 4 unused components; 6 untested; 1 zombie test; barrel inconsistent | Item 6 | 🟡 Open |
| F07 | Frontend coverage not enforced in CI | Item 7 | 🟡 Open |
| F08 | Docker images misaligned; E2E healthcheck flaky; CI error swallowing | Item 8 | 🟢 Open |

**Target**: All 8 items closed → all 15 findings resolved → `v0.6.1` released.

---

## Handoff to Sprint 7

After Sprint 6.1, the codebase will have:

- ✅ **Consistent architecture**: `Either` in domain, no Dependency Rule violations
- ✅ **UUID v7 everywhere**: Sortable IDs, consistent generation
- ✅ **Clean packages**: Shared package typed correctly, frontend wired
- ✅ **Complete barrels**: All use cases and factories discoverable
- ✅ **Proper config**: Redis password documented, versions aligned, concerns separated
- ✅ **Healthy frontend**: Dead code removed, untested components covered, zombie tests fixed
- ✅ **CI gates for frontend**: Coverage enforced, no error swallowing
- ✅ **Stable E2E**: Healthcheck hardened, Docker images aligned

Sprint 7 can start from a clean, consistent baseline — no accumulated technical debt.

---

*Plan prepared by: Architect Agent*  
*Date: 2026-07-30*  
*Related documents: `docs/sprint-6-plan.md`, `docs/review-cto.md`, `docs/review-compliance.md`, `docs/review-creative-nucleus.md`, `docs/review-tech-nucleus.md`*
