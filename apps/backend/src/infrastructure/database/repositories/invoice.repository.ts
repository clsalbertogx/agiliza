import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { Invoice } from '@/domain/entities/invoice';
import { getPrismaClient } from '@/infrastructure/database/prisma.service';
import { getTransaction } from '@/infrastructure/database/unit-of-work';
import { InvoiceMapper, type PersistenceInvoice } from '@/infrastructure/database/mappers/invoice.mapper';

/**
 * Port-compliant Prisma invoice repository.
 * Implements InvoiceRepositoryPort for use with use cases.
 * Uses a DomainMapper for standardized toDomain/toPersistence mapping.
 *
 * All database operations automatically participate in the ambient
 * Unit of Work transaction when one is active (see PrismaUnitOfWork).
 */
export class PrismaInvoiceRepository implements InvoiceRepositoryPort {
  private prisma = getPrismaClient();
  private readonly mapper: InvoiceMapper;

  constructor(mapper?: InvoiceMapper) {
    this.mapper = mapper ?? new InvoiceMapper();
  }

  /**
   * Returns the transactional Prisma client when called inside a
   * PrismaUnitOfWork.execute() callback, or the regular client otherwise.
   */
  private get txClient() {
    return getTransaction() ?? this.prisma;
  }

  async findById(id: string, tenantId?: string): Promise<Invoice | null> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const result = await this.txClient.invoice.findFirst({ where });
    return result ? this.mapper.toDomain(result as unknown as PersistenceInvoice) : null;
  }

  async findMany(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    status?: string;
    clientId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: Invoice[]; total: number }> {
    const { tenantId, page = 1, limit = 10, status, clientId, startDate, endDate } = params;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = startDate;
      if (endDate) where.dueDate.lte = endDate;
    }
    const [data, total] = await Promise.all([
      this.txClient.invoice.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.txClient.invoice.count({ where }),
    ]);
    return { data: data.map((r) => this.mapper.toDomain(r as unknown as PersistenceInvoice)), total };
  }

  async create(invoice: Invoice): Promise<Invoice> {
    const persistence = this.mapper.toPersistence(invoice);
    const result = await this.txClient.invoice.create({ data: persistence as any });
    return this.mapper.toDomain(result as unknown as PersistenceInvoice);
  }

  async update(invoice: Invoice): Promise<Invoice> {
    const { id, ...data } = this.mapper.toPersistence(invoice);
    const result = await this.txClient.invoice.update({
      where: { id },
      data: data as any,
    });
    return this.mapper.toDomain(result as unknown as PersistenceInvoice);
  }

  async delete(id: string): Promise<void> {
    await this.txClient.invoice.delete({ where: { id } });
  }

  async count(tenantId: string): Promise<number> {
    return this.txClient.invoice.count({ where: { tenantId } });
  }

  async getStats(tenantId: string): Promise<{
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
  }> {
    const invoices = await this.txClient.invoice.findMany({ where: { tenantId } });
    return {
      total: invoices.length,
      paid: invoices.filter(i => i.status === 'PAID').length,
      pending: invoices.filter(i => i.status === 'PENDING').length,
      overdue: invoices.filter(i => i.status === 'OVERDUE').length,
      totalAmount: invoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
      paidAmount: invoices.filter(i => i.status === 'PAID').reduce((sum, inv) => sum + Number(inv.amount), 0),
      pendingAmount: invoices.filter(i => i.status === 'PENDING').reduce((sum, inv) => sum + Number(inv.amount), 0),
      overdueAmount: invoices.filter(i => i.status === 'OVERDUE').reduce((sum, inv) => sum + Number(inv.amount), 0),
    };
  }

  // ── Route query helpers ──────────────────────────────────────────
  // These methods provide raw Prisma query patterns used by route handlers.

  async findByIdRaw(id: string, tenantId?: string): Promise<Record<string, unknown> | null> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.txClient.invoice.findFirst({ where }) as Promise<Record<string, unknown> | null>;
  }

  async findManyRaw(params: {
    where?: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, unknown>;
    include?: Record<string, unknown>;
  }): Promise<Record<string, unknown>[]> {
    return this.txClient.invoice.findMany(params) as Promise<Record<string, unknown>[]>;
  }

  async countRaw(where?: Record<string, unknown>): Promise<number> {
    return this.txClient.invoice.count({ where });
  }

  async updateRaw(id: string, data: Record<string, unknown>, tenantId?: string): Promise<Record<string, unknown>> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.txClient.invoice.update({ where, data }) as Promise<Record<string, unknown>>;
  }

  async findOverdueRaw(tenantId: string): Promise<Record<string, unknown>[]> {
    return this.txClient.invoice.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
      include: { client: true },
      orderBy: { dueDate: 'asc' },
    }) as Promise<Record<string, unknown>[]>;
  }

  async findPendingForDateRaw(tenantId: string, date: Date): Promise<Record<string, unknown>[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.txClient.invoice.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        dueDate: { gte: startOfDay, lte: endOfDay },
      },
      include: { client: true },
    }) as Promise<Record<string, unknown>[]>;
  }

  async markAsPaidRaw(id: string, paymentData: {
    paymentMethod: string;
    externalPaymentId: string;
    paidAt: Date;
  }, tenantId?: string): Promise<Record<string, unknown>> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.txClient.invoice.update({
      where,
      data: {
        status: 'PAID',
        paymentMethod: paymentData.paymentMethod as any,
        externalPaymentId: paymentData.externalPaymentId,
        paidAt: paymentData.paidAt,
      },
    }) as Promise<Record<string, unknown>>;
  }

  async getInvoiceWithClientRaw(id: string): Promise<Record<string, unknown> | null> {
    return this.txClient.invoice.findUnique({
      where: { id },
      include: { client: true, tenant: true },
    }) as Promise<Record<string, unknown> | null>;
  }

  async getStatsRaw(tenantId: string): Promise<Record<string, unknown>> {
    const invoices = await this.txClient.invoice.findMany({ where: { tenantId } });
    return {
      total: invoices.length,
      paid: invoices.filter(i => i.status === 'PAID').length,
      pending: invoices.filter(i => i.status === 'PENDING').length,
      overdue: invoices.filter(i => i.status === 'OVERDUE').length,
      cancelled: invoices.filter(i => i.status === 'CANCELLED').length,
      totalInvoiced: invoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
      totalCollected: invoices.filter(i => i.status === 'PAID').reduce((sum, inv) => sum + Number(inv.amount), 0),
      totalOutstanding: invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((sum, inv) => sum + Number(inv.amount), 0),
      overdueRate: invoices.length > 0
        ? Math.round((invoices.filter(i => i.status === 'OVERDUE').length / invoices.length) * 100)
        : 0,
    };
  }
}
