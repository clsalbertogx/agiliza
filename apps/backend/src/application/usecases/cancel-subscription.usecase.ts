import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Subscription, cancelSubscription } from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface CancelSubscriptionInput {
  id: string;
  tenantId: string;
}

export class CancelSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: CancelSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.id, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.id));
    }

    // 2. Verify belongs to tenant (already done via findById with tenantId)

    // 3. Check if already cancelled
    if (subscription.status === 'CANCELLED') {
      return failure(new ApplicationError('Subscription is already cancelled', 'CONFLICT', 409));
    }

    // 4. Cancel subscription domain logic
    const cancelled = cancelSubscription(subscription);

    // 5. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.cancel(input.id, input.tenantId);
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 6. Publish event
    const event = createDomainEvent('subscription.cancelled', {
      clientId: subscription.clientId,
      tenantId: input.tenantId,
      metadata: {
        subscriptionId: saved.id,
        plan: saved.plan,
        cancelledAt: saved.cancelledAt?.toISOString(),
      },
    }, this.idGenerator.generate());
    this.eventBus.publish(event);

    return success(saved);
  }
}
