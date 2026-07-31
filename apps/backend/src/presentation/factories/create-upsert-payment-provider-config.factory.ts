import { UpsertPaymentProviderConfigUseCase } from '@/application/usecases/upsert-payment-provider-config.usecase';
import { createPaymentProviderConfigRepository } from './create-payment-provider-config-repository.factory';
import { createEncryptionService } from './create-encryption.factory';

export function createUpsertPaymentProviderConfigUseCase(): UpsertPaymentProviderConfigUseCase {
  return new UpsertPaymentProviderConfigUseCase(
    createPaymentProviderConfigRepository(),
    createEncryptionService(),
  );
}