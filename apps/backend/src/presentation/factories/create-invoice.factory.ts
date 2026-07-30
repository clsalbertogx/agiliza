import { CreateInvoiceUseCase } from '../../application/usecases/create-invoice.usecase';
import { PrismaInvoiceRepository } from '../../infrastructure/database/repositories/invoice.repository';
import { PrismaClientRepository } from '../../infrastructure/database/repositories/client.repository';
import { InMemoryEventBus } from '../../infrastructure/event-bus/in-memory-event-bus';

export function createCreateInvoiceUseCase(): CreateInvoiceUseCase {
  const invoiceRepo = new PrismaInvoiceRepository();
  const clientRepo = new PrismaClientRepository();
  const eventBus = new InMemoryEventBus();
  return new CreateInvoiceUseCase(invoiceRepo, clientRepo, eventBus);
}
