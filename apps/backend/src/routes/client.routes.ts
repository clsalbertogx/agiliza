import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clientSchema } from '../domain/entities/client';

export async function clientRoutes(app: FastifyInstance) {
  // POST /api/clients
  app.post('/api/clients', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'phone', 'tenantId'],
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          tenantId: { type: 'string' },
          preferredChannel: { type: 'string', enum: ['WHATSAPP', 'EMAIL', 'SMS'] },
          preferredTime: { type: 'string' },
          preferredLeadDays: { type: 'number' },
        },
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const parsed = clientSchema.parse({
      id: crypto.randomUUID(),
      ...data,
      phone: String(data.phone),
      preferredLeadDays: data.preferredLeadDays ?? 3,
    });
    reply.code(201);
    return { data: parsed };
  });

  // GET /api/clients
  app.get('/api/clients', async (request) => {
    const query = request.query as any;
    return {
      data: [],
      meta: {
        total: 0,
        page: query.page ?? 1,
        perPage: query.perPage ?? 10,
      },
    };
  });

  // GET /api/clients/:id
  app.get('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: fetch from repository
    reply.code(404);
    return { error: 'Client not found' };
  });

  // PATCH /api/clients/:id
  app.patch('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    reply.code(200);
    return { data: { id } };
  });
}
