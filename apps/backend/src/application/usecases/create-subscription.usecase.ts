import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Subscription, createSubscription, BillingCycle } from '@/domain/entities/subscription';
import { createDomainEvent } from '@/domain/events/domain-events';

export interface CreateSubscriptionInput {
  tenantId: string;
  clientId: string;
  plan: string;
  amount: number;
  billingCycle: BillingCycle;
  trialDays?: number;
  gracePeriodDays?: number;
  autoRenew?: boolean;
}

export class CreateSubscriptionUseCase {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<Either<ApplicationError, Subscription>> {
    // 1. Validate client exists
    const client = await this.clientRepo.findById(input.clientId, input.tenantId);
    if (!client) {
      return failure(ApplicationError.notFound('Client', input.clientId));
    }

    // 2. Calculate dates
    const now = new Date();
    const nextBilling = this.calculateNextBilling(input.billingCycle, now);

    // 3. Create Subscription entity
    const subscriptionResult = createSubscription({
      id: this.idGenerator.generate(),
      tenantId: input.tenantId,
      clientId: input.clientId,
      plan: input.plan,
      amount: input.amount,
      billingCycle: input.billingCycle,
      trialDays: input.trialDays,
      gracePeriodDays: input.gracePeriodDays,
      autoRenew: input.autoRenew,
      nextBilling,
      startDate: now,
    });

    if (!subscriptionResult.success) {
      return failure(new ApplicationError(subscriptionResult.value.message, 'INVALID_SUBSCRIPTION', 400));
    }

    // 4. Persist
    let saved: Subscription;
    try {
      saved = await this.subscriptionRepo.create(subscriptionResult.value);
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 5. Publish event
    const event = createDomainEvent('subscription.created', {
      clientId: input.clientId,
      tenantId: input.tenantId,
      metadata: {
        subscriptionId: saved.id,
        plan: saved.plan,
        amount: saved.amount,
        billingCycle: saved.billingCycle,
      },
    }, this.idGenerator.generate());
    this.eventBus.publish(event);

    return success(saved);
  }

  private calculateNextBilling(billingCycle: BillingCycle, fromDate: Date): Date {
    const date = new Date(fromDate);
    switch (billingCycle) {
      case BillingCycle.MONTHLY:
        date.setMonth(date.getMonth() + 1);
        break;
      case BillingCycle.BIMONTHLY:
        date.setMonth(date.getMonth() + 2);
        break;
      case BillingCycle.QUARTERLY:
        date.setMonth(date.getMonth() + 3);
        break;
      case BillingCycle.SEMIANNUAL:
        date.setMonth(date.getMonth() + 6);
        break;
      case BillingCycle.ANNUAL:
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date;
  }
}
