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

export async function subscriptionRoutes(app: FastifyInstance) {
  // POST /api/subscriptions — Create subscription
  app.post('/api/subscriptions', async (request, reply) => {
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
  app.get('/api/subscriptions', async (request) => {
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
  app.get('/api/subscriptions/:id', async (request, reply) => {
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
  app.delete('/api/subscriptions/:id', async (request, reply) => {
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
  app.patch('/api/subscriptions/:id/expire', async (request, reply) => {
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
  app.patch('/api/subscriptions/:id/renew', async (request, reply) => {
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
  app.patch('/api/subscriptions/:id/pause', async (request, reply) => {
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
  app.patch('/api/subscriptions/:id/resume', async (request, reply) => {
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
