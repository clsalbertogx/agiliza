import { ListInvoicesUseCase } from '@/application/usecases/list-invoices.usecase';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';

export function createListInvoicesUseCase(): ListInvoicesUseCase {
  const invoiceRepo = new PrismaInvoiceRepository();
  return new ListInvoicesUseCase(invoiceRepo);
}
