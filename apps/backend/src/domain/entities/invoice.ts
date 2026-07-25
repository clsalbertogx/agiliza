import { z } from 'zod';

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CREDIT_CARD = 'CREDIT_CARD',
}

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.date(),
  description: z.string().optional(),
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.PENDING),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  pixQRCode: z.string().optional(),
  pixCopyPaste: z.string().optional(),
  pixExpiresAt: z.date().optional(),
  externalPaymentId: z.string().optional(),
  paidAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Invoice = z.infer<typeof invoiceSchema>;

export function createInvoice(data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Invoice {
  const invoice: Invoice = {
    id: crypto.randomUUID(),
    status: InvoiceStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
  };
  return invoiceSchema.parse(invoice);
}

export function isOverdue(invoice: Invoice): boolean {
  return invoice.status === InvoiceStatus.PENDING && new Date() > invoice.dueDate;
}

export function canTransitionTo(from: InvoiceStatus, to: InvoiceStatus): boolean {
  const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    [InvoiceStatus.PENDING]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
    [InvoiceStatus.PAID]: [InvoiceStatus.REFUNDED],
    [InvoiceStatus.OVERDUE]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
    [InvoiceStatus.CANCELLED]: [],
    [InvoiceStatus.REFUNDED]: [],
  };
  return allowedTransitions[from]?.includes(to) ?? false;
}
