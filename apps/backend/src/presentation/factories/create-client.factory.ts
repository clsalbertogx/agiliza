import { CreateClientUseCase } from '../../application/usecases/create-client.usecase';
import { PrismaClientRepository } from '../../infrastructure/database/repositories/client.repository';
import { InMemoryEventBus } from '../../infrastructure/event-bus/in-memory-event-bus';

export function createCreateClientUseCase(): CreateClientUseCase {
  const clientRepo = new PrismaClientRepository();
  const eventBus = new InMemoryEventBus();
  return new CreateClientUseCase(clientRepo, eventBus);
}
