import { FastifyInstance } from 'fastify';
import { createCashFlowService } from '@/presentation/factories';

interface CashFlowQuery {
  tenantId?: string;
  months?: string;
}

interface SimpleQuery {
  tenantId?: string;
}

export async function reportRoutes(app: FastifyInstance) {
  // GET /api/reports/cash-flow — Cash flow forecast
  app.get<{ Querystring: CashFlowQuery }>('/api/reports/cash-flow', {
    schema: {
      tags: ['Reports'],
      summary: 'Cash flow forecast',
      description: 'Generates a cash flow forecast for the given number of months.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          months: { type: 'integer', minimum: 1, maximum: 12 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { data: { type: 'object', additionalProperties: true } },
          additionalProperties: true,
        },
      },
    },
  }, async (request) => {
    const tenantId = request.tenantId || request.query.tenantId;
    const months = Math.min(12, Math.max(1, parseInt(request.query.months || '6', 10) || 6));

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const cashFlowService = createCashFlowService();
    const report = await cashFlowService.generateForecast(tenantId, months);
    return { data: report };
  });

  // GET /api/reports/collection-efficiency — Collection efficiency metrics
  app.get<{ Querystring: SimpleQuery }>('/api/reports/collection-efficiency', {
    schema: {
      tags: ['Reports'],
      summary: 'Collection efficiency metrics',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { data: { type: 'object', additionalProperties: true } },
          additionalProperties: true,
        },
      },
    },
  }, async (request) => {
    const tenantId = request.tenantId || request.query.tenantId;

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const cashFlowService = createCashFlowService();
    const stats = await cashFlowService.getCollectionEfficiency(tenantId);
    return { data: stats };
  });

  // GET /api/reports/risk-distribution — Risk distribution
  app.get<{ Querystring: SimpleQuery }>('/api/reports/risk-distribution', {
    schema: {
      tags: ['Reports'],
      summary: 'Risk distribution report',
      description: 'Distribution of clients by risk score tier.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: { data: { type: 'object', additionalProperties: true } },
          additionalProperties: true,
        },
      },
    },
  }, async (request) => {
    const tenantId = request.tenantId || request.query.tenantId;

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const cashFlowService = createCashFlowService();
    const distribution = await cashFlowService.getRiskDistribution(tenantId);
    return { data: distribution };
  });
}
