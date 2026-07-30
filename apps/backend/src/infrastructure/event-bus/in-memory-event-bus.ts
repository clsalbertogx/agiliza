import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { DomainEvent, DomainEventType } from '@/domain/events/domain-events';

export class InMemoryEventBus implements EventBusPort {
  private handlers: Map<DomainEventType, Array<(event: DomainEvent) => Promise<void>>> = new Map();

  publish(event: DomainEvent): void {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers) return;
    handlers.forEach(h => { h(event); });
  }

  subscribe(eventType: DomainEventType, handler: (event: DomainEvent) => Promise<void>): void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }
}
