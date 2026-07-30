import { test, expect } from '@playwright/test';

test.describe('Client Flow E2E', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3333';

  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('create client and verify it appears', async ({ request }) => {
    const createResponse = await request.post(`${API_URL}/api/clients`, {
      data: {
        name: 'E2E Test Client',
        phone: '5585999999999',
        channel: 'whatsapp',
      },
    });
    expect(createResponse.status()).toBe(201);
    const createdClient = await createResponse.json();
    expect(createdClient.id).toBeDefined();
    expect(createdClient.name).toBe('E2E Test Client');

    const listResponse = await request.get(`${API_URL}/api/clients`);
    expect(listResponse.status()).toBe(200);
    const clients = await listResponse.json();
    const found = clients.data?.find((c: any) => c.id === createdClient.id);
    expect(found).toBeDefined();
  });
});
