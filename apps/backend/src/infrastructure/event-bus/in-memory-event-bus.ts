import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { DomainEvent, DomainEventType } from '@/domain/events/domain-events';

export class InMemoryEventBus implements EventBusPort {
  private handlers: Map<DomainEventType, Array<(event: DomainEvent) => Promise<void>>> = new Map();

  publish(event: DomainEvent): void {
    const handlers = this.handlers.get(event.eventType) || [];
    for (const handler of handlers) {
      queueMicrotask(() => {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch((error: unknown) => {
              console.error(error instanceof Error ? error.message : String(error), error);
            });
          }
        } catch (error: unknown) {
          console.error(error instanceof Error ? error.message : String(error), error);
        }
      });
    }
  }

  subscribe(eventType: DomainEventType, handler: (event: DomainEvent) => Promise<void>): void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }
}
