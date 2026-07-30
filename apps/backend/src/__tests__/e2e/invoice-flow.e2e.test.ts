import { describe, it, expect } from 'vitest';

const API = 'http://localhost:3333';
const AUTH = { headers: { Authorization: 'ApiKey dev-key' } };

describe('Invoice Flow E2E', () => {
  let clientId: string;
  let invoiceId: string;

  it('should create a client first', async () => {
    const res = await fetch(`${API}/api/clients`, {
      method: 'POST',
      ...AUTH,
      headers: { ...AUTH.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Invoice E2E', phone: '5511999990001' }),
    });
    const body = (await res.json()) as { data: { id: string } };
    clientId = body.data.id;
    expect(clientId).toBeTruthy();
  });

  it('should create an invoice', async () => {
    const res = await fetch(`${API}/api/invoices`, {
      method: 'POST',
      ...AUTH,
      headers: { ...AUTH.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        amount: 150.00,
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; amount: number } };
    expect(body.data.amount).toBe(150);
    invoiceId = body.data.id;
  });

  it('should list invoices', async () => {
    const res = await fetch(`${API}/api/invoices`, AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });
});
