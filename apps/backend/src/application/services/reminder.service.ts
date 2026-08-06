import type { MessageProviderPort } from '@/application/ports/gateways/message-provider.port';
import type { QueuePort } from '@/application/ports/queue/queue.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { EventRepositoryPort } from '@/application/ports/repositories/event.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { Client } from '@/domain/entities/client';
import type { Invoice } from '@/domain/entities/invoice';
import { generateUUID } from '@/infrastructure/uuid/uuid.service';
import { type Decision, DecisionEngineService } from './decision-engine.service';

export class ReminderService {
  private readonly decisionEngine: DecisionEngineService;
  private readonly invoiceRepo: InvoiceRepositoryPort;
  private readonly clientRepo: ClientRepositoryPort;
  private readonly eventRepo: EventRepositoryPort;
  private readonly queue: QueuePort;
  private readonly messageProvider: MessageProviderPort;

  constructor(
    invoiceRepo: InvoiceRepositoryPort,
    clientRepo: ClientRepositoryPort,
    eventRepo: EventRepositoryPort,
    queue: QueuePort,
    messageProvider: MessageProviderPort,
    decisionEngine?: DecisionEngineService,
  ) {
    this.invoiceRepo = invoiceRepo;
    this.clientRepo = clientRepo;
    this.eventRepo = eventRepo;
    this.queue = queue;
    this.messageProvider = messageProvider;
    this.decisionEngine = decisionEngine ?? new DecisionEngineService();
  }

  async processPendingReminders(tenantId: string): Promise<{ processed: number; decisions: Decision[] }> {
    const today = new Date();
    const pendingInvoices = await this.invoiceRepo.findMany({
      tenantId,
      startDate: today,
      endDate: today,
      status: 'PENDING',
    });
    const decisions: Decision[] = [];

    for (const invoice of pendingInvoices.data) {
      const client = await this.clientRepo.findById(invoice.clientId);
      if (!client) continue;

      // Get decision from engine
      const decision = this.decisionEngine.decideNextAction(client, invoice as unknown as Invoice, 'default');
      decisions.push(decision);

      // Schedule the reminder via Queue
      await this.scheduleReminder(invoice, client, decision);
    }

    return { processed: pendingInvoices.data.length, decisions };
  }

  private async scheduleReminder(invoice: Invoice, client: Client, decision: Decision): Promise<void> {
    const invoiceAmount = Number(invoice.amount).toFixed(2);

    await this.queue.addJob('send-message', {
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
    } as Record<string, unknown>);

    // Log decision
    await this.eventRepo.save({
      eventId: generateUUID(),
      eventType: 'decision.made',
      clientId: client.id,
      tenantId: client.tenantId,
      invoiceId: invoice.id,
      timestamp: new Date().toISOString(),
      metadata: {
        invoiceId: invoice.id,
        decision,
        scheduledAt: decision.scheduledAt.toISOString(),
      },
    });
  }

  async sendReminderNow(invoiceId: string, tenantId: string): Promise<any> {
    // Scope the invoice lookup to the calling tenant — a tenant must never
    // trigger a reminder for another tenant's invoice.
    const invoice = await this.invoiceRepo.findById(invoiceId, tenantId);
    if (!invoice) throw new Error('Invoice not found');

    const client = await this.clientRepo.findById(invoice.clientId);
    if (!client) throw new Error('Client not found');

    const result = await this.messageProvider.sendTemplate({
      to: client.phone,
      text: '',
      tenantId,
      clientId: client.id,
      invoiceId,
      templateName: 'friendly_reminder_d3',
      variables: {
        name: client.name.split(' ')[0],
        value: `R$ ${Number(invoice.amount).toFixed(2)}`,
        dueDate: new Date(invoice.dueDate).toLocaleDateString('pt-BR'),
        pixLink: invoice.pixCopyPaste || 'PIX não disponível',
      },
    });

    return result;
  }
}
