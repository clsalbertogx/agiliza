import type { DomainMapper } from './mapper.interface';

/**
 * Domain-level event log entry.
 * This is a projection of the Prisma Event model into a domain-friendly shape.
 */
export interface DomainEventLog {
  id: string;
  tenantId: string;
  clientId: string | null;
  eventType: string;
  payload: unknown;
  source: string | null;
  createdAt: Date;
}

/**
 * Raw persistence shape as returned by Prisma for the Event model.
 * `eventType` is stored as the Prisma `EventType` enum but we treat it as a string.
 */
export interface PersistenceEvent {
  id: string;
  tenantId: string;
  clientId: string | null;
  eventType: string;
  payload: unknown;
  source: string | null;
  createdAt: Date;
}

export class EventMapper implements DomainMapper<PersistenceEvent, DomainEventLog> {
  toDomain(persistence: PersistenceEvent): DomainEventLog {
    return {
      id: persistence.id,
      tenantId: persistence.tenantId,
      clientId: persistence.clientId,
      eventType: persistence.eventType,
      payload: persistence.payload,
      source: persistence.source,
      createdAt: persistence.createdAt,
    };
  }

  toPersistence(domain: DomainEventLog): PersistenceEvent {
    return {
      id: domain.id,
      tenantId: domain.tenantId,
      clientId: domain.clientId,
      eventType: domain.eventType,
      payload: domain.payload,
      source: domain.source,
      createdAt: domain.createdAt,
    };
  }
}
