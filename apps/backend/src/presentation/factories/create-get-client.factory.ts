import { GetClientUseCase } from '@/application/usecases/get-client.usecase';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';

export function createGetClientUseCase(): GetClientUseCase {
  const clientRepo = new PrismaClientRepository();
  return new GetClientUseCase(clientRepo);
}
