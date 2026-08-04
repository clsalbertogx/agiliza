import { GetSubscriptionAnalyticsUseCase } from '@/application/usecases/get-subscription-analytics.usecase';
import { PrismaSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository';

export function createGetSubscriptionAnalyticsUseCase(): GetSubscriptionAnalyticsUseCase {
  const subscriptionRepo = new PrismaSubscriptionRepository();
  return new GetSubscriptionAnalyticsUseCase(subscriptionRepo);
}