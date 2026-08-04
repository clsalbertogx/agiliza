import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { Invoice } from '@/domain/entities/invoice';

export interface ListInvoicesInput {
  tenantId: string;
  page?: number;
  perPage?: number;
  status?: string;
  clientId?: string;
}

export interface ListInvoicesOutput {
  data: Invoice[];
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

export class ListInvoicesUseCase {
  constructor(private readonly invoiceRepo: InvoiceRepositoryPort) {}

  async execute(input: ListInvoicesInput): Promise<ListInvoicesOutput> {
    const page = Math.max(1, input.page || 1);
    const perPage = Math.min(100, Math.max(1, input.perPage || 10));

    const result = await this.invoiceRepo.findMany({
      tenantId: input.tenantId,
      page,
      limit: perPage,
      status: input.status,
      clientId: input.clientId,
    });

    return {
      data: result.data,
      meta: {
        total: result.total,
        page,
        perPage,
        totalPages: Math.ceil(result.total / perPage),
      },
    };
  }
}
