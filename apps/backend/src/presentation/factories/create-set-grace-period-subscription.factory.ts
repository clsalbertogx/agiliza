import { SetGracePeriodSubscriptionUseCase } from '@/application/usecases/set-grace-period-subscription.usecase';
import { PrismaSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository';
import { getEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

export function createSetGracePeriodSubscriptionUseCase(): SetGracePeriodSubscriptionUseCase {
  const subscriptionRepo = new PrismaSubscriptionRepository();
  const eventBus = getEventBus();
  const idGenerator = new UuidV7Generator();
  return new SetGracePeriodSubscriptionUseCase(subscriptionRepo, eventBus, idGenerator);
}
