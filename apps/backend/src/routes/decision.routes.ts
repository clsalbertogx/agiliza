import { FastifyInstance } from 'fastify';
import { createGetNextDecisionUseCase } from '@/presentation/factories';

export async function decisionRoutes(app: FastifyInstance) {
  // GET /api/decisions/next-action?clientId=X&invoiceId=Y
  app.get('/api/decisions/next-action', async (request, reply) => {
    const { clientId, invoiceId } = request.query as Record<string, string | undefined>;
    const tenantId = (request as any).tenantId as string | undefined;

    if (!clientId || !invoiceId) {
      reply.code(400);
      return { error: 'clientId and invoiceId are required' };
    }

    if (!tenantId) {
      reply.code(401);
      return { error: 'Unauthorized' };
    }

    const useCase = createGetNextDecisionUseCase();
    const result = await useCase.execute({ clientId, invoiceId, tenantId });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });
}
