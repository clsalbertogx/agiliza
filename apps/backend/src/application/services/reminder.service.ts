import { DecisionEngineService, type Decision } from './decision-engine.service';
import { InvoiceRepository } from '../../infrastructure/database/repositories/invoice.repository';
import { ClientRepository } from '../../infrastructure/database/repositories/client.repository';
import { EventRepository } from '../../infrastructure/database/repositories/event.repository';
import { addJob, QueueNames } from '../../infrastructure/queue';
import { EvolutionMessageProvider } from '../../infrastructure/messaging/evolution/evolution-message.provider';
import type { Invoice } from '../../domain/entities/invoice';
import type { Client } from '../../domain/entities/client';

export class ReminderService {
  private decisionEngine = new DecisionEngineService();
  private invoiceRepo = new InvoiceRepository();
  private clientRepo = new ClientRepository();
  private eventRepo = new EventRepository();

  async processPendingReminders(tenantId: string): Promise<{ processed: number; decisions: Decision[] }> {
    const today = new Date();
    const pendingInvoices = await this.invoiceRepo.findPendingForDate(tenantId, today);
    const decisions: Decision[] = [];

    for (const invoice of pendingInvoices) {
      const client = invoice.client as Client | undefined;
      if (!client) continue;

      // Get decision from engine
      const decision = this.decisionEngine.decideNextAction(
        client,
        invoice as unknown as Invoice,
        'default',
      );
      decisions.push(decision);

      // Schedule the reminder via BullMQ
      await this.scheduleReminder(invoice, client, decision);
    }

    return { processed: pendingInvoices.length, decisions };
  }

  private async scheduleReminder(invoice: any, client: Client, decision: Decision): Promise<void> {
    const invoiceAmount = Number(invoice.amount).toFixed(2);

    await addJob(
      QueueNames.SEND_MESSAGE,
      'send-message',
      {
        invoiceId: invoice.id,
        clientId: client.id,
        tenantId: client.tenantId,
        to: client.phone,
        channel: decision.channel,
        templateName: decision.templateName,
        variables: {
          name: client.name.split(' ')[0],
          value: `R$ ${invoiceAmount}`,
          dueDate: decision.scheduledAt.toLocaleDateString('pt-BR'),
          pixLink: '{{pix_link_placeholder}}',
        },
        scheduledAt: decision.scheduledAt.toISOString(),
        confidence: decision.confidence,
        reasoning: decision.reasoning,
      } as Record<string, unknown>,
      {
        delay: Math.max(0, decision.scheduledAt.getTime() - Date.now()),
      },
    );

    // Log decision
    await this.eventRepo.logEvent({
      tenantId: client.tenantId,
      clientId: client.id,
      eventType: 'DECISION_MADE',
      payload: {
        invoiceId: invoice.id,
        decision,
        scheduledAt: decision.scheduledAt.toISOString(),
      },
      source: 'reminder-service',
    });
  }

  async sendReminderNow(invoiceId: string, tenantId: string): Promise<any> {
    const invoice = await this.invoiceRepo.getInvoiceWithClient(invoiceId);
    if (!invoice || !invoice.client) throw new Error('Invoice or client not found');

    const provider = new EvolutionMessageProvider({
      baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: process.env.EVOLUTION_API_KEY || 'dev-key',
      instanceName: `agiliza-${tenantId.slice(0, 8)}`,
    });

    const result = await provider.sendTemplate({
      to: invoice.client.phone,
      text: '',
      tenantId,
      clientId: invoice.client.id,
      invoiceId,
      templateName: 'friendly_reminder_d3',
      variables: {
        name: invoice.client.name.split(' ')[0],
        value: `R$ ${Number(invoice.amount).toFixed(2)}`,
        dueDate: new Date(invoice.dueDate).toLocaleDateString('pt-BR'),
        pixLink: invoice.pixCopyPaste || 'PIX não disponível',
      },
    });

    return result;
  }
}
