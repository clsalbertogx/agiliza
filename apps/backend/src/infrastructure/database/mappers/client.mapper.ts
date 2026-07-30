import type { DomainMapper } from './mapper.interface';
import type { Client, PersistenceClient } from '@/domain/entities/client';
import { createClientFromPersistence, clientToPersistence } from '@/domain/entities/client';

export type { PersistenceClient } from '@/domain/entities/client';

export class ClientMapper implements DomainMapper<PersistenceClient, Client> {
  toDomain(persistence: PersistenceClient): Client {
    return createClientFromPersistence(persistence);
  }

  toPersistence(domain: Client): PersistenceClient {
    return clientToPersistence(domain);
  }
}