import Fastify from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  clientFindFirst: vi.fn(),
  invoiceFindFirst: vi.fn(),
  paymentFindFirst: vi.fn(),
  eventFindFirst: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    client: { findFirst: mockState.clientFindFirst },
    invoice: { findFirst: mockState.invoiceFindFirst },
    payment: { findFirst: mockState.paymentFindFirst },
    event: { findFirst: mockState.eventFindFirst },
  })),
}));

// EVOLUTION_ALLOWED_IPS is validated by the env zod schema and snapshotted at
// module load. The webhook route now reads `env.EVOLUTION_ALLOWED_IPS`, so the
// tests control it through a proxy instead of mutating process.env.
const envState = vi.hoisted(() => ({ EVOLUTION_ALLOWED_IPS: '' as string }));

vi.mock('@/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/env')>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get(target, prop, receiver) {
        if (prop === 'EVOLUTION_ALLOWED_IPS') return envState.EVOLUTION_ALLOWED_IPS;
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
});

import { webhookRoutes } from '@/routes/webhook.routes';

const EVOLUTION_KEY = 'evolution-test-key';
const ALLOWED_IP = '192.168.1.10';
const FOREIGN_IP = '203.0.113.77';

describe('Evolution webhook security (S4)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    process.env.EVOLUTION_API_KEY = EVOLUTION_KEY;
    app = Fastify({ logger: false });
    await app.register(webhookRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    // Restore env state so tests are order-independent.
    process.env.EVOLUTION_API_KEY = EVOLUTION_KEY;
    envState.EVOLUTION_ALLOWED_IPS = '';
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API key verification — fail-closed', () => {
    it('returns 401 when the X-API-Key header is missing', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/webhooks/evolution', payload: {} });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid API key');
    });

    it('returns 401 when the X-API-Key header does not match EVOLUTION_API_KEY', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/evolution',
        headers: { 'x-api-key': 'wrong-api-key' },
        payload: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 when the X-API-Key header matches EVOLUTION_API_KEY', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/evolution',
        headers: { 'x-api-key': EVOLUTION_KEY },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().received).toBe(true);
    });

    it('returns 401 when EVOLUTION_API_KEY is not configured (fail-closed, no open webhook)', async () => {
      delete process.env.EVOLUTION_API_KEY;
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/evolution',
        headers: { 'x-api-key': EVOLUTION_KEY },
        payload: {},
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('IP allowlist (EVOLUTION_ALLOWED_IPS)', () => {
    it('rejects requests from non-whitelisted IPs when an allowlist is configured', async () => {
      envState.EVOLUTION_ALLOWED_IPS = `${ALLOWED_IP},10.0.0.1`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/evolution',
        headers: { 'x-api-key': EVOLUTION_KEY },
        remoteAddress: FOREIGN_IP,
        payload: {},
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('IP not allowed');
    });

    it('accepts requests from whitelisted IPs', async () => {
      envState.EVOLUTION_ALLOWED_IPS = `${ALLOWED_IP},10.0.0.1`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/evolution',
        headers: { 'x-api-key': EVOLUTION_KEY },
        remoteAddress: ALLOWED_IP,
        payload: {},
      });
      expect(res.statusCode).toBe(200);
    });

    it('accepts any IP when no allowlist is configured', async () => {
      envState.EVOLUTION_ALLOWED_IPS = '';
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/evolution',
        headers: { 'x-api-key': EVOLUTION_KEY },
        remoteAddress: FOREIGN_IP,
        payload: {},
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
