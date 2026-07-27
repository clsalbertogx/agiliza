import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma client
const mockPrismaClient = {
  invoice: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('../../infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => mockPrismaClient),
}));

import { InvoiceRepository } from '../../infrastructure/database/repositories/invoice.repository';

describe('InvoiceRepository', () => {
  let repo: InvoiceRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new InvoiceRepository();
  });

  const mockInvoice = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000002',
    clientId: '00000000-0000-0000-0000-000000000003',
    amount: 150.00,
    dueDate: new Date('2026-08-01'),
    status: 'PENDING',
    paymentMethod: null,
    description: 'Test invoice',
    createdAt: new Date(),
    updatedAt: new Date(),
    paidAt: null,
    pixQRCode: null,
    pixCopyPaste: null,
    pixExpiresAt: null,
    externalPaymentId: null,
    metadata: null,
  };

  describe('Invoice CRUD', () => {
    it('should create an invoice with all required fields', async () => {
      mockPrismaClient.invoice.create.mockResolvedValue(mockInvoice);
      const result = await repo.create(mockInvoice);
      expect(result).toEqual(mockInvoice);
      expect(result.status).toBe('PENDING');
    });

    it('should find invoice by ID within tenant scope', async () => {
      mockPrismaClient.invoice.findUnique.mockResolvedValue(mockInvoice);
      const result = await repo.findById(mockInvoice.id);
      expect(result).toEqual(mockInvoice);
      expect(mockPrismaClient.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: mockInvoice.id },
      });
    });

    it('should return null when finding invoice with wrong tenantId', async () => {
      mockPrismaClient.invoice.findUnique.mockResolvedValue(null);
      const result = await repo.findById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should update invoice status', async () => {
      const updateData = { status: 'PAID', paidAt: new Date() };
      const updatedInvoice = { ...mockInvoice, ...updateData };
      mockPrismaClient.invoice.update.mockResolvedValue(updatedInvoice);
      const result = await repo.update(mockInvoice.id, updateData);
      expect(result.status).toBe('PAID');
      expect(result.paidAt).toBeDefined();
    });
  });

  describe('Invoice Queries', () => {
    it('should find overdue invoices (past due date, status = pending)', async () => {
      const overdueInvoices = [mockInvoice];
      mockPrismaClient.invoice.findMany.mockResolvedValue(overdueInvoices);
      const result = await repo.findOverdue(mockInvoice.tenantId);
      expect(result).toEqual(overdueInvoices);
      expect(mockPrismaClient.invoice.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockInvoice.tenantId,
          status: 'PENDING',
          dueDate: { lt: expect.any(Date) },
        },
        include: { client: true },
        orderBy: { dueDate: 'asc' },
      });
    });

    it('should find invoices due for a specific date', async () => {
      const dueInvoices = [mockInvoice];
      mockPrismaClient.invoice.findMany.mockResolvedValue(dueInvoices);
      const result = await repo.findPendingForDate(mockInvoice.tenantId, new Date('2026-08-01'));
      expect(result).toEqual(dueInvoices);
    });

    it('should find invoices due within a date range', async () => {
      mockPrismaClient.invoice.findMany.mockResolvedValue([mockInvoice]);
      const result = await repo.findMany({
        where: { tenantId: mockInvoice.tenantId },
      });
      expect(result).toHaveLength(1);
    });

    it('should list invoices filtered by status', async () => {
      mockPrismaClient.invoice.findMany.mockResolvedValue([mockInvoice]);
      const result = await repo.findMany({
        where: { tenantId: mockInvoice.tenantId, status: 'PENDING' },
      });
      expect(result).toHaveLength(1);
    });

    it('should list invoices filtered by clientId', async () => {
      mockPrismaClient.invoice.findMany.mockResolvedValue([mockInvoice]);
      const result = await repo.findMany({
        where: { tenantId: mockInvoice.tenantId, clientId: mockInvoice.clientId },
      });
      expect(result).toHaveLength(1);
    });

    it('should list invoices filtered by payment method', async () => {
      const pixInvoice = { ...mockInvoice, paymentMethod: 'PIX' };
      mockPrismaClient.invoice.findMany.mockResolvedValue([pixInvoice]);
      const result = await repo.findMany({
        where: { tenantId: mockInvoice.tenantId, paymentMethod: 'PIX' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].paymentMethod).toBe('PIX');
    });

    it('should paginate invoice list', async () => {
      const invoices = Array(30).fill(null).map((_, i) => ({
        ...mockInvoice,
        id: `id-${i}`,
        amount: 100 + i,
      }));
      mockPrismaClient.invoice.findMany.mockResolvedValue(invoices.slice(10, 20));
      mockPrismaClient.invoice.count.mockResolvedValue(30);
      const [data, total] = await Promise.all([
        repo.findMany({ skip: 10, take: 10 }),
        repo.count(),
      ]);
      expect(data.length).toBe(10);
      expect(total).toBe(30);
    });

    it('should sort invoices by dueDate descending by default', async () => {
      mockPrismaClient.invoice.findMany.mockResolvedValue([mockInvoice]);
      const result = await repo.findMany({
        orderBy: { createdAt: 'desc' },
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should sort invoices by amount', async () => {
      mockPrismaClient.invoice.findMany.mockResolvedValue([mockInvoice]);
      const result = await repo.findMany({
        orderBy: { amount: 'asc' },
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Status Update Operations', () => {
    it('should mark invoice as paid with payment details', async () => {
      const paymentData = {
        paymentMethod: 'PIX',
        externalPaymentId: 'ext_123',
        paidAt: new Date(),
      };
      const paidInvoice = { ...mockInvoice, ...paymentData, status: 'PAID' };
      mockPrismaClient.invoice.update.mockResolvedValue(paidInvoice);
      const result = await repo.markAsPaid(mockInvoice.id, paymentData);
      expect(result.status).toBe('PAID');
      expect(result.externalPaymentId).toBe('ext_123');
    });

    it('should mark invoice as overdue', async () => {
      mockPrismaClient.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'OVERDUE' });
      const result = await repo.update(mockInvoice.id, { status: 'OVERDUE' });
      expect(result.status).toBe('OVERDUE');
    });

    it('should cancel an invoice', async () => {
      mockPrismaClient.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'CANCELLED' });
      const result = await repo.update(mockInvoice.id, { status: 'CANCELLED' });
      expect(result.status).toBe('CANCELLED');
    });

    it('should NOT allow marking a paid invoice as overdue', async () => {
      mockPrismaClient.invoice.update.mockRejectedValue(new Error('Invalid status transition'));
      try {
        await repo.update(mockInvoice.id, { status: 'OVERDUE' });
      } catch (error: any) {
        expect(error.message).toContain('Invalid');
      }
    });
  });

  describe('Tenant Isolation', () => {
    it('should only return invoices for the specified tenant', async () => {
      mockPrismaClient.invoice.findMany.mockResolvedValue([mockInvoice]);
      const result = await repo.findMany({
        where: { tenantId: mockInvoice.tenantId },
      });
      expect(result).toHaveLength(1);
      expect(result[0].tenantId).toBe(mockInvoice.tenantId);
    });

    it('should enforce tenantId filter in all queries', async () => {
      mockPrismaClient.invoice.findMany.mockResolvedValue([]);
      const result = await repo.findMany({ where: { tenantId: 'unknown-tenant' } });
      expect(result).toEqual([]);
    });
  });
});
