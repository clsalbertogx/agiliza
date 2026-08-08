import { expect, test } from '@playwright/test';

/**
 * Error States E2E Tests
 *
 * NOTE: These tests require a running backend server at API_URL.
 * Default: http://localhost:3333.
 * They test API error responses (404, 401/403, 400) without needing special auth.
 */

const API_URL = process.env.API_URL || 'http://localhost:3333';
// The running backend must be configured with the same MASTER_API_KEY.
const MASTER_API_KEY = process.env.MASTER_API_KEY || 'agiliza-dev-api-key-change-in-production';
const AUTH_HEADERS = { Authorization: `ApiKey ${MASTER_API_KEY}` };

test.describe('Error States', () => {
  test('should return 404 for non-existent client', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/clients/non-existent-id`, {
      headers: AUTH_HEADERS,
    });
    expect(response.status()).toBe(404);
  });

  test('should return 401 for missing auth header', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/clients`, {
      headers: {},
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should return 400 for invalid client data', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/clients`, {
      headers: AUTH_HEADERS,
      data: { name: '' },
    });
    expect(response.status()).toBe(400);
  });
});
