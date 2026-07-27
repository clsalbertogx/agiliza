import { FastifyInstance } from 'fastify';
import { CashFlowService } from '../application/services/cash-flow.service';
import { InvoiceRepository } from '../infrastructure/database/repositories/invoice.repository';
import { ClientRepository } from '../infrastructure/database/repositories/client.repository';

// DI: instantiate repositories once, inject into service
const invoiceRepo = new InvoiceRepository();
const clientRepo = new ClientRepository();
const cashFlowService = new CashFlowService(invoiceRepo, clientRepo);

interface CashFlowQuery {
  tenantId?: string;
  months?: string;
}

interface SimpleQuery {
  tenantId?: string;
}

export async function reportRoutes(app: FastifyInstance) {
  // GET /api/reports/cash-flow — Cash flow forecast
  app.get<{ Querystring: CashFlowQuery }>('/api/reports/cash-flow', async (request) => {
    const tenantId = request.tenantId || request.query.tenantId;
    const months = Math.min(12, Math.max(1, parseInt(request.query.months || '6', 10) || 6));

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const report = await cashFlowService.generateForecast(tenantId, months);
    return { data: report };
  });

  // GET /api/reports/collection-efficiency — Collection efficiency metrics
  app.get<{ Querystring: SimpleQuery }>('/api/reports/collection-efficiency', async (request) => {
    const tenantId = request.tenantId || request.query.tenantId;

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const stats = await invoiceRepo.getStats(tenantId);
    return { data: stats };
  });

  // GET /api/reports/risk-distribution — Risk distribution
  app.get<{ Querystring: SimpleQuery }>('/api/reports/risk-distribution', async (request) => {
    const tenantId = request.tenantId || request.query.tenantId;

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const distribution = await cashFlowService.getRiskDistribution(tenantId);
    return { data: distribution };
  });
}
