import { ApplicationError } from '@/application/errors/application.error';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { type Either, failure, success } from '@/application/types/either';
import type { Invoice } from '@/domain/entities/invoice';

export interface GetInvoiceInput {
  id: string;
  tenantId: string;
}

export class GetInvoiceUseCase {
  constructor(private readonly invoiceRepo: InvoiceRepositoryPort) {}

  async execute(input: GetInvoiceInput): Promise<Either<ApplicationError, Invoice>> {
    const invoice = await this.invoiceRepo.findById(input.id, input.tenantId);
    if (!invoice) {
      return failure(new ApplicationError('Invoice not found', 'NOT_FOUND', 404));
    }
    return success(invoice);
  }
}
