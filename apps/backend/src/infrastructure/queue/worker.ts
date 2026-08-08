import { Worker } from 'bullmq';
import type { ReminderService } from '@/application/services/reminder.service';
import { logger } from '@/config/logger';
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
    logger.info('[Worker:reminders] Job %s completed', job.id);
  });

  worker.on('failed', (job, err) => {
    logger.error({ err }, '[Worker:reminders] Job %s failed:', job?.id);
  });

  worker.on('error', (err) => {
    logger.error({ err }, '[Worker:reminders] Error:');
  });

  return worker;
}

/**
 * Gracefully close a worker.
 */
export async function closeWorker(worker: Worker): Promise<void> {
  try {
    await worker.close();
    logger.info('[Worker:reminders] Closed');
  } catch (err) {
    logger.error({ err }, '[Worker:reminders] Error during close:');
  }
}
