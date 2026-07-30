import { GetInvoiceStatsUseCase } from '@/application/usecases/get-invoice-stats.usecase';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';

export function createGetInvoiceStatsUseCase(): GetInvoiceStatsUseCase {
  const invoiceRepo = new PrismaInvoiceRepository();
  return new GetInvoiceStatsUseCase(invoiceRepo);
}
