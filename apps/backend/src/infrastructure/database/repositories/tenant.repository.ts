import { getPrismaClient } from '../prisma.service';
import { BaseRepository } from './base.repository';

export class TenantRepository extends BaseRepository<any> {
  constructor() {
    super();
  }

  protected get model() {
    return this.prisma.tenant;
  }

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
    });
  }

  async updateConfig(id: string, config: any) {
    return this.prisma.tenant.update({
      where: { id },
      data: { config },
    });
  }

  async updatePaymentProvider(id: string, provider: string, providerConfig: any) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        paymentProvider: provider,
        paymentProviderConfig: providerConfig,
      },
    });
  }

  async updateDecisionConfig(id: string, decisionConfig: any) {
    return this.prisma.tenant.update({
      where: { id },
      data: { decisionConfig },
    });
  }
}
