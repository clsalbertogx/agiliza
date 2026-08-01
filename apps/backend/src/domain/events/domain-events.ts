export type DomainEventType = 
  | 'payment.confirmed'
  | 'payment.failed'
  | 'invoice.created'
  | 'subscription.invoice.created'
  | 'invoice.overdue'
  | 'invoice.paid'
  | 'client.created'
  | 'client.risk.updated'
  | 'message.sent'
  | 'message.delivered'
  | 'message.read'
  | 'message.clicked'
  | 'decision.made'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'subscription.expired'
  | 'subscription.renewed'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.updated';

export interface DomainEvent {
  eventId: string;
  eventType: DomainEventType;
  clientId: string;
  tenantId: string;
  invoiceId?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export function createDomainEvent(
  eventType: DomainEventType,
  data: { clientId: string; tenantId: string; invoiceId?: string; metadata?: Record<string, unknown> },
  eventId?: string
): DomainEvent {
  return {
    eventId: eventId || 'pending-' + Date.now(),
    eventType,
    clientId: data.clientId,
    tenantId: data.tenantId,
    invoiceId: data.invoiceId,
    timestamp: new Date().toISOString(),
    metadata: data.metadata ?? {},
  };
}
