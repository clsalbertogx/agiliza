import { DomainEvent } from '@/domain/events/domain-events';
import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { RiskCalculatorService } from '@/application/services/risk-calculator.service';

export class UpdateRiskScoreHandler {
  constructor(
    private readonly clientRepo: ClientRepositoryPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly riskCalculator: RiskCalculatorService
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const eventsThatAffectRisk: string[] = [
      'payment.confirmed',
      'payment.failed',
      'invoice.overdue',
      'message.read',
      'message.clicked',
    ];
    if (!eventsThatAffectRisk.includes(event.eventType)) return;

    try {
      const clientId = event.clientId;
      if (!clientId) return;

      const newScore = await this.riskCalculator.calculate(clientId, event.tenantId);
      await this.clientRepo.updateRiskScore(clientId, newScore);
    } catch (error) {
      console.error('[UpdateRiskScoreHandler] Error:', error);
    }
  }
}
