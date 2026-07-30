import { getPrismaClient } from '../prisma.service';
import { BaseRepository } from './base.repository';
import type { TenantRepositoryPort } from '../../../application/ports/repositories/tenant.repository.port';
import type { Tenant } from '../../../domain/entities/tenant';

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

/**
 * Normalizes a raw Prisma row into a domain Tenant,
 * converting date strings to Date objects where needed.
 */
function toTenant(raw: unknown): Tenant {
  const row = raw as Record<string, unknown>;
  if (row && typeof row === 'object') {
    if (typeof row.createdAt === 'string') {
      row.createdAt = new Date(row.createdAt);
    }
    if (typeof row.updatedAt === 'string') {
      row.updatedAt = new Date(row.updatedAt);
    }
  }
  return row as unknown as Tenant;
}

/**
 * Port-compliant Prisma tenant repository.
 * Implements TenantRepositoryPort for use with use cases / factories.
 */
export class PrismaTenantRepository implements TenantRepositoryPort {
  private prisma = getPrismaClient();

  async findById(id: string): Promise<Tenant | null> {
    const result = await this.prisma.tenant.findUnique({ where: { id } });
    return result ? toTenant(result) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const result = await this.prisma.tenant.findUnique({ where: { slug } });
    return result ? toTenant(result) : null;
  }

  async findByEmail(email: string): Promise<Tenant | null> {
    const result = await this.prisma.tenant.findFirst({ where: { email } });
    return result ? toTenant(result) : null;
  }

  async findMany(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: Tenant[]; total: number }> {
    const { page = 1, limit = 10, search } = params;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.tenant.count({ where }),
    ]);
    return { data: data.map(toTenant), total };
  }

  async create(tenant: Tenant): Promise<Tenant> {
    const result = await this.prisma.tenant.create({ data: tenant as any });
    return toTenant(result);
  }

  async update(tenant: Tenant): Promise<Tenant> {
    const { id, ...data } = tenant;
    const result = await this.prisma.tenant.update({
      where: { id },
      data: data as any,
    });
    return toTenant(result);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tenant.delete({ where: { id } });
  }

  async count(): Promise<number> {
    return this.prisma.tenant.count();
  }

  // Extra methods beyond TenantRepositoryPort, used by routes

  async updateConfig(id: string, config: any): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: { config },
    }) as unknown as Tenant;
  }

  async updatePaymentProvider(id: string, provider: string, providerConfig: any): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        paymentProvider: provider,
        paymentProviderConfig: providerConfig,
      },
    }) as unknown as Tenant;
  }

  async updateDecisionConfig(id: string, decisionConfig: any): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: { decisionConfig },
    }) as unknown as Tenant;
  }
}
