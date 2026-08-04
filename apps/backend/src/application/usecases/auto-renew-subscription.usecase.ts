import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { type Either, failure, success } from '@/application/types/either';
import { createInvoice, type Invoice } from '@/domain/entities/invoice';
import { type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { calculateNextBilling } from '@/domain/services/billing-cycle.service';
import { GracePeriodService } from '@/domain/services/grace-period.service';

export interface AutoRenewSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export class AutoRenewSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: AutoRenewSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.subscriptionId));
    }

    // 2. Check if auto-renew is enabled
    if (subscription.autoRenew === false) {
      return failure(new ApplicationError('Auto-renew is disabled for this subscription', 'AUTO_RENEW_DISABLED', 409));
    }

    // 3. Check if still in trial — do not charge during trial
    if (GracePeriodService.hasActiveTrial(subscription)) {
      return failure(new ApplicationError('Subscription is still in trial period', 'TRIAL_ACTIVE', 409));
    }

    // 4. Check if in grace period — allow renewal without service interruption
    const inGracePeriod = GracePeriodService.isInGracePeriod(subscription);

    // 5. Verify subscription is in a renewable state
    if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.GRACE_PERIOD) {
      return failure(
        new ApplicationError(
          `Cannot auto-renew subscription with status ${subscription.status}`,
          'INVALID_STATUS',
          409,
        ),
      );
    }

    // 6. Calculate next billing date
    const nextBilling = calculateNextBilling(subscription.nextBilling, subscription.billingCycle);

    // 7. Create renewal invoice
    const invoiceResult = await this.createRenewalInvoice(subscription, inGracePeriod);
    if (!invoiceResult.success) {
      return failure(invoiceResult.value);
    }

    // 8. Update subscription — if was in grace period, clear grace period data
    const updated =
      subscription.status === SubscriptionStatus.GRACE_PERIOD
        ? {
            ...subscription,
            status: SubscriptionStatus.ACTIVE,
            nextBilling,
            gracePeriodEndsAt: undefined,
            gracePeriodDays: undefined,
            updatedAt: new Date(),
          }
        : {
            ...subscription,
            nextBilling,
            updatedAt: new Date(),
          };

    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        status: updated.status,
        nextBilling: updated.nextBilling,
        gracePeriodEndsAt: updated.gracePeriodEndsAt,
        gracePeriodDays: updated.gracePeriodDays,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 9. Publish event
    const event = createDomainEvent(
      'subscription.renewed',
      {
        clientId: subscription.clientId,
        tenantId: input.tenantId,
        invoiceId: invoiceResult.value.id,
        metadata: {
          subscriptionId: saved.id,
          plan: saved.plan,
          inGracePeriod,
          invoiceId: invoiceResult.value.id,
          previousNextBilling: subscription.nextBilling.toISOString(),
          newNextBilling: nextBilling.toISOString(),
        },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }

  private async createRenewalInvoice(
    subscription: Subscription,
    inGracePeriod: boolean,
  ): Promise<Either<ApplicationError, Invoice>> {
    const invoiceId = this.idGenerator.generate();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7 days payment terms

    const invoiceResult = createInvoice({
      id: invoiceId,
      tenantId: subscription.tenantId,
      clientId: subscription.clientId,
      amount: subscription.amount,
      dueDate,
      description: inGracePeriod
        ? `Renewal invoice for ${subscription.plan} subscription (late renewal)`
        : `Renewal invoice for ${subscription.plan} subscription`,
    });

    if (!invoiceResult.success) {
      return failure(new ApplicationError(invoiceResult.value.message, 'INVALID_INVOICE', 400));
    }

    // Set subscriptionId on the invoice
    const invoiceWithSub = {
      ...invoiceResult.value,
      subscriptionId: subscription.id,
    };

    try {
      return success(await this.invoiceRepo.create(invoiceWithSub));
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }
  }
}
