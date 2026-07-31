import { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { ApplicationError } from '@/application/errors/application.error';
import { Either, success } from '@/application/types/either';

export interface ListPaymentsForInvoiceInput {
  invoiceId: string;
  tenantId: string;
}

export class ListPaymentsForInvoiceUseCase {
  constructor(private readonly paymentRepo: PaymentRepositoryPort) {}

  async execute(input: ListPaymentsForInvoiceInput): Promise<Either<ApplicationError, any[]>> {
    const payments = await this.paymentRepo.findByInvoiceId(input.invoiceId, input.tenantId);
    return success(payments);
  }
}
