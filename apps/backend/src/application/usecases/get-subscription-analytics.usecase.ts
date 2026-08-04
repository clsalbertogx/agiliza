import { ApplicationError } from '@/application/errors/application.error';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import { type Either, failure, success } from '@/application/types/either';
import type { Subscription } from '@/domain/entities/subscription';
import {
  type SubscriptionAnalytics,
  SubscriptionAnalyticsService,
} from '@/domain/services/subscription-analytics.service';

export interface GetSubscriptionAnalyticsInput {
  tenantId: string;
  from?: Date;
  to?: Date;
}

export class GetSubscriptionAnalyticsUseCase {
  constructor(private readonly subscriptionRepo: SubscriptionRepositoryPort) {}

  async execute(input: GetSubscriptionAnalyticsInput): Promise<Either<ApplicationError, SubscriptionAnalytics>> {
    if (!input.tenantId) {
      return failure(ApplicationError.validation('tenantId is required'));
    }

    const now = new Date();
    const from = input.from ?? new Date(now.getFullYear(), now.getMonth(), 1); // start of month
    const to = input.to ?? now;

    let subscriptions: Subscription[];
    try {
      subscriptions = await this.subscriptionRepo.getSubscriptionsForAnalytics(input.tenantId, from, to);
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    return success(SubscriptionAnalyticsService.calculate(subscriptions, from, to));
  }
}
