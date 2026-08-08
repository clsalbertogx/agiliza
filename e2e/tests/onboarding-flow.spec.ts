import { expect, test } from '@playwright/test';

/**
 * Onboarding Flow E2E Tests
 *
 * NOTE: These tests require a running backend server at API_URL.
 * Default: http://localhost:3333.
 * Creates a client via API to simulate the onboarding wizard flow.
 */

const API_URL = process.env.API_URL || 'http://localhost:3333';
// The running backend must be configured with the same MASTER_API_KEY.
const MASTER_API_KEY = process.env.MASTER_API_KEY || 'agiliza-dev-api-key-change-in-production';
const AUTH_HEADERS = { Authorization: `ApiKey ${MASTER_API_KEY}` };

test.describe('Onboarding Flow', () => {
  test('should return onboarding wizard for new client', async ({ request }) => {
    const createResponse = await request.post(`${API_URL}/api/clients`, {
      headers: AUTH_HEADERS,
      data: {
        tenantId: '00000000-0000-0000-0000-000000000000',
        name: 'Onboarding Test Client',
        phone: '5585977777777',
      },
    });

    expect(createResponse.status()).toBe(201);
    const client = await createResponse.json();
    expect(client.data?.id).toBeDefined();
  });
});
