import { FastifyInstance } from 'fastify';

export async function webhookRoutes(app: FastifyInstance) {
  // POST /api/webhooks/payment/:provider
  app.post('/api/webhooks/payment/:provider', async (request, reply) => {
    reply.code(200);
    return { received: true };
  });

  // POST /api/webhooks/evolution
  app.post('/api/webhooks/evolution', async (request, reply) => {
    reply.code(200);
    return { received: true };
  });
}
