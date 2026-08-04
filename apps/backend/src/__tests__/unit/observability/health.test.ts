import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Mock PrismaClient before importing the routes
vi.mock('@prisma/client', () => {
  const $queryRaw = vi.fn().mockResolvedValue([{ '?column?': 1 }]);
  const $disconnect = vi.fn().mockResolvedValue(undefined);
  return {
    PrismaClient: vi.fn(() => ({
      $queryRaw,
      $disconnect,
    })),
  };
});

// Mock ioredis
vi.mock('ioredis', () => {
  const connect = vi.fn().mockResolvedValue(undefined);
  const ping = vi.fn().mockResolvedValue('PONG');
  const quit = vi.fn().mockResolvedValue('OK');
  const defaultExport = vi.fn(() => ({ connect, ping, quit }));
  return { default: defaultExport };
});

import { healthRoutes } from '@/routes/health.routes';

describe('Health Route', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/health returns status, uptime, version', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const body = res.json() as {
      status: string;
      timestamp: string;
      uptime: number;
      version: string;
    };

    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
    expect(typeof body.timestamp).toBe('string');
  });

  it('GET /api/ready returns readiness status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ready' });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      status: string;
      checks: { database: string; redis: string };
    };

    expect(['ok', 'degraded']).toContain(body.status);
    expect(body.checks.database).toBe('ok');
    expect(body.checks.redis).toBe('ok');
  });
});
