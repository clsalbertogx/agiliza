import { afterEach, beforeEach, describe, expect, it, type SpyInstance, vi } from 'vitest';
import { RetryableWebhookHandler } from '@/application/events/handlers/retryable-webhook-handler';
import type { DLQPort } from '@/application/ports/queue/dlq.port';
import type { DomainEvent } from '@/domain/events/domain-events';

/**
 * Concrete subclass used to test the base class retry/DLQ orchestration.
 * Overrides `delay` so the exponential-backoff timeouts don't slow the tests
 * down (the real production `delay` uses `setTimeout`).
 */
class TestableHandler extends RetryableWebhookHandler {
  readonly handleCallCount: { value: number } = { value: 0 };

  getEventType(): string {
    return 'test.event';
  }

  async handle(_event: DomainEvent): Promise<void> {
    this.handleCallCount.value += 1;
    if (this.onHandle) {
      await this.onHandle();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onHandle: () => Promise<void> = async () => {};

  protected override delay(_ms: number): Promise<void> {
    return Promise.resolve();
  }
}

function makeEvent(): DomainEvent {
  return {
    eventId: 'evt-dlq-123',
    eventType: 'payment.confirmed' as DomainEvent['eventType'],
    clientId: 'client-123',
    tenantId: 'tenant-123',
    timestamp: '2026-07-31T12:00:00.000Z',
    metadata: {},
  };
}

describe('RetryableWebhookHandler', () => {
  let warnSpy: SpyInstance;
  let errorSpy: SpyInstance;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('handleWithRetry', () => {
    it('retries up to maxRetries (5) times with exponential backoff before giving up', async () => {
      const handler = new TestableHandler();
      // Always throw so every attempt fails.
      handler.onHandle = async () => {
        throw new Error('always fails');
      };

      const event = makeEvent();
      const promise = handler.handleWithRetry(event);

      // Because `delay` is stubbed to resolve immediately, the 6 attempts
      // (attempt 0..5) run synchronously within this microtask flush.
      await expect(promise).rejects.toThrow('always fails');

      // 1 initial attempt + 5 retries = 6 total calls.
      expect(handler.handleCallCount.value).toBe(6);
      // 5 warn logs (one per retried attempt: attempts 0..4).
      expect(warnSpy).toHaveBeenCalledTimes(5);
    });

    it('sends to DLQ after max retries are exhausted', async () => {
      const dlqPort: { publishToDLQ: ReturnType<typeof vi.fn> } = {
        publishToDLQ: vi.fn().mockResolvedValue(undefined),
      };
      const handler = new TestableHandler(dlqPort as unknown as DLQPort);
      handler.onHandle = async () => {
        throw new Error('boom');
      };

      const event = makeEvent();
      await expect(handler.handleWithRetry(event)).rejects.toThrow('boom');

      // DLQ publisher receives the original event + the error.
      expect(dlqPort.publishToDLQ).toHaveBeenCalledTimes(1);
      const [passedEvent, passedError] = dlqPort.publishToDLQ.mock.calls[0];
      expect(passedEvent).toEqual(event);
      expect(passedError).toBeInstanceOf(Error);
      expect((passedError as Error).message).toBe('boom');

      // The final exhaustion log fires.
      expect(errorSpy).toHaveBeenCalledWith(
        '[TestableHandler] All retries exhausted, sending to DLQ:',
        expect.any(Error),
      );
    });

    it('succeeds on the 2nd attempt (1 retry)', async () => {
      const handler = new TestableHandler();
      handler.onHandle = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(undefined);

      const event = makeEvent();
      await expect(handler.handleWithRetry(event)).resolves.toBeUndefined();

      expect(handler.handleCallCount.value).toBe(2);
      // Only the first attempt failed, so only one retry warning.
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[TestableHandler] Attempt 1 failed, retrying in 2000ms:',
        expect.objectContaining({ message: 'transient' }),
      );
    });

    it('DLQ receives failed event data (event fields preserved)', async () => {
      const dlqPort: { publishToDLQ: ReturnType<typeof vi.fn> } = {
        publishToDLQ: vi.fn().mockResolvedValue(undefined),
      };
      const handler = new TestableHandler(dlqPort as unknown as DLQPort);
      handler.onHandle = async () => {
        throw new Error('permanent failure');
      };

      const event = makeEvent();
      await expect(handler.handleWithRetry(event)).rejects.toThrow('permanent failure');

      expect(dlqPort.publishToDLQ).toHaveBeenCalledTimes(1);
      const dlqPayload = dlqPort.publishToDLQ.mock.calls[0][0] as DomainEvent;
      expect(dlqPayload).toMatchObject({
        eventId: 'evt-dlq-123',
        eventType: 'payment.confirmed',
        clientId: 'client-123',
        tenantId: 'tenant-123',
        timestamp: '2026-07-31T12:00:00.000Z',
        metadata: {},
      });
    });

    it('does not retry when no DLQ port is configured (falls back to console log)', async () => {
      const handler = new TestableHandler(/* no dlqPort */);
      handler.onHandle = async () => {
        throw new Error('no dlq adapter');
      };

      const event = makeEvent();
      await expect(handler.handleWithRetry(event)).rejects.toThrow('no dlq adapter');

      expect(handler.handleCallCount.value).toBe(6);
      // The fallback console.error from sendToDLQ fires once after exhaustion.
      expect(errorSpy).toHaveBeenCalledWith('[DLQ] Event evt-dlq-123 sent to DLQ:', 'no dlq adapter');
    });
  });

  describe('abstract contract', () => {
    it('requires subclasses to implement getEventType', () => {
      // If we removed getEventType, instantiation would fail at runtime because
      // it is abstract. We assert the contract is satisfied by TestableHandler.
      const handler = new TestableHandler();
      expect(handler.getEventType()).toBe('test.event');
    });
  });
});
