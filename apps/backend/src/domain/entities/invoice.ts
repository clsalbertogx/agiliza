import { DomainError } from '../errors/domain-error';
import { Either, success, failure } from '@/domain/types/either';
import { Money } from '../value-objects/money';

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

export interface Invoice {
  id: string;
  tenantId: string;
  clientId: string;
  amount: number;
  dueDate: Date;
  description?: string;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  pixQRCode?: string;
  pixCopyPaste?: string;
  pixExpiresAt?: Date;
  externalPaymentId?: string;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInvoiceInput {
  tenantId: string;
  clientId: string;
  amount: number;
  dueDate: Date;
  description?: string;
}

export interface PersistenceInvoice {
  id: string;
  tenantId: string;
  clientId: string;
  subscriptionId: string | null;
  amount: number;
  dueDate: Date;
  description: string | null;
  status: string;
  paymentMethod: string | null;
  pixQRCode: string | null;
  pixCopyPaste: string | null;
  pixExpiresAt: Date | null;
  externalPaymentId: string | null;
  paidAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceViewModel {
  id: string;
  tenantId: string;
  clientId: string;
  amount: number;
  amountFormatted: string;
  dueDate: Date;
  description?: string;
  status: string;
  paymentMethod?: string;
  pixQRCode?: string;
  pixCopyPaste?: string;
  pixExpiresAt?: Date;
  externalPaymentId?: string;
  paidAt?: Date;
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function createInvoice(input: CreateInvoiceInput & { id: string }): Either<DomainError, Invoice> {
  let money: Money;
  try {
    money = Money.create(input.amount);
  } catch (e) {
    return failure(new DomainError((e as Error).message));
  }

  if (money.value() <= 0) {
    return failure(new DomainError('Amount must be positive'));
  }

  if (!(input.dueDate instanceof Date) || isNaN(input.dueDate.getTime())) {
    return failure(new DomainError('Invalid due date'));
  }

  const now = new Date();
  const invoice: Invoice = {
    id: input.id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    amount: money.value(),
    dueDate: input.dueDate,
    description: input.description,
    status: InvoiceStatus.PENDING,
    paymentMethod: undefined,
    pixQRCode: undefined,
    pixCopyPaste: undefined,
    pixExpiresAt: undefined,
    externalPaymentId: undefined,
    paidAt: undefined,
    metadata: undefined,
    createdAt: now,
    updatedAt: now,
  };

  return success(invoice);
}

export function createInvoiceFromPersistence(data: PersistenceInvoice): Invoice {
  return {
    id: data.id,
    tenantId: data.tenantId,
    clientId: data.clientId,
    amount: data.amount,
    dueDate: data.dueDate,
    description: data.description ?? undefined,
    status: data.status as InvoiceStatus,
    paymentMethod: data.paymentMethod as PaymentMethod | undefined,
    pixQRCode: data.pixQRCode ?? undefined,
    pixCopyPaste: data.pixCopyPaste ?? undefined,
    pixExpiresAt: data.pixExpiresAt ?? undefined,
    externalPaymentId: data.externalPaymentId ?? undefined,
    paidAt: data.paidAt ?? undefined,
    metadata: data.metadata as Record<string, unknown> | undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function invoiceToPersistence(invoice: Invoice): PersistenceInvoice {
  return {
    id: invoice.id,
    tenantId: invoice.tenantId,
    clientId: invoice.clientId,
    subscriptionId: null,
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    description: invoice.description ?? null,
    status: invoice.status,
    paymentMethod: invoice.paymentMethod ?? null,
    pixQRCode: invoice.pixQRCode ?? null,
    pixCopyPaste: invoice.pixCopyPaste ?? null,
    pixExpiresAt: invoice.pixExpiresAt ?? null,
    externalPaymentId: invoice.externalPaymentId ?? null,
    paidAt: invoice.paidAt ?? null,
    metadata: invoice.metadata ?? null,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export function invoiceToViewModel(invoice: Invoice): InvoiceViewModel {
  const money = Money.create(invoice.amount);
  return {
    id: invoice.id,
    tenantId: invoice.tenantId,
    clientId: invoice.clientId,
    amount: invoice.amount,
    amountFormatted: money.toBRL(),
    dueDate: invoice.dueDate,
    description: invoice.description,
    status: invoice.status,
    paymentMethod: invoice.paymentMethod,
    pixQRCode: invoice.pixQRCode,
    pixCopyPaste: invoice.pixCopyPaste,
    pixExpiresAt: invoice.pixExpiresAt,
    externalPaymentId: invoice.externalPaymentId,
    paidAt: invoice.paidAt,
    isOverdue: invoice.status === InvoiceStatus.PENDING && new Date() > invoice.dueDate,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export function updateInvoice(invoice: Invoice, updates: Partial<Invoice>): Invoice {
  return {
    ...invoice,
    ...updates,
    updatedAt: new Date(),
  };
}

export function isOverdue(invoice: Invoice): boolean {
  return invoice.status === InvoiceStatus.PENDING && new Date() > invoice.dueDate;
}

export function canTransitionTo(current: InvoiceStatus, target: InvoiceStatus): boolean {
  const allowed: Record<InvoiceStatus, InvoiceStatus[]> = {
    [InvoiceStatus.PENDING]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
    [InvoiceStatus.PAID]: [InvoiceStatus.REFUNDED],
    [InvoiceStatus.OVERDUE]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
    [InvoiceStatus.CANCELLED]: [],
    [InvoiceStatus.REFUNDED]: [],
  };
  return allowed[current]?.includes(target) ?? false;
}

import { z } from 'zod';

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  amount: z.number().positive(),
  dueDate: z.date(),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']),
  paymentMethod: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']).optional(),
  pixQRCode: z.string().optional(),
  pixCopyPaste: z.string().optional(),
  pixExpiresAt: z.date().optional(),
  externalPaymentId: z.string().optional(),
  paidAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});