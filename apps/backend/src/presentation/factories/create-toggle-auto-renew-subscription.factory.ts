import { ToggleAutoRenewSubscriptionUseCase } from '@/application/usecases/toggle-auto-renew-subscription.usecase';
import { PrismaSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

export function createToggleAutoRenewSubscriptionUseCase(): ToggleAutoRenewSubscriptionUseCase {
  const subscriptionRepo = new PrismaSubscriptionRepository();
  const eventBus = new InMemoryEventBus();
  const idGenerator = new UuidV7Generator();
  return new ToggleAutoRenewSubscriptionUseCase(subscriptionRepo, eventBus, idGenerator);
}
