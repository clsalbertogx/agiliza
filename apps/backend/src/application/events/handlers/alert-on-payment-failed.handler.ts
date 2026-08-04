import type { AlertService } from '@/application/services/alert.service';
import type { DomainEvent } from '@/domain/events/domain-events';

export class AlertOnPaymentFailedHandler {
  constructor(private readonly alertService: AlertService) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType !== 'payment.failed') return;
    await this.alertService.alertPaymentFailed({
      invoiceId: event.invoiceId,
      tenantId: event.tenantId,
      clientId: event.clientId,
      reason: event.metadata?.reason,
    });
  }
}
