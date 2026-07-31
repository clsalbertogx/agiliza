import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  // Health endpoint has a much higher rate limit (1000/min) so it's effectively
  // never blocked by rate limiting — monitoring tools must always reach it.
  app.get('/api/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Public endpoint used by monitoring tools and load balancers.',
      response: {
        200: {
          type: 'object',
          required: ['status', 'timestamp', 'uptime'],
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number' },
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
  }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}
