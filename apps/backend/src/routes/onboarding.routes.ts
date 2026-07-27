import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OnboardingService } from '../application/services/onboarding.service';

const onboardingService = new OnboardingService();

const startOnboardingSchema = z.object({
  clientId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

const processAnswerSchema = z.object({
  clientId: z.string().uuid(),
  answer: z.string().min(1).max(100),
});

export async function onboardingRoutes(app: FastifyInstance) {
  // POST /api/onboarding/start — Start onboarding for a client
  app.post('/api/onboarding/start', async (request, reply) => {
    const parsed = startOnboardingSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    try {
      await onboardingService.startOnboarding(parsed.data.clientId, parsed.data.tenantId);
      reply.code(200);
      return { data: { status: 'started', message: 'Primeira pergunta enviada!' } };
    } catch (error: any) {
      reply.code(400);
      return { error: error.message };
    }
  });

  // POST /api/onboarding/answer — Process client's answer
  app.post('/api/onboarding/answer', async (request, reply) => {
    const parsed = processAnswerSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const result = await onboardingService.processAnswer(
      parsed.data.clientId,
      parsed.data.answer
    );

    reply.code(200);
    return { data: result };
  });

  // GET /api/onboarding/status/:clientId — Check onboarding status
  app.get('/api/onboarding/status/:clientId', async (request, reply) => {
    const { clientId } = request.params as { clientId: string };
    const status = await onboardingService.getOnboardingStatus(clientId);
    return { data: status };
  });
}
