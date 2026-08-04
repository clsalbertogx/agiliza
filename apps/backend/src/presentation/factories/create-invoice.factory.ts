import { CreateInvoiceUseCase } from '@/application/usecases/create-invoice.usecase';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { InMemoryEventBus } from '@/infrastructure/event-bus/in-memory-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

export function createCreateInvoiceUseCase(): CreateInvoiceUseCase {
  const invoiceRepo = new PrismaInvoiceRepository();
  const clientRepo = new PrismaClientRepository();
  const eventBus = new InMemoryEventBus();
  const idGenerator = new UuidV7Generator();
  return new CreateInvoiceUseCase(invoiceRepo, clientRepo, eventBus, idGenerator);
}
