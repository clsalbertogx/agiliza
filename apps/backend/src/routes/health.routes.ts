import type { FastifyInstance } from 'fastify';
import { env } from '@/config/env';
import { VERSION } from '@/config/version';

export async function healthRoutes(app: FastifyInstance) {
  // Health endpoint has a much higher rate limit (1000/min) so it's effectively
  // never blocked by rate limiting — monitoring tools must always reach it.
  app.get(
    '/api/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Public endpoint used by monitoring tools and load balancers.',
        response: {
          200: {
            type: 'object',
            required: ['status', 'timestamp', 'uptime', 'version'],
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              uptime: { type: 'number' },
              version: { type: 'string' },
            },
          },
        },
      },
      config: {
        rateLimit: {
          max: 1000,
          timeWindow: '1 minute',
        },
      },
    },
    async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: VERSION,
      };
    },
  );

  // Readiness endpoint — checks database and Redis connectivity
  app.get(
    '/api/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness check',
        description: 'Indicates whether the service is ready to accept traffic.',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              checks: {
                type: 'object',
                properties: {
                  database: { type: 'string' },
                  redis: { type: 'string' },
                },
              },
            },
          },
        },
      },
      config: {
        rateLimit: {
          max: 1000,
          timeWindow: '1 minute',
        },
      },
    },
    async () => {
      const checks: { database: string; redis: string } = {
        database: 'ok',
        redis: 'ok',
      };

      // Database check
      try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient({
          datasources: { db: { url: env.DATABASE_URL } },
        });
        await prisma.$queryRaw`SELECT 1`;
        await prisma.$disconnect();
      } catch {
        checks.database = 'error';
      }

      // Redis check
      try {
        const Redis = (await import('ioredis')).default;
        const redis = new Redis(env.REDIS_URL, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });
        await redis.connect();
        await redis.ping();
        await redis.quit();
      } catch {
        checks.redis = 'error';
      }

      const allOk = checks.database === 'ok' && checks.redis === 'ok';
      return {
        status: allOk ? 'ok' : 'degraded',
        checks,
      };
    },
  );
}
