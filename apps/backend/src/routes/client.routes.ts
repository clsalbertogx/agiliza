import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ClientRepository } from '../infrastructure/database/repositories/client.repository';

const createClientSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  document: z.string().optional(),
  preferredChannel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']).optional().default('WHATSAPP'),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM').optional(),
  preferredLeadDays: z.number().int().min(1).max(14).optional().default(3),
});

const updateClientSchema = createClientSchema.partial();

const clientRepo = new ClientRepository();

export async function clientRoutes(app: FastifyInstance) {
  // POST /api/clients — Create client
  app.post('/api/clients', async (request, reply) => {
    const parsed = createClientSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const data = parsed.data;

    // Check duplicate phone
    const existing = await clientRepo.findByPhone(data.tenantId, data.phone);
    if (existing) {
      reply.code(409);
      return { error: 'Client with this phone already exists' };
    }

    const client = await clientRepo.create({
      id: crypto.randomUUID(),
      ...data,
      riskScore: 'GREEN',
      totalInvoices: 0,
      paidInvoices: 0,
    });

    reply.code(201);
    return { data: client };
  });

  // GET /api/clients — List clients
  app.get('/api/clients', async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;
    const page = Math.max(1, parseInt(query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(query.perPage) || 10));
    const skip = (page - 1) * perPage;
    const search = query.search as string | undefined;
    const riskScore = query.riskScore as string | undefined;

    const where: any = { tenantId };
    if (riskScore) where.riskScore = riskScore;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      clientRepo.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
      clientRepo.count(where),
    ]);

    return {
      data,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  });

  // GET /api/clients/:id — Get client
  app.get('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await clientRepo.findById(id);

    if (!client) {
      reply.code(404);
      return { error: 'Client not found' };
    }

    // Tenant isolation
    if (request.tenantId && client.tenantId !== request.tenantId) {
      reply.code(404);
      return { error: 'Client not found' };
    }

    return { data: client };
  });

  // PATCH /api/clients/:id — Update client
  app.patch('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Check exists
    const existing = await clientRepo.findById(id);
    if (!existing) {
      reply.code(404);
      return { error: 'Client not found' };
    }

    const parsed = updateClientSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const updated = await clientRepo.update(id, parsed.data);
    return { data: updated };
  });

  // GET /api/clients/:id/risk-score — Get client risk score
  app.get('/api/clients/:id/risk-score', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await clientRepo.findById(id);

    if (!client) {
      reply.code(404);
      return { error: 'Client not found' };
    }

    return {
      data: {
        riskScore: client.riskScore,
        riskScoreReason: client.riskScoreReason,
        updatedAt: client.riskScoreUpdatedAt,
      },
    };
  });
}
