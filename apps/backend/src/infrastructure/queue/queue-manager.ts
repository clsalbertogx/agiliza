import { type Job, Queue, Worker } from 'bullmq';
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
  if (!queues.has(name)) {
    const defaultJobOptions = name === QueueNames.FAILED_WEBHOOKS ? DLQ_JOB_OPTIONS : DEFAULT_JOB_OPTIONS;

    const queue = new Queue(name, {
      connection: getRedis(),
      defaultJobOptions,
    });

    queue.on('error', (err) => {
      console.error(`[Queue:${name}] Error:`, err);
    });

    queues.set(name, queue);
  }

  return queues.get(name)!;
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
    console.log(`[Worker:${queueName}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:${queueName}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[Worker:${queueName}] Error:`, err);
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
        console.log(`[Queue:${name}] Closed`);
      }),
    );
  }

  queues.clear();
  await Promise.all(closePromises);
}
