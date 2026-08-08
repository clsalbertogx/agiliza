import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { logger } from '@/config/logger';
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
              logger.error({ err: error }, 'Event handler failed');
            });
          }
        } catch (error: unknown) {
          logger.error({ err: error }, 'Event handler failed');
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

// Module-level singleton getter — ensures all factories and the composition root
// share the SAME event bus instance so published events reach subscribed handlers.
let _sharedBus: InMemoryEventBus | null = null;

export function getEventBus(): InMemoryEventBus {
  if (!_sharedBus) _sharedBus = new InMemoryEventBus();
  return _sharedBus;
}

export function resetEventBus(): void {
  _sharedBus = null;
}
