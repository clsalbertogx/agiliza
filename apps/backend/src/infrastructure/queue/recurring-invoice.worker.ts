import { Queue, Worker } from 'bullmq';
import type { CreateInvoiceForSubscriptionUseCase } from '@/application/usecases/create-invoice-for-subscription.usecase';
import { getRedis } from './redis.service';

const RECURRING_INVOICE_QUEUE = 'recurring-invoices';
const JOB_NAME = 'generate-recurring-invoices';

export function createRecurringInvoiceQueue(): Queue {
  return new Queue(RECURRING_INVOICE_QUEUE, { connection: getRedis() });
}

export async function scheduleRecurringInvoiceJob(queue: Queue): Promise<void> {
  // Remove existing repeatable jobs to avoid duplicates
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Add daily job at 2:00 AM
  await queue.add(
    JOB_NAME,
    {},
    {
      repeat: { pattern: '0 2 * * *' },
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  );
}

export function startRecurringInvoiceWorker(useCase: CreateInvoiceForSubscriptionUseCase): Worker {
  const worker = new Worker(
    RECURRING_INVOICE_QUEUE,
    async (job) => {
      if (job.name === JOB_NAME) {
        const result = await useCase.execute();
        console.log(
          `[RecurringInvoice] Created: ${result.created}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
        );
      }
    },
    { connection: getRedis() },
  );

  worker.on('completed', (job) => console.log(`[RecurringInvoice] Job ${job?.id} completed`));
  worker.on('failed', (job, err) => console.error(`[RecurringInvoice] Job ${job?.id} failed:`, err));

  return worker;
}
