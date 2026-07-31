import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Subscription, SubscriptionStatus, resumeSubscription } from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface ResumeSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
}

export class ResumeSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: ResumeSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.subscriptionId));
    }

    // 2. Verify status is PAUSED
    if (subscription.status !== SubscriptionStatus.PAUSED) {
      return failure(
        new ApplicationError(
          `Cannot resume subscription with status ${subscription.status}. Only PAUSED subscriptions can be resumed`,
          'INVALID_STATUS',
          409,
        ),
      );
    }

    // 3. Apply domain logic
    const resumed = resumeSubscription(subscription);

    // 4. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        status: resumed.status,
        updatedAt: resumed.updatedAt,
      });
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 5. Publish event
    const event = createDomainEvent(
      'subscription.resumed',
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
