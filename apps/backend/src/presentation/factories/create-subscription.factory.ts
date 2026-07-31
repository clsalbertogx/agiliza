import { CreateSubscriptionUseCase } from '@/application/usecases/create-subscription.usecase';
import { PrismaSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

export function createCreateSubscriptionUseCase(): CreateSubscriptionUseCase {
  const subscriptionRepo = new PrismaSubscriptionRepository();
  const clientRepo = new PrismaClientRepository();
  const eventBus = new InMemoryEventBus();
  const idGenerator = new UuidV7Generator();
  return new CreateSubscriptionUseCase(subscriptionRepo, clientRepo, eventBus, idGenerator);
}

export function createSubscriptionRepository(): PrismaSubscriptionRepository {
  return new PrismaSubscriptionRepository();
}
