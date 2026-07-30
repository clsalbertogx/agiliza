import { BaseRepository } from './base.repository';
import type { InvoiceRepositoryPort } from '../../../application/ports/repositories/invoice.repository.port';
import type { Invoice } from '../../../domain/entities/invoice';
import { getPrismaClient } from '../prisma.service';

export class InvoiceRepository extends BaseRepository<any> {
  constructor() {
    super();
  }

  protected get model() {
    return this.prisma.invoice;
  }

  async findOverdue(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        dueDate: { lt: new Date() },
      },
      include: { client: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findPendingForDate(tenantId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: 'PENDING',
        dueDate: { gte: startOfDay, lte: endOfDay },
      },
      include: { client: true },
    });
  }

  async markAsPaid(id: string, paymentData: {
    paymentMethod: string;
    externalPaymentId: string;
    paidAt: Date;
  }, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.invoice.update({
      where,
      data: {
        status: 'PAID',
        paymentMethod: paymentData.paymentMethod as any,
        externalPaymentId: paymentData.externalPaymentId,
        paidAt: paymentData.paidAt,
      },
    });
  }

  async getInvoiceWithClient(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        tenant: true,
      },
    });
  }

  async getStats(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId },
    });

    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalCollected = invoices
      .filter(inv => inv.status === 'PAID')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalOutstanding = invoices
      .filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);

    return {
      total: invoices.length,
      paid: invoices.filter(i => i.status === 'PAID').length,
      pending: invoices.filter(i => i.status === 'PENDING').length,
      overdue: invoices.filter(i => i.status === 'OVERDUE').length,
      cancelled: invoices.filter(i => i.status === 'CANCELLED').length,
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      overdueRate: invoices.length > 0 
        ? Math.round((invoices.filter(i => i.status === 'OVERDUE').length / invoices.length) * 100) 
        : 0,
    };
  }
}

/**
 * Normalizes a raw Prisma row into a domain Invoice,
 * converting date strings to Date objects where needed.
 */
function toInvoice(raw: unknown): Invoice {
  const row = raw as Record<string, unknown>;
  if (row && typeof row === 'object') {
    if (typeof row.dueDate === 'string') row.dueDate = new Date(row.dueDate);
    if (typeof row.pixExpiresAt === 'string') row.pixExpiresAt = new Date(row.pixExpiresAt);
    if (typeof row.paidAt === 'string') row.paidAt = new Date(row.paidAt);
    if (typeof row.createdAt === 'string') row.createdAt = new Date(row.createdAt);
    if (typeof row.updatedAt === 'string') row.updatedAt = new Date(row.updatedAt);
  }
  return row as unknown as Invoice;
}

/**
 * Port-compliant Prisma invoice repository.
 * Implements InvoiceRepositoryPort for use with use cases.
 */
export class PrismaInvoiceRepository implements InvoiceRepositoryPort {
  private prisma = getPrismaClient();

  async findById(id: string): Promise<Invoice | null> {
    const result = await this.prisma.invoice.findUnique({ where: { id } });
    return result ? toInvoice(result) : null;
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
      this.prisma.invoice.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data: data.map(toInvoice), total };
  }

  async create(invoice: Invoice): Promise<Invoice> {
    const result = await this.prisma.invoice.create({ data: invoice as any });
    return toInvoice(result);
  }

  async update(invoice: Invoice): Promise<Invoice> {
    const { id, ...data } = invoice;
    const result = await this.prisma.invoice.update({
      where: { id },
      data: data as any,
    });
    return toInvoice(result);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.invoice.delete({ where: { id } });
  }

  async count(tenantId: string): Promise<number> {
    return this.prisma.invoice.count({ where: { tenantId } });
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
    const invoices = await this.prisma.invoice.findMany({ where: { tenantId } });
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
}
