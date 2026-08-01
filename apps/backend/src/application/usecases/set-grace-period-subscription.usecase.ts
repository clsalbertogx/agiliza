import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Subscription, enterGracePeriod } from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface SetGracePeriodSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
  days: number;
}

export class SetGracePeriodSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: SetGracePeriodSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.subscriptionId));
    }

    // 2. Apply domain logic
    let graceSubscription: Subscription;
    try {
      graceSubscription = enterGracePeriod(subscription, input.days);
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INVALID_GRACE_PERIOD', 400));
    }

    // 3. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        status: graceSubscription.status,
        gracePeriodDays: graceSubscription.gracePeriodDays,
        gracePeriodEndsAt: graceSubscription.gracePeriodEndsAt,
        updatedAt: graceSubscription.updatedAt,
      });
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 4. Publish event
    const event = createDomainEvent(
      'subscription.updated',
      {
        clientId: subscription.clientId,
        tenantId: input.tenantId,
        metadata: {
          subscriptionId: saved.id,
          action: 'grace_period.set',
          gracePeriodDays: saved.gracePeriodDays,
          gracePeriodEndsAt: saved.gracePeriodEndsAt?.toISOString(),
        },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }
}
