import { PaymentMethod } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class PaymentRepository extends BaseRepository<any> {
  constructor() {
    super();
  }

  protected get model() {
    return this.prisma.payment;
  }

  async createPayment(data: {
    invoiceId: string;
    tenantId: string;
    clientId: string;
    amount: number;
    method: string;
    provider: string;
    providerPaymentId?: string;
  }) {
    return this.prisma.payment.create({
      data: {
        invoiceId: data.invoiceId,
        tenantId: data.tenantId,
        clientId: data.clientId,
        amount: data.amount,
        method: data.method as PaymentMethod,
        provider: data.provider,
        providerPaymentId: data.providerPaymentId,
      },
    });
  }

  async findByProviderId(provider: string, providerPaymentId: string) {
    return this.prisma.payment.findFirst({
      where: { provider, providerPaymentId },
    });
  }

  async confirmPayment(providerPaymentId: string) {
    // Use updateMany since providerPaymentId is not a unique field in Prisma
    const result = await this.prisma.payment.updateMany({
      where: { providerPaymentId },
      data: { status: 'confirmed' },
    });
    return result.count > 0;
  }
}
