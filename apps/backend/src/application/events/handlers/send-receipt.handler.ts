import { DomainEvent } from '@/domain/events/domain-events';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { MessageProviderPort } from '@/application/ports/gateways/message-provider.port';

export class SendReceiptHandler {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
    private readonly messageProvider: MessageProviderPort
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType !== 'payment.confirmed') return;
    if (!event.invoiceId) return;

    try {
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
    } catch (error) {
      console.error('[SendReceiptHandler] Error:', error);
    }
  }
}
