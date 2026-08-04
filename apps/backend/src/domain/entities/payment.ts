import { type Either, failure, success } from '@/domain/types/either';
import { DomainError } from '../errors/domain-error';
import { Money } from '../value-objects/money';

export enum PaymentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProvider {
  ASAAS = 'ASAAS',
  MERCADO_PAGO = 'MERCADO_PAGO',
  STRIPE = 'STRIPE',
  PAGBANK = 'PAGBANK',
  POLAR = 'POLAR',
}

export interface Payment {
  id: string;
  invoiceId: string;
  tenantId: string;
  clientId: string;
  amount: number;
  method: string;
  provider: PaymentProvider | string;
  providerPaymentId?: string;
  status: PaymentStatus;
  fee?: number;
  netAmount?: number;
  webhookReceivedAt?: Date;
  webhookRetryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentInput {
  tenantId: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  provider: PaymentProvider;
  externalId?: string;
  paymentMethod?: string;
}

export interface PersistencePayment {
  id: string;
  invoiceId: string;
  tenantId: string;
  clientId: string;
  amount: number;
  method: string;
  provider: string;
  providerPaymentId: string | null;
  status: string;
  fee: number | null;
  netAmount: number | null;
  webhookReceivedAt: Date | null;
  webhookRetryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentViewModel {
  id: string;
  tenantId: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  amountFormatted: string;
  provider: string;
  externalId?: string;
  status: string;
  paymentMethod?: string;
  paidAt?: Date;
  failedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createPayment(input: CreatePaymentInput & { id: string }): Either<DomainError, Payment> {
  let money: Money;
  try {
    money = Money.create(input.amount);
  } catch (e) {
    return failure(new DomainError((e as Error).message));
  }

  if (money.value() <= 0) {
    return failure(new DomainError('Amount must be positive'));
  }

  const now = new Date();
  const payment: Payment = {
    id: input.id,
    invoiceId: input.invoiceId,
    tenantId: input.tenantId,
    clientId: input.clientId,
    amount: money.value(),
    method: input.paymentMethod || '',
    provider: input.provider,
    providerPaymentId: input.externalId,
    status: PaymentStatus.PENDING,
    fee: undefined,
    netAmount: undefined,
    webhookReceivedAt: undefined,
    webhookRetryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  return success(payment);
}

export function createPaymentFromPersistence(data: PersistencePayment): Payment {
  return {
    id: data.id,
    invoiceId: data.invoiceId,
    tenantId: data.tenantId,
    clientId: data.clientId,
    amount: data.amount,
    method: data.method,
    provider: data.provider as PaymentProvider,
    providerPaymentId: data.providerPaymentId ?? undefined,
    status: data.status as PaymentStatus,
    fee: data.fee ?? undefined,
    netAmount: data.netAmount ?? undefined,
    webhookReceivedAt: data.webhookReceivedAt ?? undefined,
    webhookRetryCount: data.webhookRetryCount,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function paymentToPersistence(payment: Payment): PersistencePayment {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    tenantId: payment.tenantId,
    clientId: payment.clientId,
    amount: payment.amount,
    method: payment.method,
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId ?? null,
    status: payment.status,
    fee: payment.fee ?? null,
    netAmount: payment.netAmount ?? null,
    webhookReceivedAt: payment.webhookReceivedAt ?? null,
    webhookRetryCount: payment.webhookRetryCount,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

export function paymentToViewModel(payment: Payment): PaymentViewModel {
  const money = Money.create(payment.amount);
  return {
    id: payment.id,
    tenantId: payment.tenantId,
    invoiceId: payment.invoiceId,
    clientId: payment.clientId,
    amount: payment.amount,
    amountFormatted: money.toBRL(),
    provider: payment.provider,
    externalId: payment.providerPaymentId,
    status: payment.status,
    paymentMethod: payment.method,
    paidAt: undefined,
    failedReason: undefined,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

export function updatePayment(payment: Payment, updates: Partial<Payment>): Payment {
  return {
    ...payment,
    ...updates,
    updatedAt: new Date(),
  };
}

import { z } from 'zod';

export const paymentSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.string(),
  provider: z.enum(['ASAAS', 'MERCADO_PAGO', 'STRIPE', 'PAGBANK', 'POLAR']),
  providerPaymentId: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'REFUNDED']),
  fee: z.number().optional(),
  netAmount: z.number().optional(),
  webhookReceivedAt: z.date().optional(),
  webhookRetryCount: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});
