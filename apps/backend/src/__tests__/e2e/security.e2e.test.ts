import { describe, it, expect } from 'vitest';

const API = 'http://localhost:3333';

describe('Security E2E', () => {
  it('should reject unauthenticated requests with 401', async () => {
    const res = await fetch(`${API}/api/clients`);
    expect(res.status).toBe(401);
  });

  it('should reject invalid tokens with 401', async () => {
    const res = await fetch(`${API}/api/clients`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(res.status).toBe(401);
  });

  it('should allow health check without auth', async () => {
    const res = await fetch(`${API}/api/health`);
    expect(res.status).toBe(200);
  });

  it('should have security headers', async () => {
    const res = await fetch(`${API}/api/health`);
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
  });
});
