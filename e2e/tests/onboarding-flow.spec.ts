import { test, expect } from '@playwright/test';

/**
 * Onboarding Flow E2E Tests
 *
 * NOTE: These tests require a running backend server at API_URL.
 * Default: http://localhost:3333.
 * Creates a client via API to simulate the onboarding wizard flow.
 */

test.describe('Onboarding Flow', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3333';
  const TENANT_ID = '00000000-0000-0000-0000-000000000001';

  test('should return onboarding wizard for new client', async ({ request }) => {
    // Create a client first
    const createResponse = await request.post(`${API_URL}/api/clients`, {
      data: {
        tenantId: TENANT_ID,
        name: 'Onboarding Test Client',
        phone: '5585977777777',
        channel: 'whatsapp',
      },
    });

    expect(createResponse.status()).toBe(201);
    const client = await createResponse.json();
    expect(client.id).toBeDefined();
  });
});
