import { test, expect } from '@playwright/test';

test.describe('Invoice Flow E2E', () => {
  const API_URL = process.env.API_URL || 'http://localhost:3333';

  test('create invoice and verify in billing', async ({ request }) => {
    const clientResponse = await request.post(`${API_URL}/api/clients`, {
      data: {
        name: 'E2E Invoice Client',
        phone: '5585988888888',
        channel: 'whatsapp',
      },
    });
    expect(clientResponse.status()).toBe(201);
    const client = await clientResponse.json();

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const invoiceResponse = await request.post(`${API_URL}/api/invoices`, {
      data: {
        clientId: client.id,
        amount: 150.00,
        dueDate: dueDate.toISOString().split('T')[0],
        paymentMethod: 'pix',
        description: 'E2E Test Invoice',
      },
    });
    expect(invoiceResponse.status()).toBe(201);
    const invoice = await invoiceResponse.json();
    expect(invoice.amount).toBe(150.00);
    expect(invoice.status).toBe('pending');

    const listResponse = await request.get(`${API_URL}/api/invoices`);
    expect(listResponse.status()).toBe(200);
    const invoices = await listResponse.json();
    const found = invoices.data?.find((i: any) => i.id === invoice.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('pending');
  });
});
