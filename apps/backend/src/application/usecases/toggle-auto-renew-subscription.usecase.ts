import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Subscription, updateSubscription } from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface ToggleAutoRenewSubscriptionInput {
  subscriptionId: string;
  tenantId: string;
  autoRenew: boolean;
}

export class ToggleAutoRenewSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: ToggleAutoRenewSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Find subscription
    const subscription = await this.subscriptionRepo.findById(input.subscriptionId, input.tenantId);
    if (!subscription) {
      return failure(ApplicationError.notFound('Subscription', input.subscriptionId));
    }

    // 2. Apply domain logic
    const updated = updateSubscription(subscription, {
      autoRenew: input.autoRenew,
      updatedAt: new Date(),
    });

    // 3. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.update(input.subscriptionId, {
        autoRenew: updated.autoRenew,
        updatedAt: updated.updatedAt,
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
          action: 'auto_renew.toggled',
          autoRenew: saved.autoRenew,
        },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }
}
