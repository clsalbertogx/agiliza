import type { DomainEvent } from '@/domain/events/domain-events';

export interface EventRepositoryPort {
  save(event: DomainEvent): Promise<void>;
  findByTenantId(tenantId: string): Promise<DomainEvent[]>;
}
