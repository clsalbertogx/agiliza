import { RiskScore, Client } from '../../domain/entities/client';

interface RiskFactors {
  overdueInvoiceCount: number;
  avgPaymentDelayDays: number;
  msgOpenRate7d: number | null;
  daysSinceLastPayment: number | null;
  isNewClient: boolean;
}

export class RiskScoreService {
  calculateRiskScore(client: Client, factors: RiskFactors): { score: RiskScore; reasons: string[] } {
    const reasons: string[] = [];

    // Cold Start: new clients start as GREEN
    if (factors.isNewClient) {
      return { score: RiskScore.GREEN, reasons: ['Novo cliente — Cold Start GREEN'] };
    }

    // RED: 3+ overdue invoices OR avg delay > 15 days
    if (factors.overdueInvoiceCount >= 3 || (factors.avgPaymentDelayDays > 15)) {
      reasons.push(`${factors.overdueInvoiceCount} faturas em atraso`);
      if (factors.avgPaymentDelayDays > 15) {
        reasons.push(`Atraso médio de ${Math.round(factors.avgPaymentDelayDays)} dias`);
      }
      return { score: RiskScore.RED, reasons };
    }

    // YELLOW: 1-2 overdue invoices OR avg delay 5-15 days
    if (factors.overdueInvoiceCount >= 1 || (factors.avgPaymentDelayDays > 5)) {
      if (factors.overdueInvoiceCount >= 1) {
        reasons.push(`${factors.overdueInvoiceCount} faturas em atraso`);
      }
      if (factors.avgPaymentDelayDays > 5) {
        reasons.push(`Atraso médio de ${Math.round(factors.avgPaymentDelayDays)} dias`);
      }
      return { score: RiskScore.YELLOW, reasons };
    }

    // GREEN: 0 overdue invoices AND avg delay <= 5 days
    reasons.push('Pagamentos em dia');
    if (factors.msgOpenRate7d !== null && factors.msgOpenRate7d < 0.2) {
      reasons.push('Baixa taxa de abertura de mensagens');
      // Still GREEN, but note the low engagement
    }

    return { score: RiskScore.GREEN, reasons };
  }
}
