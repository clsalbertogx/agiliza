interface MonthlyForecast {
  month: string;
  expectedRevenue: number;
  expectedDefaults: number;
  recoveryEstimate: number;
  netForecast: number;
  confidence: number;
}

interface CashFlowReport {
  forecast: MonthlyForecast[];
  summary: {
    totalExpectedRevenue: number;
    totalExpectedDefaults: number;
    totalRecoveryEstimate: number;
    totalNetForecast: number;
    averageConfidence: number;
  };
}

interface RiskDistribution {
  green: { count: number; percentage: number };
  yellow: { count: number; percentage: number };
  red: { count: number; percentage: number };
}

interface InvoiceLike {
  id: string;
  status: string;
  amount: number;
  dueDate: Date;
  tenantId: string;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ClientLike {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
}

interface InvoiceRepositoryPort {
  findMany(params: { where?: Record<string, unknown>; orderBy?: Record<string, string> }): Promise<InvoiceLike[]>;
  getStats(tenantId: string): Promise<Record<string, unknown>>;
}

interface ClientRepositoryPort {
  findMany(params: { where?: Record<string, unknown> }): Promise<ClientLike[]>;
}

export class CashFlowService {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
  ) {}

  async generateForecast(tenantId: string, months: number = 6): Promise<CashFlowReport> {
    const forecast: MonthlyForecast[] = [];
    const now = new Date();

    // Get historical data for baseline
    const allInvoices = await this.invoiceRepo.findMany({
      where: { tenantId },
      orderBy: { dueDate: 'asc' },
    });

    // Calculate baseline metrics from history
    const totalHistorical = allInvoices.length;
    const paidHistorical = allInvoices.filter(i => i.status === 'PAID').length;
    const overdueHistorical = allInvoices.filter(i => i.status === 'OVERDUE').length;

    const paymentRate = totalHistorical > 0 ? paidHistorical / totalHistorical : 0.85;
    const defaultRate = totalHistorical > 0 ? overdueHistorical / totalHistorical : 0.12;
    const recoveryRate = 0.3; // 30% recovery from defaults (MVP estimate)

    // Get active clients for revenue projection
    const activeClients = await this.clientRepo.findMany({
      where: { tenantId },
    });

    // Average revenue per client
    const paidInvoices = allInvoices.filter(i => i.status === 'PAID');
    const avgRevenue = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, inv) => sum + inv.amount, 0) / paidInvoices.length
      : 99.90; // Default average ticket

    for (let i = 0; i < months; i++) {
      const forecastDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = forecastDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      // Projected revenue based on active clients + growth estimate
      const projectedRevenue = activeClients.length * avgRevenue * (1 + i * 0.02); // 2% monthly growth
      const projectedDefaults = projectedRevenue * defaultRate;
      const projectedRecovery = projectedDefaults * recoveryRate;

      // Confidence decreases with time
      const confidence = Math.max(0.5, 0.95 - i * 0.08);

      forecast.push({
        month: monthLabel,
        expectedRevenue: Math.round(projectedRevenue * 100) / 100,
        expectedDefaults: Math.round(projectedDefaults * 100) / 100,
        recoveryEstimate: Math.round(projectedRecovery * 100) / 100,
        netForecast: Math.round((projectedRevenue - projectedDefaults + projectedRecovery) * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    const summary = {
      totalExpectedRevenue: forecast.reduce((s, f) => s + f.expectedRevenue, 0),
      totalExpectedDefaults: forecast.reduce((s, f) => s + f.expectedDefaults, 0),
      totalRecoveryEstimate: forecast.reduce((s, f) => s + f.recoveryEstimate, 0),
      totalNetForecast: forecast.reduce((s, f) => s + f.netForecast, 0),
      averageConfidence: Math.round((forecast.reduce((s, f) => s + f.confidence, 0) / months) * 100) / 100,
    };

    return { forecast, summary };
  }

  async getCollectionEfficiency(tenantId: string): Promise<Record<string, unknown>> {
    return this.invoiceRepo.getStats(tenantId);
  }

  async getRiskDistribution(tenantId: string): Promise<RiskDistribution> {
    const allInvoices = await this.invoiceRepo.findMany({
      where: { tenantId },
    });

    const total = allInvoices.length;
    const overdueCount = allInvoices.filter(i => i.status === 'OVERDUE').length;
    const paidCount = allInvoices.filter(i => i.status === 'PAID').length;
    const pendingCount = allInvoices.filter(i => i.status === 'PENDING').length;

    return {
      green: { count: paidCount, percentage: total > 0 ? Math.round((paidCount / total) * 100) : 0 },
      yellow: { count: pendingCount, percentage: total > 0 ? Math.round((pendingCount / total) * 100) : 0 },
      red: { count: overdueCount, percentage: total > 0 ? Math.round((overdueCount / total) * 100) : 0 },
    };
  }
}
