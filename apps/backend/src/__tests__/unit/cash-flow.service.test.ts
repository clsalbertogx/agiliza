import { describe, it, expect, vi } from 'vitest';
import { CashFlowService } from '../../application/services/cash-flow.service';

function createMocks() {
  const invoiceRepo = {
    findMany: vi.fn(),
    getStats: vi.fn(),
  };

  const clientRepo = {
    findMany: vi.fn(),
  };

  return { invoiceRepo, clientRepo };
}

describe('CashFlowService', () => {
  describe('generateForecast', () => {
    it('should generate forecast with mixed invoice data', async () => {
      const { invoiceRepo, clientRepo } = createMocks();

      invoiceRepo.findMany.mockResolvedValue([
        { id: '1', tenantId: 't1', clientId: 'c1', amount: 100, status: 'PAID', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: '2', tenantId: 't1', clientId: 'c1', amount: 200, status: 'PAID', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: '3', tenantId: 't1', clientId: 'c1', amount: 150, status: 'OVERDUE', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: '4', tenantId: 't1', clientId: 'c1', amount: 50, status: 'PENDING', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);

      clientRepo.findMany.mockResolvedValue([
        { id: 'c1', tenantId: 't1', name: 'Client A', phone: '5511999998888' },
        { id: 'c2', tenantId: 't1', name: 'Client B', phone: '5511999998889' },
      ]);

      const service = new CashFlowService(invoiceRepo, clientRepo);
      const result = await service.generateForecast('t1', 3);

      expect(result.forecast).toHaveLength(3);
      expect(result.summary).toBeDefined();
      expect(result.summary.averageConfidence).toBeGreaterThan(0);
      expect(result.forecast[0].expectedRevenue).toBeGreaterThan(0);
      expect(result.forecast[0].netForecast).toBeGreaterThan(0);
    });

    it('should handle zero invoices gracefully', async () => {
      const { invoiceRepo, clientRepo } = createMocks();

      invoiceRepo.findMany.mockResolvedValue([]);
      clientRepo.findMany.mockResolvedValue([
        { id: 'c1', tenantId: 't1', name: 'Client A', phone: '5511999998888' },
      ]);

      const service = new CashFlowService(invoiceRepo, clientRepo);
      const result = await service.generateForecast('t1', 3);

      expect(result.forecast).toHaveLength(3);
      // Should use default values when no historical data
      expect(result.forecast[0].expectedRevenue).toBe(99.9); // default avg ticket
    });

    it('should handle zero clients gracefully', async () => {
      const { invoiceRepo, clientRepo } = createMocks();

      invoiceRepo.findMany.mockResolvedValue([
        { id: '1', tenantId: 't1', clientId: 'c1', amount: 100, status: 'PAID', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);
      clientRepo.findMany.mockResolvedValue([]);

      const service = new CashFlowService(invoiceRepo, clientRepo);
      const result = await service.generateForecast('t1', 3);

      expect(result.forecast).toHaveLength(3);
      // No active clients = no projected revenue
      expect(result.forecast[0].expectedRevenue).toBe(0);
    });

    it('should handle 100% default rate (all overdue)', async () => {
      const { invoiceRepo, clientRepo } = createMocks();

      invoiceRepo.findMany.mockResolvedValue([
        { id: '1', tenantId: 't1', clientId: 'c1', amount: 100, status: 'OVERDUE', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: '2', tenantId: 't1', clientId: 'c1', amount: 200, status: 'OVERDUE', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);
      clientRepo.findMany.mockResolvedValue([
        { id: 'c1', tenantId: 't1', name: 'Client A', phone: '5511999998888' },
      ]);

      const service = new CashFlowService(invoiceRepo, clientRepo);
      const result = await service.generateForecast('t1', 3);

      expect(result.forecast).toHaveLength(3);
      // Recovery should be 30% of defaults
      expect(result.forecast[0].recoveryEstimate).toBeGreaterThan(0);
    });

    it('should handle multi-month forecast', async () => {
      const { invoiceRepo, clientRepo } = createMocks();

      invoiceRepo.findMany.mockResolvedValue([
        { id: '1', tenantId: 't1', clientId: 'c1', amount: 100, status: 'PAID', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: '2', tenantId: 't1', clientId: 'c1', amount: 200, status: 'PAID', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);
      clientRepo.findMany.mockResolvedValue([
        { id: 'c1', tenantId: 't1', name: 'Client A', phone: '5511999998888' },
      ]);

      const service = new CashFlowService(invoiceRepo, clientRepo);
      const result = await service.generateForecast('t1', 12);

      expect(result.forecast).toHaveLength(12);
      // Each month should increase due to growth factor
      expect(result.forecast[0].expectedRevenue).toBeLessThan(result.forecast[11].expectedRevenue);
      // Confidence should decrease over time
      expect(result.forecast[0].confidence).toBeGreaterThan(result.forecast[11].confidence);
      // Monthly growth should be reasonable
      expect(result.forecast[1].expectedRevenue).toBeCloseTo(result.forecast[0].expectedRevenue * 1.02, 0);
    });
  });

  describe('getRiskDistribution', () => {
    it('should correctly distribute invoices by risk category', async () => {
      const { invoiceRepo, clientRepo } = createMocks();

      invoiceRepo.findMany.mockResolvedValue([
        { id: '1', tenantId: 't1', clientId: 'c1', amount: 100, status: 'PAID', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: '2', tenantId: 't1', clientId: 'c1', amount: 200, status: 'PENDING', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: '3', tenantId: 't1', clientId: 'c1', amount: 150, status: 'OVERDUE', dueDate: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);

      const service = new CashFlowService(invoiceRepo, clientRepo);
      const result = await service.getRiskDistribution('t1');

      expect(result.green.count).toBe(1);
      expect(result.yellow.count).toBe(1);
      expect(result.red.count).toBe(1);
      expect(result.green.percentage).toBe(33);
      expect(result.yellow.percentage).toBe(33);
      expect(result.red.percentage).toBe(33);
    });

    it('should handle zero invoices', async () => {
      const { invoiceRepo, clientRepo } = createMocks();

      invoiceRepo.findMany.mockResolvedValue([]);

      const service = new CashFlowService(invoiceRepo, clientRepo);
      const result = await service.getRiskDistribution('t1');

      expect(result.green.count).toBe(0);
      expect(result.yellow.count).toBe(0);
      expect(result.red.count).toBe(0);
      expect(result.green.percentage).toBe(0);
      expect(result.yellow.percentage).toBe(0);
      expect(result.red.percentage).toBe(0);
    });
  });
});
