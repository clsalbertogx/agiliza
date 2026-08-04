import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { type Either, failure, success } from '@/application/types/either';
import {
  hasActiveTrial,
  isInGracePeriod,
  renewSubscription,
  type Subscription,
  SubscriptionStatus,
} from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { calculateNextBilling } from '@/domain/services/billing-cycle.service';

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

    // 2. Check if still in trial — cannot renew while in trial
    if (hasActiveTrial(subscription)) {
      return failure(
        new ApplicationError('Subscription is still in trial period and cannot be renewed', 'INVALID_STATUS', 409),
      );
    }

    // 3. Verify status is ACTIVE, EXPIRED, or GRACE_PERIOD
    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.EXPIRED &&
      subscription.status !== SubscriptionStatus.GRACE_PERIOD
    ) {
      return failure(
        new ApplicationError(
          `Cannot renew subscription with status ${subscription.status}. Only ACTIVE, EXPIRED, or GRACE_PERIOD subscriptions can be renewed`,
          'INVALID_STATUS',
          409,
        ),
      );
    }

    // 4. If expired and not in grace period, require manual intervention
    const inGracePeriod = isInGracePeriod(subscription);
    const hadGracePeriod = (subscription.gracePeriodDays ?? 0) > 0;
    if (subscription.status === SubscriptionStatus.EXPIRED && !inGracePeriod && hadGracePeriod) {
      return failure(
        new ApplicationError(
          'Subscription has expired beyond the grace period and requires manual intervention',
          'GRACE_PERIOD_EXPIRED',
          409,
        ),
      );
    }

    // 5. Calculate next billing date
    const nextBilling = calculateNextBilling(subscription.nextBilling, subscription.billingCycle);

    // 6. Apply domain logic — reset ACTIVE and update billing
    const updated = renewSubscription(
      subscription,
      nextBilling,
      subscription.status === SubscriptionStatus.EXPIRED ? undefined : subscription.endDate,
    );

    // 7. Persist
    let saved: Subscription;
    try {
      const wasInGracePeriod = subscription.status === SubscriptionStatus.GRACE_PERIOD || inGracePeriod;
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        status: updated.status,
        nextBilling: updated.nextBilling,
        endDate: updated.endDate,
        ...(wasInGracePeriod ? { gracePeriodEndsAt: undefined, gracePeriodDays: undefined } : {}),
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 8. Publish event
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
          wasInGracePeriod: subscription.status === SubscriptionStatus.GRACE_PERIOD,
        },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }
}
