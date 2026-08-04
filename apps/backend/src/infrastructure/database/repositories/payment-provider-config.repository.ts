import type { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import { getPrismaClient } from '@/infrastructure/database/prisma.service';
import { getTransaction } from '@/infrastructure/database/unit-of-work';

export class PrismaPaymentProviderConfigRepository implements PaymentProviderConfigRepositoryPort {
  private prisma = getPrismaClient();

  private get txClient() {
    return getTransaction() ?? this.prisma;
  }

  async upsert(tenantId: string, provider: string, config: { apiKey: string; environment: string }): Promise<void> {
    await this.txClient.paymentProviderConfig.upsert({
      where: {
        tenantId_provider: { tenantId, provider },
      },
      create: {
        tenantId,
        provider,
        apiKeyEncrypted: config.apiKey,
        environment: config.environment,
        isActive: true,
      },
      update: {
        apiKeyEncrypted: config.apiKey,
        environment: config.environment,
        isActive: true,
      },
    });
  }

  async findByTenantAndProvider(
    tenantId: string,
    provider: string,
  ): Promise<{ apiKey: string; environment: string } | null> {
    const result = await this.txClient.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: { tenantId, provider },
      },
    });

    if (!result?.apiKeyEncrypted) {
      return null;
    }

    return {
      apiKey: result.apiKeyEncrypted,
      environment: result.environment,
    };
  }
}
