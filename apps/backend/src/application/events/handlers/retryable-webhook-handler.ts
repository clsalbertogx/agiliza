import type { DLQPort } from '@/application/ports/queue/dlq.port';
import type { DomainEvent } from '@/domain/events/domain-events';

/**
 * Base class for domain event handlers that need retry-with-backoff
 * semantics and dead-letter-queue fallback.
 *
 * Subclasses implement:
 *  - `getEventType()`: the domain event type this handler cares about.
 *  - `handle(event)`: the actual business work. It MUST throw on transient
 *    failures so the retry loop can kick in; business "failures" that should
 *    NOT be retried (e.g. a declined payment) must be handled internally and
 *    NOT re-thrown.
 *
 * The retry/backoff is orchestrated by `handleWithRetry`, which subscribers
 * should use (see `register-event-handlers.ts`) instead of calling `handle`
 * directly.
 *
 * Clean Architecture: this base class lives in Application and depends only on
 * the `DLQPort` abstraction — never on BullMQ or any concrete queue.
 */
export abstract class RetryableWebhookHandler {
  protected readonly maxRetries = 5;
  protected readonly baseDelayMs = 2000; // 2 seconds

  constructor(protected readonly dlqPort?: DLQPort) {}

  abstract getEventType(): string;
  abstract handle(event: DomainEvent): Promise<void>;

  async handleWithRetry(event: DomainEvent, attempt = 0): Promise<void> {
    try {
      await this.handle(event);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (attempt < this.maxRetries) {
        const delay = this.baseDelayMs * 2 ** attempt; // 2s, 4s, 8s, 16s, 32s
        console.warn(`[${this.constructor.name}] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err);
        await this.delay(delay);
        await this.handleWithRetry(event, attempt + 1);
      } else {
        console.error(`[${this.constructor.name}] All retries exhausted, sending to DLQ:`, err);
        await this.sendToDLQ(event, err);
        throw err; // re-throw to trigger BullMQ retry/DLQ
      }
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sendToDLQ(event: DomainEvent, error: Error): Promise<void> {
    if (this.dlqPort) {
      await this.dlqPort.publishToDLQ(event, error);
    } else {
      // Fallback when no DLQ adapter is wired (e.g. unit tests).
      console.error(`[DLQ] Event ${event.eventId} sent to DLQ:`, error.message);
    }
  }
}
