import { getPrismaClient } from '@/infrastructure/database/prisma.service';
import { getTransaction } from '@/infrastructure/database/unit-of-work';
import type { TenantRepositoryPort } from '@/application/ports/repositories/tenant.repository.port';
import type { Tenant } from '@/domain/entities/tenant';
import { TenantMapper, type PersistenceTenant } from '@/infrastructure/database/mappers/tenant.mapper';

/**
 * Port-compliant Prisma tenant repository.
 * Implements TenantRepositoryPort for use with use cases / factories.
 * Uses a DomainMapper for standardized toDomain/toPersistence mapping.
 *
 * All database operations automatically participate in the ambient
 * Unit of Work transaction when one is active (see PrismaUnitOfWork).
 */
export class PrismaTenantRepository implements TenantRepositoryPort {
  private prisma = getPrismaClient();
  private readonly mapper: TenantMapper;

  constructor(mapper?: TenantMapper) {
    this.mapper = mapper ?? new TenantMapper();
  }

  /**
   * Returns the transactional Prisma client when called inside a
   * PrismaUnitOfWork.execute() callback, or the regular client otherwise.
   */
  private get txClient() {
    return getTransaction() ?? this.prisma;
  }

  async findById(id: string): Promise<Tenant | null> {
    const result = await this.txClient.tenant.findUnique({ where: { id } });
    return result ? this.mapper.toDomain(result as unknown as PersistenceTenant) : null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const result = await this.txClient.tenant.findUnique({ where: { slug } });
    return result ? this.mapper.toDomain(result as unknown as PersistenceTenant) : null;
  }

  async findByEmail(email: string): Promise<Tenant | null> {
    const result = await this.txClient.tenant.findFirst({ where: { email } });
    return result ? this.mapper.toDomain(result as unknown as PersistenceTenant) : null;
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
      this.txClient.tenant.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.txClient.tenant.count({ where }),
    ]);
    return { data: data.map((r) => this.mapper.toDomain(r as unknown as PersistenceTenant)), total };
  }

  async create(tenant: Tenant): Promise<Tenant> {
    const persistence = this.mapper.toPersistence(tenant);
    const result = await this.txClient.tenant.create({ data: persistence as any });
    return this.mapper.toDomain(result as unknown as PersistenceTenant);
  }

  async update(tenant: Tenant): Promise<Tenant> {
    const { id, ...data } = this.mapper.toPersistence(tenant);
    const result = await this.txClient.tenant.update({
      where: { id },
      data: data as any,
    });
    return this.mapper.toDomain(result as unknown as PersistenceTenant);
  }

  async delete(id: string): Promise<void> {
    await this.txClient.tenant.delete({ where: { id } });
  }

  async count(): Promise<number> {
    return this.txClient.tenant.count();
  }

  // Extra methods beyond TenantRepositoryPort, used by routes

  async updateConfig(id: string, config: Record<string, unknown>): Promise<Tenant> {
    return this.txClient.tenant.update({
      where: { id },
      data: { config: config as any },
    }) as unknown as Tenant;
  }

  async updatePaymentProvider(id: string, provider: string, providerConfig: Record<string, unknown>): Promise<Tenant> {
    return this.txClient.tenant.update({
      where: { id },
      data: {
        paymentProvider: provider,
        paymentProviderConfig: providerConfig as any,
      },
    }) as unknown as Tenant;
  }

  async updateDecisionConfig(id: string, decisionConfig: Record<string, unknown>): Promise<Tenant> {
    return this.txClient.tenant.update({
      where: { id },
      data: { decisionConfig: decisionConfig as any },
    }) as unknown as Tenant;
  }
}
