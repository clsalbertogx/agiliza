import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { DecisionEngineService } from '@/application/services/decision-engine.service';
import { ApplicationError } from '@/application/errors/application.error';
import { Either, success, failure } from '@/application/types/either';

export interface GetNextDecisionInput {
  clientId: string;
  invoiceId: string;
  tenantId: string;
}

export interface GetNextDecisionOutput {
  action: string;
  channel: string;
  templateName: string;
  scheduledAt: string;
}

export class GetNextDecisionUseCase {
  constructor(
    private readonly clientRepo: ClientRepositoryPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly decisionEngine: DecisionEngineService,
  ) {}

  async execute(input: GetNextDecisionInput): Promise<Either<ApplicationError, GetNextDecisionOutput>> {
    // 1. Fetch real client from database
    const client = await this.clientRepo.findById(input.clientId, input.tenantId);
    if (!client) {
      return failure(ApplicationError.notFound('Client', input.clientId));
    }

    // 2. Fetch real invoice from database
    const invoice = await this.invoiceRepo.findById(input.invoiceId, input.tenantId);
    if (!invoice) {
      return failure(ApplicationError.notFound('Invoice', input.invoiceId));
    }

    // 3. Get decision from engine
    const decision = this.decisionEngine.decideNextAction(client, invoice, 'default');

    return success({
      action: decision.action,
      channel: decision.channel,
      templateName: decision.templateName,
      scheduledAt: decision.scheduledAt.toISOString(),
    });
  }
}
