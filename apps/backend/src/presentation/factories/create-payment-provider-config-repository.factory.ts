import { PrismaPaymentProviderConfigRepository } from '@/infrastructure/database/repositories/payment-provider-config.repository';

export function createPaymentProviderConfigRepository(): PrismaPaymentProviderConfigRepository {
  return new PrismaPaymentProviderConfigRepository();
}