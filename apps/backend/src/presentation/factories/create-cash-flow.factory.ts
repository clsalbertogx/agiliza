import { CashFlowService } from '@/application/services/cash-flow.service';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';

export function createCashFlowService(): CashFlowService {
  const invoiceRepo = new PrismaInvoiceRepository();
  const clientRepo = new PrismaClientRepository();

  return new CashFlowService(
    {
      findMany: async (params) => {
        const result = await invoiceRepo.findManyRaw({
          where: params.where as Record<string, unknown> | undefined,
          orderBy: params.orderBy as Record<string, string> | undefined,
        });
        return result as any;
      },
      getStats: async (tenantId) => {
        return invoiceRepo.getStatsRaw(tenantId);
      },
    },
    {
      findMany: async (params) => {
        const result = await clientRepo.findManyRaw({
          where: params.where as Record<string, unknown> | undefined,
        });
        return result as any;
      },
    },
  );
}

export function createInvoiceRepository(): PrismaInvoiceRepository {
  return new PrismaInvoiceRepository();
}
