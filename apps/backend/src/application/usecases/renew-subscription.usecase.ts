import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Subscription, SubscriptionStatus, renewSubscription } from '@/domain/entities/subscription';
import { calculateNextBilling } from '@/domain/services/billing-cycle.service';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface RenewSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export class RenewSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: RenewSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.subscriptionId));
    }

    // 2. Verify status is ACTIVE or EXPIRED
    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.EXPIRED
    ) {
      return failure(
        new ApplicationError(
          `Cannot renew subscription with status ${subscription.status}. Only ACTIVE or EXPIRED subscriptions can be renewed`,
          'INVALID_STATUS',
          409,
        ),
      );
    }

    // 3. Calculate next billing date
    const nextBilling = calculateNextBilling(
      subscription.nextBilling,
      subscription.billingCycle,
    );

    // 4. If expired, clear endDate
    const newEndDate = subscription.status === SubscriptionStatus.EXPIRED
      ? undefined
      : undefined; // Keep existing endDate if any

    // 5. Apply domain logic — reset ACTIVE and update billing
    const updated = renewSubscription(
      subscription,
      nextBilling,
      subscription.status === SubscriptionStatus.EXPIRED ? undefined : subscription.endDate,
    );

    // 6. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        status: updated.status,
        nextBilling: updated.nextBilling,
        endDate: updated.endDate,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 7. Publish event
    const event = createDomainEvent(
      'subscription.renewed',
      {
        clientId: subscription.clientId,
        tenantId: input.tenantId,
        metadata: {
          subscriptionId: saved.id,
          plan: saved.plan,
          previousNextBilling: subscription.nextBilling.toISOString(),
          newNextBilling: nextBilling.toISOString(),
        },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }
}
