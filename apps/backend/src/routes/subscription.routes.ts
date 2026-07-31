import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createCreateSubscriptionUseCase, createSubscriptionRepository } from '@/presentation/factories/create-subscription.factory';
import { createCancelSubscriptionUseCase } from '@/presentation/factories/create-cancel-subscription.factory';
import { createExpireSubscriptionUseCase } from '@/presentation/factories/create-expire-subscription.factory';
import { createRenewSubscriptionUseCase } from '@/presentation/factories/create-renew-subscription.factory';
import { createPauseSubscriptionUseCase } from '@/presentation/factories/create-pause-subscription.factory';
import { createResumeSubscriptionUseCase } from '@/presentation/factories/create-resume-subscription.factory';
import { BillingCycle } from '@/domain/entities/subscription';

const billingCycleValues = Object.values(BillingCycle) as [string, ...string[]];

const createSubscriptionSchema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  plan: z.string().min(1).max(255),
  amount: z.number().positive(),
  billingCycle: z.enum(billingCycleValues as any),
});

// Pass-through response envelope for OpenAPI (see client.routes.ts).
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
  },
  additionalProperties: true,
};

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
} as const;

const subscriptionBodySchema = {
  type: 'object',
  required: ['tenantId', 'clientId', 'plan', 'amount', 'billingCycle'],
  properties: {
    tenantId: { type: 'string', format: 'uuid' },
    clientId: { type: 'string', format: 'uuid' },
    plan: { type: 'string', minLength: 1, maxLength: 255 },
    amount: { type: 'number', exclusiveMinimum: 0 },
    billingCycle: {
      type: 'string',
      enum: ['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'],
    },
  },
} as const;

export async function subscriptionRoutes(app: FastifyInstance) {
  // POST /api/subscriptions — Create subscription
  app.post('/api/subscriptions', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'Create a subscription',
      security: [{ bearerAuth: [] }],
      body: subscriptionBodySchema,
      response: {
        201: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const parsed = createSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const data = parsed.data;
    const useCase = createCreateSubscriptionUseCase();

    const result = await useCase.execute({
      tenantId: data.tenantId,
      clientId: data.clientId,
      plan: data.plan,
      amount: data.amount,
      billingCycle: data.billingCycle as BillingCycle,
    });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    reply.code(201);
    return { data: result.value };
  });

  // GET /api/subscriptions — List subscriptions by tenant
  app.get('/api/subscriptions', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'List subscriptions',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          clientId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: listEnvelope,
      },
    },
  }, async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;
    const clientId = query.clientId as string | undefined;

    const subscriptionRepo = createSubscriptionRepository();

    if (clientId) {
      const subscriptions = await subscriptionRepo.findByClientId(clientId, tenantId);
      return { data: subscriptions };
    }

    const subscriptions = await subscriptionRepo.findByTenantId(tenantId);
    return { data: subscriptions };
  });

  // GET /api/subscriptions/:id — Get subscription by id
  app.get('/api/subscriptions/:id', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'Get a subscription by ID',
      security: [{ bearerAuth: [] }],
      params: idParamsSchema,
      response: {
        200: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId;

    const subscriptionRepo = createSubscriptionRepository();
    const subscription = await subscriptionRepo.findById(id, tenantId);

    if (!subscription) {
      reply.code(404);
      return { error: 'Subscription not found' };
    }

    return { data: subscription };
  });

  // DELETE /api/subscriptions/:id — Cancel subscription
  app.delete('/api/subscriptions/:id', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'Cancel a subscription',
      security: [{ bearerAuth: [] }],
      params: idParamsSchema,
      response: {
        200: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId;

    if (!tenantId) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }

    const useCase = createCancelSubscriptionUseCase();
    const result = await useCase.execute({ id, tenantId });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });

  // PATCH /api/subscriptions/:id/expire — Expire subscription
  app.patch('/api/subscriptions/:id/expire', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'Expire a subscription',
      security: [{ bearerAuth: [] }],
      params: idParamsSchema,
      response: {
        200: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId;

    if (!tenantId) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }

    const useCase = createExpireSubscriptionUseCase();
    const result = await useCase.execute({ subscriptionId: id, tenantId });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });

  // PATCH /api/subscriptions/:id/renew — Renew subscription
  app.patch('/api/subscriptions/:id/renew', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'Renew a subscription',
      security: [{ bearerAuth: [] }],
      params: idParamsSchema,
      response: {
        200: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId;

    if (!tenantId) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }

    const useCase = createRenewSubscriptionUseCase();
    const result = await useCase.execute({ subscriptionId: id, tenantId });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });

  // PATCH /api/subscriptions/:id/pause — Pause subscription
  app.patch('/api/subscriptions/:id/pause', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'Pause a subscription',
      security: [{ bearerAuth: [] }],
      params: idParamsSchema,
      response: {
        200: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId;

    if (!tenantId) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }

    const useCase = createPauseSubscriptionUseCase();
    const result = await useCase.execute({ subscriptionId: id, tenantId });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });

  // PATCH /api/subscriptions/:id/resume — Resume subscription
  app.patch('/api/subscriptions/:id/resume', {
    schema: {
      tags: ['Subscriptions'],
      summary: 'Resume a subscription',
      security: [{ bearerAuth: [] }],
      params: idParamsSchema,
      response: {
        200: dataEnvelope,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId;

    if (!tenantId) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }

    const useCase = createResumeSubscriptionUseCase();
    const result = await useCase.execute({ subscriptionId: id, tenantId });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });
}
