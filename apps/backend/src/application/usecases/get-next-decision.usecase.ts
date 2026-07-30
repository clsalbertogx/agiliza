import { DecisionEngineService, Decision } from '@/application/services/decision-engine.service';
import { createClient, MessageChannel } from '@/domain/entities/client';
import { createInvoice } from '@/domain/entities/invoice';

export interface GetNextDecisionInput {
  clientId: string;
  invoiceId: string;
}

/**
 * MVP use case that creates default mock client/invoice data
 * and delegates to the DecisionEngineService.
 * 
 * In a future iteration this will fetch real Client/Invoice from repositories.
 */
export class GetNextDecisionUseCase {
  constructor(
    private readonly decisionEngine: DecisionEngineService,
  ) {}

  async execute(input: GetNextDecisionInput): Promise<Decision> {
    const clientResult = createClient({
      id: input.clientId,
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: 'Cliente',
      phone: '5511999999999',
      preferredChannel: MessageChannel.WHATSAPP,
      preferredLeadDays: 3,
    });

    if (!clientResult.success) {
      throw new Error(`Failed to create client: ${clientResult.value.message}`);
    }

    const invoiceResult = createInvoice({
      id: input.invoiceId,
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: input.clientId,
      amount: 100,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      description: 'Default invoice',
    });

    if (!invoiceResult.success) {
      throw new Error(`Failed to create invoice: ${invoiceResult.value.message}`);
    }

    return this.decisionEngine.decideNextAction(clientResult.value, invoiceResult.value, 'default');
  }
}
