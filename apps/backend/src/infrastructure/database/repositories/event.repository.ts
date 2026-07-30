import type { EventRepositoryPort } from '@/application/ports/repositories/event.repository.port';
import type { DomainEvent } from '@/domain/events/domain-events';
import { getPrismaClient } from '@/infrastructure/database/prisma.service';

/**
 * Maps a DomainEvent from the domain layer into the Prisma Event shape
 * and persists it via Prisma.
 */
function toDomainEvent(raw: Record<string, unknown>): DomainEvent {
  return {
    eventId: raw.id as string,
    eventType: (raw.eventType as string).toLowerCase().replace(/_/g, '.') as DomainEvent['eventType'],
    clientId: (raw.clientId as string) ?? '',
    tenantId: raw.tenantId as string,
    invoiceId: (raw.payload as Record<string, unknown>)?.invoiceId as string | undefined,
    timestamp: (raw.createdAt as Date).toISOString(),
    metadata: (raw.payload as Record<string, unknown>) ?? {},
  };
}

function toPrismaEvent(event: DomainEvent): {
  id: string;
  tenantId: string;
  clientId: string | null;
  eventType: string;
  payload: unknown;
  source: string | null;
} {
  const prismaEventType = event.eventType.toUpperCase().replace(/\./g, '_');
  return {
    id: event.eventId,
    tenantId: event.tenantId,
    clientId: event.clientId || null,
    eventType: prismaEventType as string,
    payload: {
      ...event.metadata,
      ...(event.invoiceId ? { invoiceId: event.invoiceId } : {}),
    },
    source: 'application-service',
  };
}

/**
 * Port-compliant Prisma event repository.
 * Implements EventRepositoryPort for use with use cases / services.
 */
export class PrismaEventRepository implements EventRepositoryPort {
  private prisma = getPrismaClient();

  async save(event: DomainEvent): Promise<void> {
    const prismaData = toPrismaEvent(event);
    await this.prisma.event.create({ data: prismaData as any });
  }

  async findByTenantId(tenantId: string): Promise<DomainEvent[]> {
    const results = await this.prisma.event.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return results.map((r) => toDomainEvent(r as unknown as Record<string, unknown>));
  }

  // ── Route query helpers ──────────────────────────────────────────
  // These methods provide raw Prisma query patterns used by route handlers.

  async findByIdRaw(id: string): Promise<Record<string, unknown> | null> {
    return this.prisma.event.findUnique({ where: { id } }) as Promise<Record<string, unknown> | null>;
  }

  async findManyRaw(params: {
    where?: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, unknown>;
  }): Promise<Record<string, unknown>[]> {
    return this.prisma.event.findMany(params) as Promise<Record<string, unknown>[]>;
  }

  async countRaw(where?: Record<string, unknown>): Promise<number> {
    return this.prisma.event.count({ where });
  }

  async logEventRaw(data: {
    tenantId: string;
    clientId?: string;
    eventType: string;
    payload: unknown;
    source?: string;
  }): Promise<Record<string, unknown>> {
    return this.prisma.event.create({
      data: {
        tenantId: data.tenantId,
        clientId: data.clientId,
        eventType: data.eventType as any,
        payload: data.payload as any,
        source: data.source,
      },
    }) as Promise<Record<string, unknown>>;
  }

  async getEventsByTypeRaw(tenantId: string, eventType: string, limit = 100): Promise<Record<string, unknown>[]> {
    return this.prisma.event.findMany({
      where: { tenantId, eventType: eventType as any },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as Promise<Record<string, unknown>[]>;
  }
}
