import { Phone } from '../value-objects/phone';
import { Email } from '../value-objects/email';
import { TaxId } from '../value-objects/tax-id';
import { RiskScore, RiskLevel } from '../value-objects/risk-score';
import { DomainError } from '../errors/domain-error';
import { Either, success, failure } from '@/application/types/either';

export { RiskScore, RiskLevel } from '../value-objects/risk-score';

export enum MessageChannel {
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
}

export interface Client {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  preferredChannel: MessageChannel;
  preferredTime?: string;
  preferredLeadDays: number;
  riskScore: RiskScore;
  riskScoreReason?: unknown;
  riskScoreUpdatedAt?: Date;
  totalInvoices: number;
  paidInvoices: number;
  avgPaymentDelay: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateClientInput {
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  preferredChannel?: MessageChannel;
  preferredTime?: string;
  preferredLeadDays?: number;
}

export interface PersistenceClient {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  document: string | null;
  preferredChannel: string;
  preferredTime: string | null;
  preferredLeadDays: number;
  riskScore: string;
  riskScoreReason: unknown;
  riskScoreUpdatedAt: Date | null;
  totalInvoices: number;
  paidInvoices: number;
  avgPaymentDelay: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientViewModel {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  phoneFormatted: string;
  email?: string;
  document?: string;
  documentFormatted?: string;
  preferredChannel: string;
  preferredTime?: string;
  preferredLeadDays: number;
  riskScore: string;
  riskScoreReason?: unknown;
  riskScoreUpdatedAt?: Date;
  totalInvoices: number;
  paidInvoices: number;
  avgPaymentDelay: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createClient(input: CreateClientInput & { id: string }): Either<DomainError, Client> {
  if (!input.name || input.name.length < 1 || input.name.length > 255) {
    return failure(new DomainError('Name must be between 1 and 255 characters'));
  }

  let phoneVO: Phone;
  try {
    phoneVO = Phone.create(input.phone);
  } catch (e) {
    return failure(new DomainError((e as Error).message));
  }

  let emailVO: Email | undefined;
  if (input.email) {
    try {
      emailVO = Email.create(input.email);
    } catch (e) {
      return failure(new DomainError((e as Error).message));
    }
  }

  let documentVO: TaxId | undefined;
  if (input.document) {
    try {
      documentVO = TaxId.create(input.document);
    } catch (e) {
      return failure(new DomainError((e as Error).message));
    }
  }

  const now = new Date();
  const client: Client = {
    id: input.id,
    tenantId: input.tenantId,
    name: input.name,
    phone: phoneVO.value(),
    email: emailVO?.value(),
    document: documentVO?.value(),
    preferredChannel: input.preferredChannel || MessageChannel.WHATSAPP,
    preferredTime: input.preferredTime,
    preferredLeadDays: input.preferredLeadDays || 3,
    riskScore: RiskScore.fromProbability(0.1),
    riskScoreReason: undefined,
    riskScoreUpdatedAt: undefined,
    totalInvoices: 0,
    paidInvoices: 0,
    avgPaymentDelay: null,
    createdAt: now,
    updatedAt: now,
  };

  return success(client);
}

export function createClientFromPersistence(data: PersistenceClient): Client {
  return {
    id: data.id,
    tenantId: data.tenantId,
    name: data.name,
    phone: data.phone,
    email: data.email ?? undefined,
    document: data.document ?? undefined,
    preferredChannel: data.preferredChannel as MessageChannel,
    preferredTime: data.preferredTime ?? undefined,
    preferredLeadDays: data.preferredLeadDays,
    riskScore: RiskScore.create({ level: data.riskScore as RiskLevel, probability: 0.1 }),
    riskScoreReason: data.riskScoreReason,
    riskScoreUpdatedAt: data.riskScoreUpdatedAt ?? undefined,
    totalInvoices: data.totalInvoices,
    paidInvoices: data.paidInvoices,
    avgPaymentDelay: data.avgPaymentDelay,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function clientToPersistence(client: Client): PersistenceClient {
  return {
    id: client.id,
    tenantId: client.tenantId,
    name: client.name,
    phone: client.phone,
    email: client.email ?? null,
    document: client.document ?? null,
    preferredChannel: client.preferredChannel,
    preferredTime: client.preferredTime ?? null,
    preferredLeadDays: client.preferredLeadDays,
    riskScore: client.riskScore.levelValue,
    riskScoreReason: client.riskScoreReason ?? null,
    riskScoreUpdatedAt: client.riskScoreUpdatedAt ?? null,
    totalInvoices: client.totalInvoices,
    paidInvoices: client.paidInvoices,
    avgPaymentDelay: client.avgPaymentDelay,
    createdAt: client.createdAt ?? new Date(),
    updatedAt: client.updatedAt ?? new Date(),
  };
}

export function clientToViewModel(client: Client): ClientViewModel {
  const phoneVO = Phone.create(client.phone);
  const emailVO = client.email ? Email.create(client.email) : undefined;
  const documentVO = client.document ? TaxId.create(client.document) : undefined;

  return {
    id: client.id,
    tenantId: client.tenantId,
    name: client.name,
    phone: client.phone,
    phoneFormatted: phoneVO.formatted(),
    email: client.email,
    document: client.document,
    documentFormatted: documentVO?.formatted(),
    preferredChannel: client.preferredChannel,
    preferredTime: client.preferredTime,
    preferredLeadDays: client.preferredLeadDays,
    riskScore: client.riskScore.levelValue,
    riskScoreReason: client.riskScoreReason,
    riskScoreUpdatedAt: client.riskScoreUpdatedAt,
    totalInvoices: client.totalInvoices,
    paidInvoices: client.paidInvoices,
    avgPaymentDelay: client.avgPaymentDelay,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export function updateClient(client: Client, updates: Partial<Client>): Client {
  return {
    ...client,
    ...updates,
    updatedAt: new Date(),
  };
}

import { z } from 'zod';

export const clientSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  document: z.string().optional(),
  preferredChannel: z.enum(['WHATSAPP', 'SMS', 'EMAIL']),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  preferredLeadDays: z.number().int().min(1).max(14),
  riskScore: z.custom<RiskScore>(),
  riskScoreReason: z.unknown().optional(),
  riskScoreUpdatedAt: z.date().optional(),
  totalInvoices: z.number().int().min(0),
  paidInvoices: z.number().int().min(0),
  avgPaymentDelay: z.number().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});