import { ResumeSubscriptionUseCase } from '@/application/usecases/resume-subscription.usecase';
import { PrismaSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

export function createResumeSubscriptionUseCase(): ResumeSubscriptionUseCase {
  const subscriptionRepo = new PrismaSubscriptionRepository();
  const eventBus = new InMemoryEventBus();
  const idGenerator = new UuidV7Generator();
  return new ResumeSubscriptionUseCase(subscriptionRepo, eventBus, idGenerator);
}
