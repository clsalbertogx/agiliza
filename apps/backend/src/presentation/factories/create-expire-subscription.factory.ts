import { ExpireSubscriptionUseCase } from '@/application/usecases/expire-subscription.usecase';
import { PrismaSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository';
import { getEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

export function createExpireSubscriptionUseCase(): ExpireSubscriptionUseCase {
  const subscriptionRepo = new PrismaSubscriptionRepository();
  const eventBus = getEventBus();
  const idGenerator = new UuidV7Generator();
  return new ExpireSubscriptionUseCase(subscriptionRepo, eventBus, idGenerator);
}
