import { DomainEvent } from '@/domain/events/domain-events';
import { RetryableWebhookHandler } from '@/application/events/handlers/retryable-webhook-handler';
import { ProcessPaymentUseCase } from '@/application/usecases/process-payment.usecase';
import { RenewSubscriptionUseCase } from '@/application/usecases/renew-subscription.usecase';
import type { DLQPort } from '@/application/ports/queue/dlq.port';

export class AutoPayHandler extends RetryableWebhookHandler {
  constructor(
    private readonly processPayment: ProcessPaymentUseCase,
    private readonly renewSubscription: RenewSubscriptionUseCase,
    dlqPort?: DLQPort,
  ) {
    super(dlqPort);
  }

  getEventType(): string {
    return 'subscription.invoice.created';
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType !== 'subscription.invoice.created') return;
    if (!event.invoiceId || !event.metadata?.subscriptionId) return;

    // Attempt auto-payment
    const paymentResult = await this.processPayment.execute({
      invoiceId: event.invoiceId,
      tenantId: event.tenantId,
    });

    if (paymentResult.success) {
      console.log(`[AutoPay] Invoice ${event.invoiceId} auto-paid successfully`);

      // Renew the subscription for the next cycle
      await this.renewSubscription.execute({
        subscriptionId: event.metadata.subscriptionId as string,
        tenantId: event.tenantId,
      });
    } else {
      // Payment failed — log but don't block. Invoice remains PENDING for manual payment.
      // This is a business-level "failure" (not a transient/system error), so it is
      // NOT re-thrown and therefore NOT retried.
      console.warn(`[AutoPay] Invoice ${event.invoiceId} auto-pay failed: ${paymentResult.value.message}`);
    }
  }
}