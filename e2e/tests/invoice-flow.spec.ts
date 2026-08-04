import { expect, test } from '@playwright/test';

/**
 * Invoice Flow E2E Tests
 *
 * NOTE: These tests require a running backend server at API_URL.
 * Default: http://localhost:3333.
 * The auth pattern matches the existing backend e2e tests (ApiKey header).
 */

const API_URL = process.env.API_URL || 'http://localhost:3333';
const AUTH_HEADERS = { Authorization: 'ApiKey agiliza-dev-api-key-change-in-production' };

test.describe('Invoice Flow E2E', () => {
  test('create invoice and verify in billing', async ({ request }) => {
    const clientResponse = await request.post(`${API_URL}/api/clients`, {
      headers: AUTH_HEADERS,
      data: {
        tenantId: '00000000-0000-0000-0000-000000000000',
        name: 'E2E Invoice Client',
        phone: '5585988888888',
      },
    });
    expect(clientResponse.status()).toBe(201);
    const client = await clientResponse.json();

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const invoiceResponse = await request.post(`${API_URL}/api/invoices`, {
      headers: AUTH_HEADERS,
      data: {
        tenantId: '00000000-0000-0000-0000-000000000000',
        clientId: client.data.id,
        amount: 150.0,
        dueDate: dueDate.toISOString(),
        description: 'E2E Test Invoice',
      },
    });
    expect(invoiceResponse.status()).toBe(201);
    const invoice = await invoiceResponse.json();
    expect(invoice.data?.amount).toBe(150.0);
    expect(invoice.data?.status).toBe('PENDING');

    const listResponse = await request.get(`${API_URL}/api/invoices`, {
      headers: AUTH_HEADERS,
    });
    expect(listResponse.status()).toBe(200);
    const invoices = await listResponse.json();
    const found = invoices.data?.find((i: any) => i.id === invoice.data?.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('PENDING');
  });
});
