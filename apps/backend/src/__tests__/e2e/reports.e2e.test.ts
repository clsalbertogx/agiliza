import { describe, it, expect } from 'vitest';

const API = 'http://localhost:3333';
const AUTH = { headers: { Authorization: 'ApiKey dev-key' } };

describe('Reports E2E', () => {
  it('should return cash flow forecast', async () => {
    const res = await fetch(`${API}/api/reports/cash-flow?tenantId=demo&months=3`, AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { forecast: unknown; summary: unknown } };
    expect(body.data.forecast).toBeDefined();
    expect(body.data.summary).toBeDefined();
  });

  it('should return collection efficiency', async () => {
    const res = await fetch(`${API}/api/reports/collection-efficiency?tenantId=demo`, AUTH);
    expect(res.status).toBe(200);
  });

  it('should return risk distribution', async () => {
    const res = await fetch(`${API}/api/reports/risk-distribution?tenantId=demo`, AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { green: unknown; yellow: unknown; red: unknown } };
    expect(body.data.green).toBeDefined();
    expect(body.data.yellow).toBeDefined();
    expect(body.data.red).toBeDefined();
  });
});
