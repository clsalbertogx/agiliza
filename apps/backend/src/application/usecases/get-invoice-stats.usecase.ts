import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { ApplicationError } from '@/application/errors/application.error';
import { Either, success, failure } from '@/application/types/either';

export interface GetInvoiceStatsInput {
  tenantId: string;
}

export class GetInvoiceStatsUseCase {
  constructor(private readonly invoiceRepo: InvoiceRepositoryPort) {}

  async execute(input: GetInvoiceStatsInput): Promise<Either<ApplicationError, unknown>> {
    if (!input.tenantId) {
      return failure(new ApplicationError('tenantId is required', 'VALIDATION_ERROR', 400));
    }
    const stats = await this.invoiceRepo.getStats(input.tenantId);
    return success(stats);
  }
}
