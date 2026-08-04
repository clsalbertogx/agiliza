import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import Redis from 'ioredis';
import { env } from './config/env';
import { InMemoryEventBus } from './infrastructure/event-bus/in-memory-event-bus';
import authPlugin from './infrastructure/plugins/auth.plugin';
import observabilityPlugin from './infrastructure/plugins/observability.plugin';
import {
  closeAllQueues,
  closeWorker,
  disconnectRedis,
  startDeadLetterWorker,
  startReminderWorker,
} from './infrastructure/queue';
import {
  createAutoRenewQueue,
  scheduleAutoRenewJob,
  startAutoRenewWorker,
} from './infrastructure/queue/auto-renew.worker';
import {
  createRecurringInvoiceQueue,
  scheduleRecurringInvoiceJob,
  startRecurringInvoiceWorker,
} from './infrastructure/queue/recurring-invoice.worker';
import {
  createAlertService,
  createAutoRenewSubscriptionUseCase,
  createRecurringInvoiceUseCase,
  createReminderService,
  createSubscriptionRepository,
} from './presentation/factories';
import { registerEventHandlers } from './presentation/factories/register-event-handlers';
import { errorHandler } from './presentation/handler';
import { registerRoutes } from './routes';

// Module-level worker references for graceful shutdown
let reminderWorker: ReturnType<typeof startReminderWorker> | null = null;
let recurringInvoiceWorker: ReturnType<typeof startRecurringInvoiceWorker> | null = null;
let recurringInvoiceQueue: ReturnType<typeof createRecurringInvoiceQueue> | null = null;
let autoRenewWorker: ReturnType<typeof startAutoRenewWorker> | null = null;
let autoRenewQueue: ReturnType<typeof createAutoRenewQueue> | null = null;
let deadLetterWorker: ReturnType<typeof startDeadLetterWorker> | null = null;

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
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", env.FRONTEND_URL],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    xFrameOptions: { action: 'deny' },
    xContentTypeOptions: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // Global rate limiting
  await app.register(rateLimit, {
    redis: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }),
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return (request as any).tenantId || request.ip;
    },
  });

  // OpenAPI 3.0 documentation — core plugin always registered (it only
  // collects route schemas in memory; it exposes nothing by itself).
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Agiliza API',
        description: 'Gestão de Assinaturas e Cobrança Recorrente com IA Preditiva',
        version: '0.8.0',
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  // Swagger UI at /docs — dev/test only. The UI (and its /docs/json spec
  // endpoint) would leak route internals publicly in production, so it is
  // not registered there. Registered BEFORE the auth plugin so /docs stays
  // reachable without credentials.
  if (env.NODE_ENV !== 'production') {
    await app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
      staticCSP: true,
    });
  }

  // Observability — logging + metrics (registered before auth so startTime is set on every request)
  await app.register(observabilityPlugin);

  // Auth (applies to all routes except public ones)
  await app.register(authPlugin);

  // Routes
  await registerRoutes(app);

  // Event bus with domain event handlers
  const eventBus = new InMemoryEventBus();
  registerEventHandlers(eventBus);

  // Start the reminder worker after event bus setup
  const reminderService = createReminderService();
  reminderWorker = startReminderWorker(reminderService);

  // Start the recurring invoice worker
  const recurringInvoiceUseCase = createRecurringInvoiceUseCase();
  recurringInvoiceQueue = createRecurringInvoiceQueue();
  await scheduleRecurringInvoiceJob(recurringInvoiceQueue);
  recurringInvoiceWorker = startRecurringInvoiceWorker(recurringInvoiceUseCase);

  // Start the auto-renew worker (daily cron at 5:00 AM)
  const autoRenewUseCase = createAutoRenewSubscriptionUseCase();
  const autoRenewSubscriptionRepo = createSubscriptionRepository();
  autoRenewQueue = createAutoRenewQueue();
  await scheduleAutoRenewJob(autoRenewQueue);
  autoRenewWorker = startAutoRenewWorker(autoRenewUseCase, autoRenewSubscriptionRepo);

  // Start the dead-letter queue worker
  const alertService = createAlertService();
  deadLetterWorker = startDeadLetterWorker(alertService);

  // Global error handler (must be registered after routes)
  app.setErrorHandler(errorHandler);

  return app;
}

async function start() {
  const app = await buildApp();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    try {
      if (reminderWorker) await closeWorker(reminderWorker);
      if (recurringInvoiceWorker) await closeWorker(recurringInvoiceWorker);
      if (autoRenewWorker) await closeWorker(autoRenewWorker);
      if (deadLetterWorker) await closeWorker(deadLetterWorker);
      if (recurringInvoiceQueue) await recurringInvoiceQueue.close();
      if (autoRenewQueue) await autoRenewQueue.close();
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
