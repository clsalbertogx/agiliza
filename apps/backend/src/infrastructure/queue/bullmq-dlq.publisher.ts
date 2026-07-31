import type { DomainEvent } from '@/domain/events/domain-events';
import type { DLQPort } from '@/application/ports/queue/dlq.port';
import { addFailedWebhookJob } from '@/infrastructure/queue/queue-manager';

/**
 * Concrete DLQPort adapter backed by BullMQ.
 *
 * Sends failed events (after retries are exhausted) to the
 * `failed-webhooks` queue, where a dedicated worker stores them for
 * manual inspection / replay.
 *
 * This is the ONLY place where the retry mechanism touches BullMQ —
 * the Application layer (`RetryableWebhookHandler`) only depends on the
 * abstract `DLQPort`.
 */
export class BullMQDLQPublisher implements DLQPort {
  async publishToDLQ(event: DomainEvent, error: Error): Promise<void> {
    await addFailedWebhookJob({
      event: { ...event },
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      failedAt: new Date().toISOString(),
    });
  }
}
