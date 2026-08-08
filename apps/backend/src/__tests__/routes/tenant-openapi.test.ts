import fastifySwagger from '@fastify/swagger';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The swagger plugin only collects route schemas in memory; the tenant
// repository is still constructed at import time, so the prisma client
// needs the same mock treatment as tenant-isolation.test.ts.
const mockState = vi.hoisted(() => ({
  tenantFindUnique: vi.fn(),
  tenantFindMany: vi.fn(),
  tenantCount: vi.fn(),
  tenantCreate: vi.fn(),
  tenantUpdate: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    tenant: {
      findUnique: mockState.tenantFindUnique,
      findFirst: mockState.tenantFindUnique,
      findMany: mockState.tenantFindMany,
      create: mockState.tenantCreate,
      update: mockState.tenantUpdate,
      count: mockState.tenantCount,
    },
    paymentProviderConfig: {
      upsert: vi.fn().mockResolvedValue(undefined),
      findUnique: vi.fn(),
    },
    invoice: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    event: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  })),
}));

import { VERSION } from '@/config/version';
import authPlugin from '@/infrastructure/plugins/auth.plugin';
import { tenantRoutes } from '@/routes/tenant.routes';

describe('OpenAPI — POST /api/tenants (public signup) schema', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(fastifySwagger, {
      openapi: {
        info: { title: 'Agiliza API', version: VERSION },
        servers: [{ url: 'http://localhost:3333' }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    });
    await app.register(authPlugin);
    await app.register(tenantRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('declara security: [] (endpoint público) — não exige bearerAuth', () => {
    const doc = app.swagger();
    const post = doc.paths?.['/api/tenants']?.post as { security?: unknown[]; description?: string } | undefined;
    expect(post).toBeDefined();
    expect(post?.security).toEqual([]);
  });

  it('documenta o endpoint como público (description)', () => {
    const doc = app.swagger();
    const post = doc.paths?.['/api/tenants']?.post as { description?: string } | undefined;
    expect(post?.description).toBeTruthy();
    expect(post?.description).toMatch(/p[uú]blico/i);
  });
});
