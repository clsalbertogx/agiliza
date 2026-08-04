import { expect, test } from '@playwright/test';

/**
 * Dashboard Navigation E2E Tests (browser-level)
 *
 * These tests require a live frontend server and are gated behind the
 * E2E_FRONTEND_URL environment variable (e.g. http://localhost:3000).
 *
 * CI's e2e job starts ONLY the backend, so E2E_FRONTEND_URL is unset there and
 * every test in this file is skipped with an explicit reason — never a false
 * failure. To run them locally, start the frontend and export E2E_FRONTEND_URL:
 *
 *   cd apps/frontend && npm run dev &
 *   export E2E_FRONTEND_URL=http://localhost:3000
 *   npx playwright test --config=e2e/playwright.config.ts e2e/tests/dashboard-navigation.spec.ts
 *
 * Assertions target page elements that render in every state (loading, error,
 * empty, data), so no flaky `networkidle` waits are required.
 */

const FRONTEND_URL = process.env.E2E_FRONTEND_URL;

const skipReason = 'E2E_FRONTEND_URL not set — frontend not running, skipping browser slice';

test.describe('Dashboard Navigation (browser)', () => {
  test('should load the dashboard page', async ({ page }) => {
    test.skip(!FRONTEND_URL, skipReason);

    // '/' redirects to '/dashboard'; the "Dashboard" heading is rendered in
    // every page state, making this a deterministic load check.
    await page.goto(FRONTEND_URL as string);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should navigate via sidebar to reports', async ({ page }) => {
    test.skip(!FRONTEND_URL, skipReason);

    await page.goto(`${FRONTEND_URL as string}/dashboard`);
    await page.getByRole('link', { name: 'Relatórios' }).click();

    await expect(page).toHaveURL(/\/dashboard\/reports/);
    await expect(page.getByRole('heading', { name: 'Previsão de Fluxo de Caixa' })).toBeVisible();
  });
});
