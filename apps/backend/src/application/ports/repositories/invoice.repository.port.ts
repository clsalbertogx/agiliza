import type { Invoice } from '@/domain/entities/invoice';

export interface InvoiceRepositoryPort {
  findById(id: string, tenantId?: string): Promise<Invoice | null>;
  findExistingForSubscription(subscriptionId: string, referenceMonth: string): Promise<Invoice | null>;
  findMany(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    status?: string;
    clientId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ data: Invoice[]; total: number }>;
  create(invoice: Invoice): Promise<Invoice>;
  update(invoice: Invoice): Promise<Invoice>;
  delete(id: string): Promise<void>;
  count(tenantId: string): Promise<number>;
  getStats(tenantId: string): Promise<{
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
  }>;
}
