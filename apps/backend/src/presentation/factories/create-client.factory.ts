import { CreateClientUseCase } from '@/application/usecases/create-client.usecase';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { getEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

export function createCreateClientUseCase(): CreateClientUseCase {
  const clientRepo = new PrismaClientRepository();
  const eventBus = getEventBus();
  const idGenerator = new UuidV7Generator();
  return new CreateClientUseCase(clientRepo, eventBus, idGenerator);
}

/** Returns the PrismaClientRepository for use in route-level query operations. */
export function createClientRepository(): PrismaClientRepository {
  return new PrismaClientRepository();
}
