import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createCreateClientUseCase, createListClientsUseCase, createGetClientUseCase, createClientRepository } from '@/presentation/factories';

const createClientSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  document: z.string().optional(),
  preferredChannel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']).optional(),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM').optional(),
  preferredLeadDays: z.number().int().min(1).max(14).optional(),
});

const updateClientSchema = createClientSchema.partial();

// Pass-through response envelopes for OpenAPI: `additionalProperties: true`
// keeps the serializer from stripping fields the docs don't enumerate.
const dataEnvelope = {
  type: 'object',
  properties: {
    data: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
};

const listEnvelope = {
  type: 'object',
  properties: {
    data: { type: 'array', items: { type: 'object', additionalProperties: true } },
    meta: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
};

export async function clientRoutes(app: FastifyInstance) {
  const clientRepo = createClientRepository();
  // POST /api/clients — Create client (via use case)
  app.post('/api/clients', {
    schema: {
      tags: ['Clients'],
      summary: 'Create a new client',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'phone'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          phone: { type: 'string', minLength: 10, maxLength: 15 },
          email: { type: 'string', format: 'email' },
          document: { type: 'string' },
          preferredChannel: { type: 'string', enum: ['WHATSAPP', 'EMAIL', 'SMS'] },
          preferredTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          preferredLeadDays: { type: 'integer', minimum: 1, maximum: 14 },
        },
      },
      response: {
        201: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const parsed = createClientSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const data = parsed.data;
    const useCase = createCreateClientUseCase();

    const result = await useCase.execute({
      tenantId: request.tenantId!,
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
        const { createOnboardingService } = await import('@/presentation/factories/create-onboarding.factory');
        const onboardingService = createOnboardingService();
        await onboardingService.startOnboarding(result.value.id, request.tenantId!);
      } catch (err) {
        console.warn('Failed to auto-trigger onboarding:', err);
      }
    }

    return { data: result.value };
  });

  // GET /api/clients — List clients (via use case)
  app.get('/api/clients', {
    schema: {
      tags: ['Clients'],
      summary: 'List clients',
      description: 'Paginated client list, filtered by the authenticated tenant unless a tenantId is passed.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          page: { type: 'integer', minimum: 1 },
          perPage: { type: 'integer', minimum: 1 },
          search: { type: 'string' },
          riskScore: { type: 'string' },
        },
      },
      response: {
        200: listEnvelope,
      },
    },
  }, async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;

    const useCase = createListClientsUseCase();
    const result = await useCase.execute({
      tenantId,
      page: parseInt(query.page) || 1,
      perPage: parseInt(query.perPage) || 10,
      search: query.search as string | undefined,
      riskScore: query.riskScore as string | undefined,
    });

    return result;
  });

  // GET /api/clients/:id — Get client (via use case, tenant-isolated)
  app.get('/api/clients/:id', {
    schema: {
      tags: ['Clients'],
      summary: 'Get a client by ID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId;

    const useCase = createGetClientUseCase();
    const result = await useCase.execute({ id, tenantId: tenantId! });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });

  // PATCH /api/clients/:id — Update client (tenant-isolated)
  app.patch('/api/clients/:id', {
    schema: {
      tags: ['Clients'],
      summary: 'Update a client',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          phone: { type: 'string', minLength: 10, maxLength: 15 },
          email: { type: 'string', format: 'email' },
          document: { type: 'string' },
          preferredChannel: { type: 'string', enum: ['WHATSAPP', 'EMAIL', 'SMS'] },
          preferredTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          preferredLeadDays: { type: 'integer', minimum: 1, maximum: 14 },
        },
      },
      response: {
        200: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Check exists (with tenant isolation)
    const existing = await clientRepo.findByIdRaw(id, request.tenantId);
    if (!existing) {
      reply.code(404);
      return { error: 'Client not found' };
    }

    const parsed = updateClientSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const updated = await clientRepo.updateRaw(id, parsed.data, request.tenantId);
    return { data: updated };
  });

  // GET /api/clients/:id/risk-score — Get client risk score
  app.get('/api/clients/:id/risk-score', {
    schema: {
      tags: ['Clients'],
      summary: 'Get client risk score',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await clientRepo.findByIdRaw(id, request.tenantId);

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
