import type { Payment } from '@/domain/entities/payment';

export interface PaymentRepositoryPort {
  create(payment: Payment): Promise<Payment>;
  findByInvoiceId(invoiceId: string, tenantId: string): Promise<Payment[]>;
  findById(id: string): Promise<Payment | null>;
}
