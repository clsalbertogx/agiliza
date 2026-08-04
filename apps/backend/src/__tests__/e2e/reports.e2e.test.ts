import { describe, it, expect } from 'vitest';

const API = 'http://localhost:3333';
const AUTH = { headers: { Authorization: 'ApiKey dev-key' } };
// The reports querystring schema requires tenantId as a valid UUID (format: uuid).
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

describe('Reports E2E', () => {
  // These tests exercise the cash-flow service which reads from the live database,
  // so they require a running server. They are expected to fail with fetch errors
  // (ECONNREFUSED) when no server is up.
  it('should return cash flow forecast', async () => {
    const res = await fetch(`${API}/api/reports/cash-flow?tenantId=${TENANT_ID}&months=3`, AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { forecast: unknown; summary: unknown } };
    expect(body.data.forecast).toBeDefined();
    expect(body.data.summary).toBeDefined();
  });

  it('should return collection efficiency', async () => {
    const res = await fetch(`${API}/api/reports/collection-efficiency?tenantId=${TENANT_ID}`, AUTH);
    expect(res.status).toBe(200);
  });

  it('should return risk distribution', async () => {
    const res = await fetch(`${API}/api/reports/risk-distribution?tenantId=${TENANT_ID}`, AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { green: unknown; yellow: unknown; red: unknown } };
    expect(body.data.green).toBeDefined();
    expect(body.data.yellow).toBeDefined();
    expect(body.data.red).toBeDefined();
  });
});
