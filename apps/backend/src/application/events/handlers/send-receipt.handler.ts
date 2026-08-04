import { RetryableWebhookHandler } from '@/application/events/handlers/retryable-webhook-handler';
import type { MessageProviderPort } from '@/application/ports/gateways/message-provider.port';
import type { DLQPort } from '@/application/ports/queue/dlq.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { DomainEvent } from '@/domain/events/domain-events';

export class SendReceiptHandler extends RetryableWebhookHandler {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
    private readonly messageProvider: MessageProviderPort,
    dlqPort?: DLQPort,
  ) {
    super(dlqPort);
  }

  getEventType(): string {
    return 'payment.confirmed';
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType !== 'payment.confirmed') return;
    if (!event.invoiceId) return;

    const invoice = await this.invoiceRepo.findById(event.invoiceId);
    if (!invoice) return;
    const client = await this.clientRepo.findById(event.clientId);
    if (!client) return;

    await this.messageProvider.sendTemplate({
      to: client.phone,
      text: '',
      tenantId: event.tenantId,
      clientId: client.id,
      invoiceId: invoice.id,
      templateName: 'payment_receipt',
      variables: {
        clientName: client.name,
        invoiceAmount: String(invoice.amount),
        invoiceDueDate: invoice.dueDate.toISOString().split('T')[0],
        invoiceId: invoice.id,
      },
    });
  }
}
