import { FastifyInstance } from 'fastify';
import { GetNextDecisionUseCase } from '@/application/usecases/get-next-decision.usecase';
import { DecisionEngineService } from '@/application/services/decision-engine.service';

export async function decisionRoutes(app: FastifyInstance) {
  const useCase = new GetNextDecisionUseCase(new DecisionEngineService());
  // GET /api/decisions/next-action?clientId=X&invoiceId=Y
  app.get('/api/decisions/next-action', async (request) => {
    const { clientId, invoiceId } = request.query as any;

    const decision = await useCase.execute({
      clientId: clientId || '00000000-0000-0000-0000-000000000001',
      invoiceId: invoiceId || '00000000-0000-0000-0000-000000000010',
    });

    return {
      data: {
        action: decision.action,
        channel: decision.channel,
        templateName: decision.templateName,
        scheduledAt: decision.scheduledAt.toISOString(),
      },
    };
  });
}