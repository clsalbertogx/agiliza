import { PrismaClient } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class InvoiceRepository extends BaseRepository<any> {
  constructor(prisma: PrismaClient) {
    super(prisma);
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
  }) {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentMethod: paymentData.paymentMethod as any,
        externalPaymentId: paymentData.externalPaymentId,
        paidAt: paymentData.paidAt,
      },
    });
  }
}
