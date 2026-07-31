import { test, expect } from '@playwright/test';

/**
 * Dashboard Navigation E2E Tests
 *
 * These tests require a running frontend server at BASE_URL (default: http://localhost:3000).
 * In CI, the frontend is not started in the E2E job — these tests are skipped
 * when FRONTEND_BASE_URL is not set or matches the API URL.
 *
 * See ci.yml e2e job: the job tests the backend API only; frontend navigation
 * tests run separately when the frontend is deployed.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3333';
const IS_BACKEND_ONLY = BASE_URL === API_URL || BASE_URL.startsWith(API_URL);

test.describe('Dashboard Navigation', () => {
  test('should load the dashboard page', async ({ page }) => {
    test.skip(IS_BACKEND_ONLY, 'Frontend not running in this CI job');
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Agiliza/);
  });

  test('should navigate to client list', async ({ page }) => {
    test.skip(IS_BACKEND_ONLY, 'Frontend not running in this CI job');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    // Just verify the page loads without crashing
    await expect(page.locator('body')).toBeVisible();
  });
});