import { FastifyInstance } from 'fastify';
import { CashFlowService } from '../application/services/cash-flow.service';
import { InvoiceRepository } from '../infrastructure/database/repositories/invoice.repository';

const cashFlowService = new CashFlowService();
const invoiceRepo = new InvoiceRepository();

export async function reportRoutes(app: FastifyInstance) {
  // GET /api/reports/cash-flow — Cash flow forecast
  app.get('/api/reports/cash-flow', async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;
    const months = Math.min(12, Math.max(1, parseInt(query.months) || 6));

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const report = await cashFlowService.generateForecast(tenantId, months);
    return { data: report };
  });

  // GET /api/reports/collection-efficiency — Collection efficiency metrics
  app.get('/api/reports/collection-efficiency', async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const stats = await invoiceRepo.getStats(tenantId);
    return { data: stats };
  });

  // GET /api/reports/risk-distribution — Risk distribution
  app.get('/api/reports/risk-distribution', async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const allInvoices = await invoiceRepo.findMany({
      where: { tenantId },
    });

    const total = allInvoices.length;
    const overdueCount = allInvoices.filter(i => i.status === 'OVERDUE').length;
    const paidCount = allInvoices.filter(i => i.status === 'PAID').length;
    const pendingCount = allInvoices.filter(i => i.status === 'PENDING').length;

    return {
      data: {
        green: { count: paidCount, percentage: total > 0 ? Math.round((paidCount / total) * 100) : 0 },
        yellow: { count: pendingCount, percentage: total > 0 ? Math.round((pendingCount / total) * 100) : 0 },
        red: { count: overdueCount, percentage: total > 0 ? Math.round((overdueCount / total) * 100) : 0 },
      },
    };
  });
}
