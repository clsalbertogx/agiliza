import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createCreateSubscriptionUseCase, createSubscriptionRepository } from '@/presentation/factories/create-subscription.factory';
import { createCancelSubscriptionUseCase } from '@/presentation/factories/create-cancel-subscription.factory';
import { createExpireSubscriptionUseCase } from '@/presentation/factories/create-expire-subscription.factory';
import { createRenewSubscriptionUseCase } from '@/presentation/factories/create-renew-subscription.factory';
import { createPauseSubscriptionUseCase } from '@/presentation/factories/create-pause-subscription.factory';
import { createResumeSubscriptionUseCase } from '@/presentation/factories/create-resume-subscription.factory';
import { createAutoRenewSubscriptionUseCase } from '@/presentation/factories/create-auto-renew-subscription.factory';
import { createUpgradeSubscriptionUseCase } from '@/presentation/factories/create-upgrade-subscription.factory';
import { createStartTrialSubscriptionUseCase } from '@/presentation/factories/create-start-trial-subscription.factory';
import { createSetGracePeriodSubscriptionUseCase } from '@/presentation/factories/create-set-grace-period-subscription.factory';
import { createToggleAutoRenewSubscriptionUseCase } from '@/presentation/factories/create-toggle-auto-renew-subscription.factory';
import { BillingCycle, type Subscription } from '@/domain/entities/subscription';

const billingCycleValues = Object.values(BillingCycle) as [string, ...string[]];

const createSubscriptionSchema = z.object({
  clientId: z.string().uuid(),
  plan: z.string().min(1).max(255),
  amount: z.number().positive(),
  billingCycle: z.enum(billingCycleValues as any),
  trialDays: z.number().int().nonnegative().max(365).optional(),
  gracePeriodDays: z.number().int().nonnegative().max(90).optional(),
  autoRenew: z.boolean().optional(),
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
  required: ['clientId', 'plan', 'amount', 'billingCycle'],
  properties: {
    clientId: { type: 'string', format: 'uuid' },
    plan: { type: 'string', minLength: 1, maxLength: 255 },
    amount: { type: 'number', exclusiveMinimum: 0 },
    billingCycle: {
      type: 'string',
      enum: ['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'],
    },
    trialDays: { type: 'number', minimum: 0, maximum: 365 },
    gracePeriodDays: { type: 'number', minimum: 0, maximum: 90 },
    autoRenew: { type: 'boolean' },
  },
} as const;

const startTrialBodySchema = {
  type: 'object',
  required: ['trialDays'],
  properties: {
    trialDays: { type: 'number', minimum: 1, maximum: 365 },
  },
} as const;

const gracePeriodBodySchema = {
  type: 'object',
  required: ['days'],
  properties: {
    days: { type: 'number', minimum: 1, maximum: 90 },
  },
} as const;

const autoRenewBodySchema = {
  type: 'object',
  required: ['autoRenew'],
  properties: {
    autoRenew: { type: 'boolean' },
  },
} as const;

const upgradeBodySchema = {
  type: 'object',
  required: ['newPlan', 'newAmount'],
  properties: {
    newPlan: { type: 'string', minLength: 1, maxLength: 255 },
    newAmount: { type: 'number', exclusiveMinimum: 0 },
    billingCycle: {
      type: 'string',
      enum: ['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'],
    },
    trialDays: { type: 'number', minimum: 0, maximum: 365 },
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
      tenantId: request.tenantId!,
      clientId: data.clientId,
      plan: data.plan,
      amount: data.amount,
      billingCycle: data.billingCycle as BillingCycle,
      trialDays: data.trialDays,
      gracePeriodDays: data.gracePeriodDays,
      autoRenew: data.autoRenew,
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
       summary: 'Resume subscription',
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

   // PATCH /api/subscriptions/:id/trial — Start trial period
   const startTrialSchema = z.object({
     trialDays: z.number().int().positive().max(365),
   });

   app.patch('/api/subscriptions/:id/trial', {
     schema: {
       tags: ['Subscriptions'],
       summary: 'Start a trial period',
       security: [{ bearerAuth: [] }],
       params: idParamsSchema,
       body: startTrialBodySchema,
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

     const parsed = startTrialSchema.safeParse(request.body);
     if (!parsed.success) {
       reply.code(400);
       return { error: 'Validation error', details: parsed.error.flatten() };
     }

     const useCase = createStartTrialSubscriptionUseCase();
     const result = await useCase.execute({
       subscriptionId: id,
       tenantId,
       trialDays: parsed.data.trialDays,
     });

     if (!result.success) {
       reply.code(result.value.statusCode);
       return { error: result.value.message };
     }

     return { data: result.value };
   });

   // PATCH /api/subscriptions/:id/grace-period — Manually set grace period
   const gracePeriodSchema = z.object({
     days: z.number().int().positive().max(90),
   });

   app.patch('/api/subscriptions/:id/grace-period', {
     schema: {
       tags: ['Subscriptions'],
       summary: 'Set grace period on a subscription',
       security: [{ bearerAuth: [] }],
       params: idParamsSchema,
       body: gracePeriodBodySchema,
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

     const parsed = gracePeriodSchema.safeParse(request.body);
     if (!parsed.success) {
       reply.code(400);
       return { error: 'Validation error', details: parsed.error.flatten() };
     }

     const useCase = createSetGracePeriodSubscriptionUseCase();
     const result = await useCase.execute({
       subscriptionId: id,
       tenantId,
       days: parsed.data.days,
     });

     if (!result.success) {
       reply.code(result.value.statusCode);
       return { error: result.value.message };
     }

     return { data: result.value };
   });

   // PATCH /api/subscriptions/:id/auto-renew — Toggle auto-renew
   const autoRenewSchema = z.object({
     autoRenew: z.boolean(),
   });

   app.patch('/api/subscriptions/:id/auto-renew', {
     schema: {
       tags: ['Subscriptions'],
       summary: 'Toggle auto-renew on a subscription',
       security: [{ bearerAuth: [] }],
       params: idParamsSchema,
       body: autoRenewBodySchema,
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

     const parsed = autoRenewSchema.safeParse(request.body);
     if (!parsed.success) {
       reply.code(400);
       return { error: 'Validation error', details: parsed.error.flatten() };
     }

     const useCase = createToggleAutoRenewSubscriptionUseCase();
     const result = await useCase.execute({
       subscriptionId: id,
       tenantId,
       autoRenew: parsed.data.autoRenew,
     });

     if (!result.success) {
       reply.code(result.value.statusCode);
       return { error: result.value.message };
     }

     return { data: result.value };
   });

   // PATCH /api/subscriptions/:id/upgrade — Upgrade subscription with proration
   const upgradeSchema = z.object({
     newPlan: z.string().min(1).max(255),
     newAmount: z.number().positive(),
     billingCycle: z.enum(['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']).optional(),
     trialDays: z.number().int().nonnegative().max(365).optional(),
   });

   app.patch('/api/subscriptions/:id/upgrade', {
     schema: {
       tags: ['Subscriptions'],
       summary: 'Upgrade subscription with proration',
       security: [{ bearerAuth: [] }],
       params: idParamsSchema,
       body: upgradeBodySchema,
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

     const parsed = upgradeSchema.safeParse(request.body);
     if (!parsed.success) {
       reply.code(400);
       return { error: 'Validation error', details: parsed.error.flatten() };
     }

      const useCase = createUpgradeSubscriptionUseCase();
      const result = await useCase.execute({
        subscriptionId: id,
        tenantId,
        newPlan: parsed.data.newPlan,
        newAmount: parsed.data.newAmount,
        billingCycle: parsed.data.billingCycle as Subscription['billingCycle'] | undefined,
        trialDays: parsed.data.trialDays,
      });

     if (!result.success) {
       reply.code(result.value.statusCode);
       return { error: result.value.message };
     }

     return { data: result.value };
   });
 }
