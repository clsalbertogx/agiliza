export interface PaymentProviderConfig {
  id: string;
  tenantId: string;
  provider: string;
  apiKeyEncrypted: string | null;
  environment: string;
  webhookSecret: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentProviderConfigInput {
  tenantId: string;
  provider: string;
  apiKeyEncrypted?: string;
  environment?: string;
  webhookSecret?: string;
  isActive?: boolean;
}