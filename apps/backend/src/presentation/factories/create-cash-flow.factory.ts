import { CashFlowService } from '../../application/services/cash-flow.service';
import { InvoiceRepository } from '../../infrastructure/database/repositories/invoice.repository';
import { ClientRepository } from '../../infrastructure/database/repositories/client.repository';

let cashFlowServiceInstance: CashFlowService | null = null;

export function createCashFlowService(): CashFlowService {
  if (!cashFlowServiceInstance) {
    const invoiceRepo = new InvoiceRepository();
    const clientRepo = new ClientRepository();
    cashFlowServiceInstance = new CashFlowService(invoiceRepo, clientRepo);
  }
  return cashFlowServiceInstance;
}

export function createInvoiceRepository(): InvoiceRepository {
  return new InvoiceRepository();
}
