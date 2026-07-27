import { BaseRepository } from './base.repository';

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
