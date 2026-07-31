import type { DomainEvent } from '@/domain/events/domain-events';

/**
 * Port for publishing events that exhausted all retries into a
 * Dead Letter Queue for later manual inspection.
 *
 * Defined in the Application layer so the retry base class has a seam
 * that the Infrastructure layer can satisfy (e.g. BullMQ).
 */
export interface DLQPort {
  publishToDLQ(event: DomainEvent, error: Error): Promise<void>;
}
