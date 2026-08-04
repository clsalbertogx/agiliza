import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createOnboardingService } from '@/presentation/factories';

const startOnboardingSchema = z.object({
  clientId: z.string().uuid(),
});

const processAnswerSchema = z.object({
  clientId: z.string().uuid(),
  answer: z.string().min(1).max(100),
});

export async function onboardingRoutes(app: FastifyInstance) {
  const onboardingService = createOnboardingService();

  // Auth-like endpoints (login/register) — stricter rate limit of 20 req/min per IP
  const authRateLimit = {
    max: 20,
    timeWindow: '1 minute',
    keyGenerator: (req: { ip: string }) => req.ip,
  };

  // POST /api/onboarding/start — Start onboarding for a client
  app.post(
    '/api/onboarding/start',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Start onboarding for a client',
        description: 'Sends the first onboarding question via the configured message channel.',
        body: {
          type: 'object',
          required: ['clientId'],
          properties: {
            clientId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'object', additionalProperties: true } },
            additionalProperties: true,
          },
        },
      },
      config: { rateLimit: authRateLimit },
    },
    async (request, reply) => {
      const parsed = startOnboardingSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'Validation error', details: parsed.error.flatten() };
      }

      const tenantId = request.tenantId;
      if (!tenantId) {
        reply.code(401);
        return { error: 'Missing tenant context' };
      }

      try {
        await onboardingService.startOnboarding(parsed.data.clientId, tenantId);
        reply.code(200);
        return { data: { status: 'started', message: 'Primeira pergunta enviada!' } };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        reply.code(400);
        return { error: message };
      }
    },
  );

  // POST /api/onboarding/answer — Process client's answer
  app.post(
    '/api/onboarding/answer',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Process a client onboarding answer',
        body: {
          type: 'object',
          required: ['clientId', 'answer'],
          properties: {
            clientId: { type: 'string', format: 'uuid' },
            answer: { type: 'string', minLength: 1, maxLength: 100 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'object', additionalProperties: true } },
            additionalProperties: true,
          },
        },
      },
      config: { rateLimit: authRateLimit },
    },
    async (request, reply) => {
      const parsed = processAnswerSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'Validation error', details: parsed.error.flatten() };
      }

      const result = await onboardingService.processAnswer(parsed.data.clientId, parsed.data.answer);

      reply.code(200);
      return { data: result };
    },
  );

  // GET /api/onboarding/status/:clientId — Check onboarding status
  app.get(
    '/api/onboarding/status/:clientId',
    {
      schema: {
        tags: ['Onboarding'],
        summary: 'Check onboarding status',
        params: {
          type: 'object',
          required: ['clientId'],
          properties: { clientId: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'object', additionalProperties: true } },
            additionalProperties: true,
          },
        },
      },
      config: { rateLimit: authRateLimit },
    },
    async (request, _reply) => {
      const { clientId } = request.params as { clientId: string };
      const status = await onboardingService.getOnboardingStatus(clientId);
      return { data: status };
    },
  );
}
