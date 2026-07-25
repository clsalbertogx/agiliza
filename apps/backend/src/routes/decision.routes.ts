import { FastifyInstance } from 'fastify';

export async function decisionRoutes(app: FastifyInstance) {
  // GET /api/decisions/next-action?clientId=X&invoiceId=Y
  app.get('/api/decisions/next-action', async (request) => {
    const { clientId, invoiceId } = request.query as any;
    return {
      data: {
        action: 'send_reminder',
        channel: 'WHATSAPP',
        templateName: 'friendly_reminder_d3',
        scheduledAt: new Date().toISOString(),
      },
    };
  });
}
