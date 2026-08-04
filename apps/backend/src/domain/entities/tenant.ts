import { type Either, failure, success } from '@/domain/types/either';
import { DomainError } from '../errors/domain-error';

export enum PaymentProvider {
  ASAAS = 'ASAAS',
  MERCADO_PAGO = 'MERCADO_PAGO',
  STRIPE = 'STRIPE',
  PAGBANK = 'PAGBANK',
  POLAR = 'POLAR',
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  document?: string;
  email: string;
  phone?: string;
  config?: Record<string, unknown>;
  paymentProvider: PaymentProvider;
  paymentProviderConfig?: Record<string, unknown>;
  decisionConfig?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  document?: string;
  email: string;
  phone?: string;
  config?: Record<string, unknown>;
  paymentProvider?: PaymentProvider;
  paymentProviderConfig?: Record<string, unknown>;
  decisionConfig?: Record<string, unknown>;
}

export interface PersistenceTenant {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  email: string;
  phone: string | null;
  config: unknown;
  paymentProvider: string;
  paymentProviderConfig: unknown;
  decisionConfig: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantViewModel {
  id: string;
  name: string;
  slug: string;
  document?: string;
  email: string;
  phone?: string;
  config?: Record<string, unknown>;
  paymentProvider: string;
  paymentProviderConfig?: Record<string, unknown>;
  decisionConfig?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export function createTenant(input: CreateTenantInput & { id: string }): Either<DomainError, Tenant> {
  if (!input.name || input.name.length > 255) {
    return failure(new DomainError('Name must be 1-255 characters'));
  }
  if (!input.slug || input.slug.length > 100) {
    return failure(new DomainError('Slug must be 1-100 characters'));
  }
  if (!input.email || !input.email.includes('@')) {
    return failure(new DomainError('Invalid email'));
  }

  const now = new Date();
  const tenant: Tenant = {
    id: input.id,
    name: input.name,
    slug: input.slug,
    document: input.document,
    email: input.email,
    phone: input.phone,
    config: input.config,
    paymentProvider: input.paymentProvider || PaymentProvider.ASAAS,
    paymentProviderConfig: input.paymentProviderConfig,
    decisionConfig: input.decisionConfig,
    createdAt: now,
    updatedAt: now,
  };

  return success(tenant);
}

export function createTenantFromPersistence(data: PersistenceTenant): Tenant {
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    document: data.document ?? undefined,
    email: data.email,
    phone: data.phone ?? undefined,
    config: data.config as Record<string, unknown> | undefined,
    paymentProvider: data.paymentProvider as PaymentProvider,
    paymentProviderConfig: data.paymentProviderConfig as Record<string, unknown> | undefined,
    decisionConfig: data.decisionConfig as Record<string, unknown> | undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function tenantToPersistence(tenant: Tenant): PersistenceTenant {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    document: tenant.document ?? null,
    email: tenant.email,
    phone: tenant.phone ?? null,
    config: tenant.config ?? null,
    paymentProvider: tenant.paymentProvider,
    paymentProviderConfig: tenant.paymentProviderConfig ?? null,
    decisionConfig: tenant.decisionConfig ?? null,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

export function tenantToViewModel(tenant: Tenant): TenantViewModel {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    document: tenant.document,
    email: tenant.email,
    phone: tenant.phone,
    config: tenant.config,
    paymentProvider: tenant.paymentProvider,
    paymentProviderConfig: tenant.paymentProviderConfig,
    decisionConfig: tenant.decisionConfig,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

export function updateTenant(tenant: Tenant, updates: Partial<Tenant>): Tenant {
  return {
    ...tenant,
    ...updates,
    updatedAt: new Date(),
  };
}
