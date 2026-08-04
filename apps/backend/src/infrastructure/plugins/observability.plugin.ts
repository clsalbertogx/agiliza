import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '@/config/logger';
import {
  getMetrics,
  getMetricsContentType,
  httpRequestDuration,
  httpRequestsTotal,
} from '@/infrastructure/observability/metrics';

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

async function observabilityPlugin(app: FastifyInstance) {
  app.decorateRequest('startTime', undefined);

  // Request/response logging
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.startTime = Date.now();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - (request.startTime ?? Date.now());
    const durationSeconds = duration / 1000;
    const route = (request.routeOptions && (request.routeOptions as { url?: string }).url) || request.url || 'unknown';

    // Log request
    logger.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: duration,
      },
      'request completed',
    );

    // Record metrics
    httpRequestDuration.observe(
      { method: request.method, route, status_code: String(reply.statusCode) },
      durationSeconds,
    );
    httpRequestsTotal.inc({
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    });
  });

  // Metrics endpoint
  app.get(
    '/metrics',
    {
      config: {
        rateLimit: {
          max: 1000,
          timeWindow: '1 minute',
        },
      },
    },
    async (_request, reply) => {
      const metrics = await getMetrics();
      const contentType = await getMetricsContentType();
      reply.header('Content-Type', contentType);
      return metrics;
    },
  );
}

export default fp(observabilityPlugin, { name: 'observability' });
