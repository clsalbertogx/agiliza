import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { type Either, failure, success } from '@/application/types/either';
import { pauseSubscription, type Subscription, SubscriptionStatus } from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

export interface PauseSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export class PauseSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: PauseSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.subscriptionId));
    }

    // 2. Verify status is ACTIVE
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return failure(
        new ApplicationError(
          `Cannot pause subscription with status ${subscription.status}. Only ACTIVE subscriptions can be paused`,
          'INVALID_STATUS',
          409,
        ),
      );
    }

    // 3. Apply domain logic
    const paused = pauseSubscription(subscription);

    // 4. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        status: paused.status,
        updatedAt: paused.updatedAt,
      });
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 5. Publish event
    const event = createDomainEvent(
      'subscription.paused',
      {
        clientId: subscription.clientId,
        tenantId: input.tenantId,
        metadata: {
          subscriptionId: saved.id,
          plan: saved.plan,
        },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }
}
