import { BaseRepository } from './base.repository';

export class EventRepository extends BaseRepository<any> {
  constructor() {
    super();
  }

  protected get model() {
    return this.prisma.event;
  }

  async logEvent(data: {
    tenantId: string;
    clientId?: string;
    eventType: string;
    payload: any;
    source?: string;
  }) {
    return this.prisma.event.create({
      data: {
        tenantId: data.tenantId,
        clientId: data.clientId,
        eventType: data.eventType as any,
        payload: data.payload,
        source: data.source,
      },
    });
  }

  async getEventsByType(tenantId: string, eventType: string, limit = 100) {
    return this.prisma.event.findMany({
      where: { tenantId, eventType: eventType as any },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
