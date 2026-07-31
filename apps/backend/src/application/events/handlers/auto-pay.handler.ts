import { DomainEvent } from '@/domain/events/domain-events';
import { ProcessPaymentUseCase } from '@/application/usecases/process-payment.usecase';
import { RenewSubscriptionUseCase } from '@/application/usecases/renew-subscription.usecase';

export class AutoPayHandler {
  constructor(
    private readonly processPayment: ProcessPaymentUseCase,
    private readonly renewSubscription: RenewSubscriptionUseCase,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.eventType !== 'subscription.invoice.created') return;
    if (!event.invoiceId || !event.metadata?.subscriptionId) return;

    try {
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
        console.warn(`[AutoPay] Invoice ${event.invoiceId} auto-pay failed: ${paymentResult.value.message}`);
      }
    } catch (error) {
      console.error(`[AutoPay] Error processing invoice ${event.invoiceId}:`, error);
    }
  }
}
