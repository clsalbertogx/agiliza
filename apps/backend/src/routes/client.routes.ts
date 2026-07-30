import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ClientRepository } from '../infrastructure/database/repositories/client.repository';
import { createCreateClientUseCase } from '../presentation/factories';

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
  // POST /api/clients — Create client (via use case)
  app.post('/api/clients', async (request, reply) => {
    const parsed = createClientSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const data = parsed.data;
    const useCase = createCreateClientUseCase();

    const result = await useCase.execute({
      tenantId: data.tenantId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      preferredChannel: data.preferredChannel?.toLowerCase() as 'whatsapp' | 'sms' | 'email' | undefined,
      preferredLeadDays: data.preferredLeadDays,
    });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    reply.code(201);

    // Auto-trigger onboarding for new clients without preferences
    if (!data.preferredChannel && !data.preferredTime) {
      try {
        const { OnboardingService } = await import('../application/services/onboarding.service');
        const onboardingService = new OnboardingService();
        await onboardingService.startOnboarding(result.value.id, data.tenantId);
      } catch (err) {
        console.warn('Failed to auto-trigger onboarding:', err);
      }
    }

    return { data: result.value };
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

  // GET /api/clients/:id — Get client (tenant-isolated)
  app.get('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await clientRepo.findById(id, request.tenantId);

    if (!client) {
      reply.code(404);
      return { error: 'Client not found' };
    }

    return { data: client };
  });

  // PATCH /api/clients/:id — Update client (tenant-isolated)
  app.patch('/api/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Check exists (with tenant isolation)
    const existing = await clientRepo.findById(id, request.tenantId);
    if (!existing) {
      reply.code(404);
      return { error: 'Client not found' };
    }

    const parsed = updateClientSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const updated = await clientRepo.update(id, parsed.data, request.tenantId);
    return { data: updated };
  });

  // GET /api/clients/:id/risk-score — Get client risk score
  app.get('/api/clients/:id/risk-score', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await clientRepo.findById(id, request.tenantId);

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
