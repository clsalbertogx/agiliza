import { Queue, Worker, type Job } from 'bullmq';
import { getRedis } from './redis.service';
import { DEFAULT_JOB_OPTIONS, type QueueName } from './queue-definitions';

const queues = new Map<QueueName, Queue>();

/**
 * Get or create a BullMQ queue instance.
 */
export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getRedis(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
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
