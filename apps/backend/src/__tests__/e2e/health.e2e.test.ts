import { describe, it, expect } from 'vitest';

describe('Health Check E2E', () => {
  it('should return 200 with status ok', async () => {
    const res = await fetch('http://localhost:3333/api/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
