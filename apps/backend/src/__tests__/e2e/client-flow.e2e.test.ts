import { describe, it, expect } from 'vitest';

const API = 'http://localhost:3333';
const AUTH = { headers: { Authorization: 'ApiKey dev-key' } };

describe('Client Flow E2E', () => {
  let clientId: string;

  it('should create a client', async () => {
    const res = await fetch(`${API}/api/clients`, {
      method: 'POST',
      ...AUTH,
      headers: { ...AUTH.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Test Client', phone: '5511999990000' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; name: string } };
    expect(body.data.name).toBe('E2E Test Client');
    clientId = body.data.id;
  });

  it('should list clients', async () => {
    const res = await fetch(`${API}/api/clients`, AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should get client by ID', async () => {
    const res = await fetch(`${API}/api/clients/${clientId}`, AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(clientId);
  });
});
