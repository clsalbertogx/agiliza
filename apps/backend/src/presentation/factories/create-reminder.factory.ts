import { ReminderService } from '@/application/services/reminder.service';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaEventRepository } from '@/infrastructure/database/repositories/event.repository';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { getQueue, QueueNames } from '@/infrastructure/queue';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';
import { createEvolutionMessageProvider } from './create-evolution-message-provider.factory';

/**
 * Adapter that wraps the infrastructure queue as a QueuePort.
 * Created inline since the queue-manager has a slightly different signature.
 */
const queueAdapter = {
  async addJob(jobName: string, data: Record<string, unknown>): Promise<void> {
    await getQueue(QueueNames.SEND_MESSAGE).add(jobName, data);
  },
  async addBulkJobs(jobs: Array<{ name: string; data: Record<string, unknown> }>): Promise<void> {
    const queue = getQueue(QueueNames.SEND_MESSAGE);
    await queue.addBulk(jobs.map((j) => ({ name: j.name, data: j.data })));
  },
};

export function createReminderService(): ReminderService {
  const invoiceRepo = new PrismaInvoiceRepository();
  const clientRepo = new PrismaClientRepository();
  const eventRepo = new PrismaEventRepository();
  // S3: throws when EVOLUTION_API_KEY is missing — never defaults a credential.
  const messageProvider = createEvolutionMessageProvider();

  return new ReminderService(invoiceRepo, clientRepo, eventRepo, queueAdapter, messageProvider, new UuidV7Generator());
}
