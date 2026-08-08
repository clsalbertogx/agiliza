import { CreateInvoiceForSubscriptionUseCase } from '@/application/usecases/create-invoice-for-subscription.usecase';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { PrismaSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository';
import { getEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';

export function createRecurringInvoiceUseCase(): CreateInvoiceForSubscriptionUseCase {
  const subscriptionRepo = new PrismaSubscriptionRepository();
  const invoiceRepo = new PrismaInvoiceRepository();
  const clientRepo = new PrismaClientRepository();
  const eventBus = getEventBus();

  return new CreateInvoiceForSubscriptionUseCase(subscriptionRepo, invoiceRepo, clientRepo, eventBus);
}
