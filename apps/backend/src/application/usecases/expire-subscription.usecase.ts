import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Subscription, SubscriptionStatus, expireSubscription } from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface ExpireSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export class ExpireSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: ExpireSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.subscriptionId));
    }

    // 2. Verify status is ACTIVE
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return failure(
        new ApplicationError(
          `Cannot expire subscription with status ${subscription.status}. Only ACTIVE subscriptions can be expired`,
          'INVALID_STATUS',
          409,
        ),
      );
    }

    // 3. Apply domain logic
    const expired = expireSubscription(subscription);

    // 4. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        status: expired.status,
        endDate: expired.endDate,
        updatedAt: expired.updatedAt,
      });
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 5. Publish event
    const event = createDomainEvent(
      'subscription.expired',
      {
        clientId: subscription.clientId,
        tenantId: input.tenantId,
        metadata: {
          subscriptionId: saved.id,
          plan: saved.plan,
          expiredAt: saved.endDate?.toISOString(),
        },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }
}
