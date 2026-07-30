import { ReminderService } from '@/application/services/reminder.service';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaEventRepository } from '@/infrastructure/database/repositories/event.repository';
import { EvolutionMessageProvider } from '@/infrastructure/messaging/evolution/evolution-message.provider';
import { getQueue, QueueNames } from '@/infrastructure/queue';

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
  const messageProvider = new EvolutionMessageProvider({
    baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY || 'dev-key',
    instanceName: 'agiliza',
  });

  return new ReminderService(
    invoiceRepo,
    clientRepo,
    eventRepo,
    queueAdapter,
    messageProvider,
  );
}
