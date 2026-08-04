import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Rate Limiting — SEC-03
 *
 * Integration tests using fastify.inject() with the actual @fastify/rate-limit
 * plugin (in-memory store). These replace the earlier simulation-only tests.
 *
 * Tiers verified:
 *   - Global:  100 req/min per tenant (default)
 *   - Health:  1000 req/min  (effectively unlimited — monitoring must always reach it)
 *   - Auth:     20 req/min per IP
 *   - Webhook:  10 req/s  per provider IP
 */
describe('Rate Limiting — SEC-03', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();

    // Register rate-limit plugin with same config as index.ts (but without Redis)
    await app.register(rateLimit, {
      global: true,
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (request: FastifyRequest) => {
        return (request as any).tenantId || request.ip;
      },
    });

    // ── Health endpoint (high limit) ──
    app.get(
      '/health',
      {
        config: {
          rateLimit: { max: 1000, timeWindow: '1 minute' },
        },
      },
      async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.status(200).send({ status: 'ok' });
      },
    );

    // ── Auth endpoint (20 req/min per IP) ──
    app.post(
      '/api/auth/login',
      {
        config: {
          rateLimit: {
            max: 20,
            timeWindow: '1 minute',
            keyGenerator: (req: FastifyRequest) => req.ip,
          },
        },
      },
      async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.status(200).send({ token: 'test-token' });
      },
    );

    // ── Webhook endpoint (10 req/s per provider IP) ──
    app.post(
      '/api/webhooks/payment/asaas',
      {
        config: {
          rateLimit: {
            max: 10,
            timeWindow: '1 second',
            keyGenerator: (req: FastifyRequest) => req.ip,
          },
        },
      },
      async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.status(200).send({ received: true });
      },
    );

    // ── General API endpoint (global rate limit applies) ──
    app.get('/api/clients', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({ clients: [] });
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────
  // Global rate limit — 100 req/min per tenant
  // ──────────────────────────────────────────────

  it('should return 429 after exceeding 100 requests per minute on API endpoints (SEC-03-A)', async () => {
    // When sending 101 requests rapidly (all within the same 1-minute window)
    const statusCodes: number[] = [];

    for (let i = 0; i < 101; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/clients',
      });
      statusCodes.push(res.statusCode);
    }

    // Then the 101st request (or close to it) should be rate limited
    const rateLimited = statusCodes.filter((code) => code === 429);
    expect(rateLimited.length).toBeGreaterThan(0);

    // And the 429 response includes a retry-after header
    const limitedResponse = await app.inject({
      method: 'GET',
      url: '/api/clients',
    });
    if (limitedResponse.statusCode === 429) {
      expect(limitedResponse.headers['retry-after']).toBeDefined();
    }
  });

  it('should return rate-limit headers on successful requests', async () => {
    // Use a fresh IP so the global 100/min limit from the previous test
    // does not affect this one (tests share the same Fastify instance).
    const res = await app.inject({
      method: 'GET',
      url: '/api/clients',
      remoteAddress: '10.0.10.1',
    });

    // Rate limit headers should be present
    expect(res.statusCode).toBe(200);
    expect(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining'] || res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // Health endpoint — NOT rate-limited under normal usage
  // ──────────────────────────────────────────────

  it('should not rate limit health endpoint (has 1000/min limit, SEC-03-B)', async () => {
    // Send 101 requests to health — this would exhaust the global 100/min limit
    // but health has its own 1000/min limit, so all should pass
    for (let i = 0; i < 101; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    }
  });

  // ──────────────────────────────────────────────
  // Auth endpoint — 20 req/min per IP
  // ──────────────────────────────────────────────

  it('should have stricter rate limit for auth endpoints (20 req/min per IP, SEC-03-C)', async () => {
    // When sending 21 login attempts from the same IP
    const statusCodes: number[] = [];

    for (let i = 0; i < 21; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: '10.0.0.100',
      });
      statusCodes.push(res.statusCode);
    }

    // Then the 21st attempt should be rate limited
    const rateLimited = statusCodes.filter((code) => code === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should allow requests from different IPs on auth endpoint', async () => {
    // Use distinct IPs (not 10.0.0.100 which was exhausted by the previous test)
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        remoteAddress: `10.0.50.${i + 1}`,
      });
      expect(res.statusCode).toBe(200);
    }
  });

  // ──────────────────────────────────────────────
  // Webhook endpoint — 10 req/s per provider IP
  // ──────────────────────────────────────────────

  it('should have rate limit for webhook endpoints (10 req/s per IP, SEC-03-D)', async () => {
    // When sending 11 requests in 1 second from the same provider IP
    const statusCodes: number[] = [];

    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/asaas',
        remoteAddress: '10.0.0.200',
      });
      statusCodes.push(res.statusCode);
    }

    // Then at least one request should be rate limited
    const rateLimited = statusCodes.filter((code) => code === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should allow webhook requests from different provider IPs', async () => {
    // Use distinct IPs (not 10.0.0.200 which was exhausted by the previous test)
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/payment/asaas',
        remoteAddress: `10.0.60.${i + 1}`,
      });
      expect(res.statusCode).toBe(200);
    }
  });

  // ──────────────────────────────────────────────
  // Independent rate limits per tenant
  // ──────────────────────────────────────────────

  it('should have independent rate limits per tenant (SEC-03-E)', async () => {
    // Simulate tenant A — send 101 requests from its IP
    for (let i = 0; i < 101; i++) {
      await app.inject({
        method: 'GET',
        url: '/api/clients',
        remoteAddress: '10.0.1.10',
      });
    }

    // Tenant A is now rate limited
    const resA = await app.inject({
      method: 'GET',
      url: '/api/clients',
      remoteAddress: '10.0.1.10',
    });
    expect(resA.statusCode).toBe(429);

    // Tenant B (different IP) should still be allowed
    const resB = await app.inject({
      method: 'GET',
      url: '/api/clients',
      remoteAddress: '10.0.2.20',
    });
    expect(resB.statusCode).toBe(200);
  });
});
