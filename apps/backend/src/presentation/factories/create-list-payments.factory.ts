import { ListPaymentsForInvoiceUseCase } from '@/application/usecases/list-payments-for-invoice.usecase';
import { PrismaPaymentRepository } from '@/infrastructure/database/repositories/payment.repository';

export function createListPaymentsForInvoiceUseCase(): ListPaymentsForInvoiceUseCase {
  return new ListPaymentsForInvoiceUseCase(new PrismaPaymentRepository());
}
