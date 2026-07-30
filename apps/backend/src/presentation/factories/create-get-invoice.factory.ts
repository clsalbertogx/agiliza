import { GetInvoiceUseCase } from '@/application/usecases/get-invoice.usecase';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';

export function createGetInvoiceUseCase(): GetInvoiceUseCase {
  const invoiceRepo = new PrismaInvoiceRepository();
  return new GetInvoiceUseCase(invoiceRepo);
}
