import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import Redis from 'ioredis';
import { env } from './config/env';
import { registerRoutes } from './routes';
import authPlugin from './infrastructure/plugins/auth.plugin';
import { disconnectRedis, closeAllQueues } from './infrastructure/queue';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Plugins
  await app.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", env.FRONTEND_URL],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    xFrameOptions: { action: 'deny' },
    xContentTypeOptions: true,
  });

  // Global rate limiting
  await app.register(rateLimit, {
    redis: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }),
    global: false,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return (request as any).tenantId || request.ip;
    },
  });

  // Auth (applies to all routes except public ones)
  await app.register(authPlugin);

  // Routes
  await registerRoutes(app);

  return app;
}

async function start() {
  const app = await buildApp();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    try {
      await closeAllQueues();
      await disconnectRedis();
      await app.close();
      console.log('[Server] All connections closed');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`Server running at http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export { buildApp };
