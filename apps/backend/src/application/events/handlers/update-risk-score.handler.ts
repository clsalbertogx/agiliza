import { RetryableWebhookHandler } from '@/application/events/handlers/retryable-webhook-handler';
import type { DLQPort } from '@/application/ports/queue/dlq.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { RiskCalculatorService } from '@/application/services/risk-calculator.service';
import type { DomainEvent } from '@/domain/events/domain-events';

export class UpdateRiskScoreHandler extends RetryableWebhookHandler {
  constructor(
    private readonly clientRepo: ClientRepositoryPort,
    readonly _invoiceRepo: InvoiceRepositoryPort,
    private readonly riskCalculator: RiskCalculatorService,
    dlqPort?: DLQPort,
  ) {
    super(dlqPort);
  }

  getEventType(): string {
    return 'payment.confirmed';
  }

  async handle(event: DomainEvent): Promise<void> {
    const eventsThatAffectRisk: string[] = [
      'payment.confirmed',
      'payment.failed',
      'invoice.overdue',
      'message.read',
      'message.clicked',
    ];
    if (!eventsThatAffectRisk.includes(event.eventType)) return;

    const clientId = event.clientId;
    if (!clientId) return;

    const newScore = await this.riskCalculator.calculate(clientId, event.tenantId);
    await this.clientRepo.updateRiskScore(clientId, newScore);
  }
}
