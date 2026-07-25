import { FastifyInstance } from 'fastify';

export async function invoiceRoutes(app: FastifyInstance) {
  // POST /api/invoices
  app.post('/api/invoices', async (request, reply) => {
    reply.code(201);
    return { data: request.body };
  });

  // GET /api/invoices
  app.get('/api/invoices', async (request) => {
    return { data: [], meta: { total: 0 } };
  });

  // GET /api/invoices/:id
  app.get('/api/invoices/:id', async (request, reply) => {
    reply.code(404);
    return { error: 'Invoice not found' };
  });

  // POST /api/invoices/:id/pay
  app.post('/api/invoices/:id/pay', async (request, reply) => {
    reply.code(200);
    return { data: { status: 'paid' } };
  });
}
