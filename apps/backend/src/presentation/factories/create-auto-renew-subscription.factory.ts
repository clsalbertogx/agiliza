import { AutoRenewSubscriptionUseCase } from '@/application/usecases/auto-renew-subscription.usecase';
import { PrismaSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

export function createAutoRenewSubscriptionUseCase(): AutoRenewSubscriptionUseCase {
  const subscriptionRepo = new PrismaSubscriptionRepository();
  const invoiceRepo = new PrismaInvoiceRepository();
  const eventBus = new InMemoryEventBus();
  const idGenerator = new UuidV7Generator();
  return new AutoRenewSubscriptionUseCase(subscriptionRepo, invoiceRepo, eventBus, idGenerator);
}
