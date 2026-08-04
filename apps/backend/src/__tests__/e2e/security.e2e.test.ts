import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import authPlugin from '@/infrastructure/plugins/auth.plugin';
import { clientRoutes } from '@/routes/client.routes';
import { healthRoutes } from '@/routes/health.routes';

const mockState = vi.hoisted(() => ({
  findById: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    client: {
      findUnique: mockState.findById,
      findFirst: mockState.findById,
      findMany: mockState.findMany,
      count: mockState.count,
    },
  })),
}));

const mockStartOnboarding = vi.fn().mockResolvedValue(undefined);
vi.mock('@/presentation/factories/create-onboarding.factory', () => ({
  createOnboardingService: vi.fn(() => ({
    startOnboarding: mockStartOnboarding,
  })),
}));

describe('Security E2E', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      xFrameOptions: { action: 'deny' },
      xContentTypeOptions: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    });

    await app.register(authPlugin);
    await app.register(healthRoutes);
    await app.register(clientRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject unauthenticated requests with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/clients' });
    expect(res.statusCode).toBe(401);
  });

  it('should reject invalid tokens with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/clients',
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('should allow health check without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('should have security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeTruthy();
  });
});
