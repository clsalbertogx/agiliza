export interface PaymentProviderConfigRepositoryPort {
  upsert(tenantId: string, provider: string, config: { apiKey: string; environment: string }): Promise<void>;
  findByTenantAndProvider(tenantId: string, provider: string): Promise<{ apiKey: string; environment: string } | null>;
}