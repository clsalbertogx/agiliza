import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  // Health endpoint has a much higher rate limit (1000/min) so it's effectively
  // never blocked by rate limiting — monitoring tools must always reach it.
  app.get('/health', {
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
