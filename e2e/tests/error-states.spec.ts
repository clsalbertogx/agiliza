import { test, expect } from '@playwright/test';

/**
 * Error States E2E Tests
 *
 * NOTE: These tests require a running backend server at API_URL.
 * Default: http://localhost:3333.
 * They test API error responses (404, 401/403, 400) without needing auth.
 */

test.describe('Error States', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3333';

  test('should return 404 for non-existent client', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/clients/non-existent-id`);
    expect(response.status()).toBe(404);
  });

  test('should return 401 for missing auth header', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/clients`, {
      headers: {} as any,
    });
    expect([401, 403]).toContain(response.status());
  });

  test('should return 400 for invalid client data', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/clients`, {
      data: { name: '' },
    });
    expect(response.status()).toBe(400);
  });
});
