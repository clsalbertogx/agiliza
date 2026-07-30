import { DomainEvent } from '@/domain/events/domain-events';

interface OutboundWebhookPayload {
  eventType: string;
  tenantId: string;
  clientId: string;
  invoiceId?: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export class NotifyOutboundHandler {
  constructor(
    private readonly webhookUrl?: string,
    private readonly apiKey?: string
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const eventsToNotify: string[] = [
      'client.created',
      'payment.confirmed',
      'invoice.overdue',
      'decision.made',
    ];
    if (!eventsToNotify.includes(event.eventType)) return;
    if (!this.webhookUrl || !this.apiKey) return;

    try {
      const body: OutboundWebhookPayload = {
        eventType: event.eventType,
        tenantId: event.tenantId,
        clientId: event.clientId,
        invoiceId: event.invoiceId,
        metadata: event.metadata,
        timestamp: event.timestamp,
      };

      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error('[NotifyOutboundHandler] Error:', error);
    }
  }
}
