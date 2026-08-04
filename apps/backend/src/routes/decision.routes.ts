import type { FastifyInstance } from 'fastify';
import { createGetNextDecisionUseCase } from '@/presentation/factories';

export async function decisionRoutes(app: FastifyInstance) {
  // GET /api/decisions/next-action?clientId=X&invoiceId=Y
  // Note: `required` is intentionally NOT set on the querystring schema —
  // the handler validates missing params itself and returns a stable
  // `{ error: 'clientId and invoiceId are required' }` contract.
  app.get(
    '/api/decisions/next-action',
    {
      schema: {
        tags: ['Decisions'],
        summary: 'Get next best action for an invoice',
        description: 'Decision engine: channel, template and scheduling for the next reminder.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            clientId: { type: 'string' },
            invoiceId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'object', additionalProperties: true },
            },
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
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
    },
  );
}
