import { UpsertPaymentProviderConfigUseCase } from '@/application/usecases/upsert-payment-provider-config.usecase';
import { createEncryptionService } from './create-encryption.factory';
import { createPaymentProviderConfigRepository } from './create-payment-provider-config-repository.factory';

export function createUpsertPaymentProviderConfigUseCase(): UpsertPaymentProviderConfigUseCase {
  return new UpsertPaymentProviderConfigUseCase(createPaymentProviderConfigRepository(), createEncryptionService());
}
