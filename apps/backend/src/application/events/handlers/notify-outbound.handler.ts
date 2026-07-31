import { DomainEvent } from '@/domain/events/domain-events';
import { RetryableWebhookHandler } from '@/application/events/handlers/retryable-webhook-handler';
import type { DLQPort } from '@/application/ports/queue/dlq.port';

interface OutboundWebhookPayload {
  eventType: string;
  tenantId: string;
  clientId: string;
  invoiceId?: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export class NotifyOutboundHandler extends RetryableWebhookHandler {
  constructor(
    private readonly webhookUrl?: string,
    private readonly apiKey?: string,
    dlqPort?: DLQPort,
  ) {
    super(dlqPort);
  }

  getEventType(): string {
    // This handler reacts to several event types; the canonical "owned" type
    // is the first one in the notification list.
    return 'client.created';
  }

  async handle(event: DomainEvent): Promise<void> {
    const eventsToNotify: string[] = [
      'client.created',
      'payment.confirmed',
      'invoice.overdue',
      'decision.made',
    ];
    if (!eventsToNotify.includes(event.eventType)) return;
    if (!this.webhookUrl || !this.apiKey) return;

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
  }
}