import helmet from '@fastify/helmet';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Helmet Security Headers — SEC-01 / Issue #22', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    await app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      xFrameOptions: { action: 'deny' },
      xContentTypeOptions: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    });

    // A health-check-like route so we can make requests
    app.get('/api/health', async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.status(200).send({ status: 'ok' });
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should include Content-Security-Policy header with correct directives (SEC-01-A)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.headers['content-security-policy']).toBeDefined();

    const csp = res.headers['content-security-policy'] as string;

    // default-src 'self'
    expect(csp).toContain("default-src 'self'");

    // script-src 'self' 'unsafe-inline'
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");

    // style-src 'self' 'unsafe-inline'
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");

    // img-src 'self' data: blob:
    expect(csp).toContain("img-src 'self' data: blob:");

    // frame-ancestors 'none'
    expect(csp).toContain("frame-ancestors 'none'");

    // form-action 'self'
    expect(csp).toContain("form-action 'self'");
  });

  it('should include Strict-Transport-Security with preload enabled (SEC-01-B)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    const hsts = res.headers['strict-transport-security'] as string;
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('should include X-Frame-Options: DENY (SEC-01-C)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('should include X-Content-Type-Options: nosniff (SEC-01-D)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should include X-DNS-Prefetch-Control header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('should include Referrer-Policy header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should set all security headers in a single response', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    const expectedHeaders = [
      'content-security-policy',
      'strict-transport-security',
      'x-frame-options',
      'x-content-type-options',
      'x-dns-prefetch-control',
      'referrer-policy',
      'x-permitted-cross-domain-policies',
      'cross-origin-resource-policy',
    ];

    for (const header of expectedHeaders) {
      expect(res.headers[header]).toBeDefined();
    }
  });
});
