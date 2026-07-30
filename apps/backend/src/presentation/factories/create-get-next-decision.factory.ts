import { GetNextDecisionUseCase } from '@/application/usecases/get-next-decision.usecase';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { DecisionEngineService } from '@/application/services/decision-engine.service';

export function createGetNextDecisionUseCase(): GetNextDecisionUseCase {
  const clientRepo = new PrismaClientRepository();
  const invoiceRepo = new PrismaInvoiceRepository();
  const decisionEngine = new DecisionEngineService();
  return new GetNextDecisionUseCase(clientRepo, invoiceRepo, decisionEngine);
}
