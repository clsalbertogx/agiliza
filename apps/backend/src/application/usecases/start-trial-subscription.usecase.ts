import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Subscription, startTrial } from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface StartTrialSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
  trialDays: number;
}

export class StartTrialSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: StartTrialSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.subscriptionId));
    }

    // 2. Apply domain logic
    let trialSubscription: Subscription;
    try {
      trialSubscription = startTrial(subscription, input.trialDays);
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INVALID_TRIAL', 400));
    }

    // 3. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        status: trialSubscription.status,
        trialDays: trialSubscription.trialDays,
        trialEndsAt: trialSubscription.trialEndsAt,
        updatedAt: trialSubscription.updatedAt,
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
          action: 'trial.started',
          trialDays: saved.trialDays,
          trialEndsAt: saved.trialEndsAt?.toISOString(),
        },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }
}
