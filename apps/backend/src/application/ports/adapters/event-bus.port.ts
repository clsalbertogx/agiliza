import type { DomainEvent, DomainEventType } from '@/domain/events/domain-events';

export interface EventBusPort {
  publish(event: DomainEvent): void;
  subscribe(eventType: DomainEventType, handler: (event: DomainEvent) => Promise<void>): void;
}
