import { FastifyInstance } from 'fastify';
import { DecisionEngineService } from '../application/services/decision-engine.service';
import { createClient, MessageChannel, RiskScore, type Client } from '../domain/entities/client';
import { createInvoice, type Invoice } from '../domain/entities/invoice';

const decisionEngine = new DecisionEngineService();

export async function decisionRoutes(app: FastifyInstance) {
  // GET /api/decisions/next-action?clientId=X&invoiceId=Y
  app.get('/api/decisions/next-action', async (request) => {
    const { clientId, invoiceId } = request.query as any;

    // MVP: use default client/invoice, as we don't fetch from DB yet
    const defaultClient: Client = createClient({
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: 'Cliente',
      phone: '5511999999999',
      preferredChannel: MessageChannel.WHATSAPP,
      preferredLeadDays: 3,
      riskScore: RiskScore.GREEN,
      totalInvoices: 0,
      paidInvoices: 0,
      avgPaymentDelay: null,
    });

    const defaultInvoice: Invoice = createInvoice({
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: clientId || '00000000-0000-0000-0000-000000000001',
      amount: 100,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      description: 'Default invoice',
    });

    const decision = decisionEngine.decideNextAction(defaultClient, defaultInvoice, 'default');

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
