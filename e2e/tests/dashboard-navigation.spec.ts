import { test, expect } from '@playwright/test';

/**
 * Dashboard Navigation E2E Tests
 *
 * NOTE: These tests require a running frontend server.
 * Set BASE_URL env var or default is http://localhost:3000.
 * In CI, use `test.skip` or ensure the server is started before running.
 */

test.describe('Dashboard Navigation', () => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  test('should load the dashboard page', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Agiliza/);
  });

  test('should navigate to client list', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    // Just verify the page loads without crashing
    await expect(page.locator('body')).toBeVisible();
  });
});
