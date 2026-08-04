import { ApplicationError } from '@/application/errors/application.error';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { type Either, failure, success } from '@/application/types/either';
import type { Client } from '@/domain/entities/client';

export interface GetClientInput {
  id: string;
  tenantId: string;
}

export class GetClientUseCase {
  constructor(private readonly clientRepo: ClientRepositoryPort) {}

  async execute(input: GetClientInput): Promise<Either<ApplicationError, Client>> {
    const client = await this.clientRepo.findById(input.id, input.tenantId);
    if (!client) {
      return failure(new ApplicationError('Client not found', 'NOT_FOUND', 404));
    }
    return success(client);
  }
}
