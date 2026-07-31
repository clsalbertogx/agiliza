import { Worker } from 'bullmq';
import { getRedis } from './redis.service';
import { QueueNames } from './queue-definitions';

/**
 * Start a BullMQ worker that drains the dead-letter queue.
 *
 * Failed-webhook jobs are intentionally NOT auto-reprocessed — the
 * retry/backoff is handled in-process by `RetryableWebhookHandler` before
 * a job ever reaches this queue. Once here, the only sensible action is
 * to log it loudly so an operator can inspect / replay it.
 *
 * In a future iteration this worker can persist payloads to a database
 * table for a manual-review UI.
 */
export function startDeadLetterWorker(): Worker {
  const worker = new Worker(
    QueueNames.FAILED_WEBHOOKS,
    async (job) => {
      console.error('[DLQ] Failed webhook:', job.data);
      // TODO: persist to a database table for manual review UI
    },
    { connection: getRedis() },
  );

  worker.on('completed', (job) => {
    console.log(`[Worker:${QueueNames.FAILED_WEBHOOKS}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:${QueueNames.FAILED_WEBHOOKS}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[Worker:${QueueNames.FAILED_WEBHOOKS}] Error:`, err);
  });

  return worker;
}
