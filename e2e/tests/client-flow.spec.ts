import { test, expect } from '@playwright/test';

/**
 * Client Flow E2E Tests
 *
 * These tests exercise the backend API directly via Playwright's request fixture.
 * They require a running backend with a migrated schema at API_URL.
 */

const API_URL = process.env.API_URL || 'http://localhost:3333';
const AUTH_HEADERS = { Authorization: 'ApiKey agiliza-dev-api-key-change-in-production' };

test.describe('Client Flow E2E', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('create client and verify it appears', async ({ request }) => {
    const createResponse = await request.post(`${API_URL}/api/clients`, {
      headers: AUTH_HEADERS,
      data: {
        tenantId: '00000000-0000-0000-0000-000000000000',
        name: 'E2E Test Client',
        phone: '5585999999999',
      },
    });
    expect(createResponse.status()).toBe(201);
    const createdClient = await createResponse.json();
    expect(createdClient.data?.id).toBeDefined();
    expect(createdClient.data?.name).toBe('E2E Test Client');

    const listResponse = await request.get(`${API_URL}/api/clients`, {
      headers: AUTH_HEADERS,
    });
    expect(listResponse.status()).toBe(200);
    const clients = await listResponse.json();
    const found = clients.data?.find((c: any) => c.id === createdClient.data.id);
    expect(found).toBeDefined();
  });
});