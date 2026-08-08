import { Worker } from 'bullmq';
import type { AlertService } from '@/application/services/alert.service';
import { logger } from '@/config/logger';
import { QueueNames } from './queue-definitions';
import { getRedis } from './redis.service';

/**
 * Start a BullMQ worker that drains the dead-letter queue.
 *
 * Failed-webhook notifications are intentionally NOT retried — the
 * retry/backoff is handled in-process by `RetryableWebhookHandler` before
 * a job ever reaches this queue. Once here, the only sensible action is
 * to log it loudly so an operator can inspect / replay it, and to alert
 * on-call via the alert service.
 *
 * In a future iteration this worker can persist payloads to a database
 * table for a manual-review UI.
 */
export function startDeadLetterWorker(alertService?: AlertService): Worker {
  const worker = new Worker(
    QueueNames.FAILED_WEBHOOKS,
    async (job) => {
      logger.error({ data: job.data }, '[DLQ] Failed webhook:');

      await alertService?.alertWebhookDrained({
        eventId: job.id,
        ...(typeof job.data === 'object' && job.data !== null ? job.data : {}),
      }); // TODO: persist to a database table for manual review UI
    },
    { connection: getRedis() },
  );

  worker.on('completed', (job) => {
    logger.info('[Worker:%s] Job %s completed', QueueNames.FAILED_WEBHOOKS, job.id);
  });

  worker.on('failed', (job, err) => {
    logger.error({ err }, '[Worker:%s] Job %s failed:', QueueNames.FAILED_WEBHOOKS, job?.id);
  });

  worker.on('error', (err) => {
    logger.error({ err }, '[Worker:%s] Error:', QueueNames.FAILED_WEBHOOKS);
  });

  return worker;
}
