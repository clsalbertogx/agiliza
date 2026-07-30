import { Worker } from 'bullmq';
import type { ReminderService } from '@/application/services/reminder.service';
import { getRedis } from './redis.service';

interface ReminderJobData {
  invoiceId: string;
  tenantId: string;
}

/**
 * Start a BullMQ worker for the 'reminders' queue.
 * Processes jobs by calling ReminderService.sendReminderNow.
 */
export function startReminderWorker(reminderService: ReminderService): Worker {
  const worker = new Worker<ReminderJobData>(
    'reminders',
    async (job) => {
      const { invoiceId, tenantId } = job.data;
      await reminderService.sendReminderNow(invoiceId, tenantId);
    },
    {
      connection: getRedis(),
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[Worker:reminders] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:reminders] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker:reminders] Error:', err);
  });

  return worker;
}

/**
 * Gracefully close a worker.
 */
export async function closeWorker(worker: Worker): Promise<void> {
  try {
    await worker.close();
    console.log('[Worker:reminders] Closed');
  } catch (err) {
    console.error('[Worker:reminders] Error during close:', err);
  }
}
