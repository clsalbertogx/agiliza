import { z } from 'zod';

export enum PaymentProvider {
  ASAAS = 'asaas',
  MERCADO_PAGO = 'mercadopago',
  PAGBANK = 'pagbank',
  POLAR = 'polar',
}

export const tenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  document: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  paymentProvider: z.nativeEnum(PaymentProvider).default(PaymentProvider.ASAAS),
  paymentProviderConfig: z.record(z.unknown()).optional(),
  decisionConfig: z.record(z.unknown()).optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type Tenant = z.infer<typeof tenantSchema>;

export function createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Tenant {
  const tenant: Tenant = {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
  };
  return tenantSchema.parse(tenant);
}