import { expect, test } from '@playwright/test';

/**
 * Backend Health Smoke Test
 *
 * Uses Playwright's `request` fixture (no browser is launched), so it works in
 * CI, which starts only the backend. Verifies the API is up and reporting
 * healthy. This is the minimal contract every environment must satisfy and is
 * the first thing to fail when the backend misbehaves.
 */

const API_URL = process.env.API_URL || 'http://localhost:3333';

test.describe('Backend Health', () => {
  test('GET /api/health returns 200 with status ok', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
