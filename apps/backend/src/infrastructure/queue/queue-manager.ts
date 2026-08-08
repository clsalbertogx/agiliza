import { type Job, Queue, Worker } from 'bullmq';
import { logger } from '@/config/logger';
import { DEFAULT_JOB_OPTIONS, DLQ_JOB_OPTIONS, type QueueName, QueueNames } from './queue-definitions';
import { getRedis } from './redis.service';

const queues = new Map<QueueName, Queue>();

/**
 * Get or create a BullMQ queue instance.
 *
 * The DLQ queue (FAILED_WEBHOOKS) is created with `DLQ_JOB_OPTIONS` so jobs
 * are kept indefinitely for manual review.
 */
export function getQueue(name: QueueName): Queue {
  const existing = queues.get(name);
  if (existing) {
    return existing;
  }

  const defaultJobOptions = name === QueueNames.FAILED_WEBHOOKS ? DLQ_JOB_OPTIONS : DEFAULT_JOB_OPTIONS;

  const queue = new Queue(name, {
    connection: getRedis(),
    defaultJobOptions,
  });

  queue.on('error', (err) => {
    logger.error({ err }, '[Queue:%s] Error:', name);
  });

  queues.set(name, queue);
  return queue;
}

/**
 * Add a job to a queue.
 */
export async function addJob<T extends Record<string, unknown>>(
  queueName: QueueName,
  jobName: string,
  data: T,
  opts?: { delay?: number },
): Promise<string> {
  const queue = getQueue(queueName);
  const job = await queue.add(jobName, data, {
    delay: opts?.delay,
  });
  return job.id ?? '';
}

/**
 * Add a failed-webhook DLQ entry. Kept as a dedicated helper so callers
 * (i.e. the retry base class's adapter) don't need to know the job name.
 */
export async function addFailedWebhookJob(data: Record<string, unknown>): Promise<string> {
  return addJob(QueueNames.FAILED_WEBHOOKS, 'failed-webhook', data);
}

/**
 * Create a worker that processes jobs from a queue.
 */
export function createWorker<T = unknown>(
  queueName: QueueName,
  handler: (payload: T) => Promise<void>,
  concurrency = 5,
): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      await handler(job.data as T);
    },
    {
      connection: getRedis(),
      concurrency,
    },
  );

  worker.on('completed', (job) => {
    logger.info('[Worker:%s] Job %s completed', queueName, job.id);
  });

  worker.on('failed', (job, err) => {
    logger.error({ err }, '[Worker:%s] Job %s failed:', queueName, job?.id);
  });

  worker.on('error', (err) => {
    logger.error({ err }, '[Worker:%s] Error:', queueName);
  });

  return worker;
}

/**
 * Gracefully close all queue connections.
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [name, queue] of queues.entries()) {
    closePromises.push(
      queue.close().then(() => {
        logger.info('[Queue:%s] Closed', name);
      }),
    );
  }

  queues.clear();
  await Promise.all(closePromises);
}
