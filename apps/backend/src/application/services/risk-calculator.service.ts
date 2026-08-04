import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { RiskScoreService } from '@/application/services/risk-score.service';
import { RiskScore } from '@/domain/entities/client';

export class RiskCalculatorService {
  constructor(
    private readonly clientRepo: ClientRepositoryPort,
    readonly _invoiceRepo: InvoiceRepositoryPort,
    private readonly riskScoreService: RiskScoreService = new RiskScoreService(),
  ) {}

  async calculate(clientId: string, _tenantId: string): Promise<RiskScore> {
    const client = await this.clientRepo.findById(clientId);
    if (!client) return RiskScore.GREEN;

    const isNewClient = client.totalInvoices === 0;

    let overdueInvoiceCount = 0;
    let avgPaymentDelayDays = 0;

    if (!isNewClient) {
      overdueInvoiceCount = Math.max(0, client.totalInvoices - client.paidInvoices);
      avgPaymentDelayDays = client.avgPaymentDelay ?? 0;
    }

    const { score } = this.riskScoreService.calculateRiskScore(client, {
      overdueInvoiceCount,
      avgPaymentDelayDays,
      msgOpenRate7d: null,
      daysSinceLastPayment: null,
      isNewClient,
    });

    return score;
  }
}
