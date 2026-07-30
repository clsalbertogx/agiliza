import { ListClientsUseCase } from '@/application/usecases/list-clients.usecase';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';

export function createListClientsUseCase(): ListClientsUseCase {
  const clientRepo = new PrismaClientRepository();
  return new ListClientsUseCase(clientRepo);
}
