import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { Client, RiskScore } from '@/domain/entities/client';
import { ClientMapper, type PersistenceClient } from '@/infrastructure/database/mappers/client.mapper';
import { getPrismaClient } from '@/infrastructure/database/prisma.service';
import { getTransaction } from '@/infrastructure/database/unit-of-work';

/**
 * Port-compliant Prisma client repository.
 * Implements ClientRepositoryPort for use with use cases.
 * Uses a DomainMapper for standardized toDomain/toPersistence mapping.
 *
 * All database operations automatically participate in the ambient
 * Unit of Work transaction when one is active (see PrismaUnitOfWork).
 */
export class PrismaClientRepository implements ClientRepositoryPort {
  private prisma = getPrismaClient();
  private readonly mapper: ClientMapper;

  constructor(mapper?: ClientMapper) {
    this.mapper = mapper ?? new ClientMapper();
  }

  /**
   * Returns the transactional Prisma client when called inside a
   * PrismaUnitOfWork.execute() callback, or the regular client otherwise.
   */
  private get txClient() {
    return getTransaction() ?? this.prisma;
  }

  async findById(id: string, tenantId?: string): Promise<Client | null> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const result = await this.txClient.client.findFirst({ where });
    return result ? this.mapper.toDomain(result as unknown as PersistenceClient) : null;
  }

  async findByPhone(phone: string, tenantId: string): Promise<Client | null> {
    const result = await this.txClient.client.findFirst({
      where: { tenantId, phone },
    });
    return result ? this.mapper.toDomain(result as unknown as PersistenceClient) : null;
  }

  async findMany(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ data: Client[]; total: number }> {
    const { tenantId, page = 1, limit = 10, search, status } = params;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (status) where.riskScore = status;
    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }];
    }
    const [data, total] = await Promise.all([
      this.txClient.client.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.txClient.client.count({ where }),
    ]);
    return { data: data.map((r) => this.mapper.toDomain(r as unknown as PersistenceClient)), total };
  }

  async create(client: Client): Promise<Client> {
    const persistence = this.mapper.toPersistence(client);
    const result = await this.txClient.client.create({ data: persistence as any });
    return this.mapper.toDomain(result as unknown as PersistenceClient);
  }

  async update(client: Client): Promise<Client> {
    const { id, ...data } = this.mapper.toPersistence(client);
    const result = await this.txClient.client.update({
      where: { id },
      data: data as any,
    });
    return this.mapper.toDomain(result as unknown as PersistenceClient);
  }

  async delete(id: string): Promise<void> {
    await this.txClient.client.delete({ where: { id } });
  }

  async count(tenantId: string): Promise<number> {
    return this.txClient.client.count({ where: { tenantId } });
  }

  async updateRiskScore(id: string, riskScore: RiskScore, riskScoreReason?: string): Promise<void> {
    await this.txClient.client.update({
      where: { id },
      data: {
        riskScore: riskScore as any,
        riskScoreUpdatedAt: new Date(),
        ...(riskScoreReason !== undefined ? { riskScoreReason } : {}),
      },
    });
  }

  // ── Route query helpers ──────────────────────────────────────────
  // These methods provide raw Prisma query patterns used by route handlers.
  // They operate on the same prisma client but accept query parameters
  // directly rather than domain entities. This avoids breaking route-level
  // queries while the legacy query class is removed.

  async findByIdRaw(id: string, tenantId?: string): Promise<Record<string, unknown> | null> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.txClient.client.findFirst({ where }) as Promise<Record<string, unknown> | null>;
  }

  async findManyRaw(params: {
    where?: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, string>;
    include?: Record<string, unknown>;
  }): Promise<Record<string, unknown>[]> {
    return this.txClient.client.findMany(params) as Promise<Record<string, unknown>[]>;
  }

  async countRaw(where?: Record<string, unknown>): Promise<number> {
    return this.txClient.client.count({ where });
  }

  async updateRaw(id: string, data: Record<string, unknown>, tenantId?: string): Promise<Record<string, unknown>> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.txClient.client.update({ where, data }) as Promise<Record<string, unknown>>;
  }

  async findByPhoneRaw(tenantId: string, phone: string): Promise<Record<string, unknown> | null> {
    return this.txClient.client.findFirst({
      where: { tenantId, phone },
    }) as Promise<Record<string, unknown> | null>;
  }

  async searchRaw(tenantId: string, query: string, skip = 0, take = 10): Promise<Record<string, unknown>[]> {
    return this.txClient.client.findMany({
      where: {
        tenantId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }) as Promise<Record<string, unknown>[]>;
  }

  async findByRiskScoreRaw(tenantId: string, riskScore: string): Promise<Record<string, unknown>[]> {
    return this.txClient.client.findMany({
      where: { tenantId, riskScore: riskScore as any },
      include: {
        invoices: {
          where: { status: 'PENDING' },
          take: 5,
          orderBy: { dueDate: 'asc' },
        },
      },
    }) as Promise<Record<string, unknown>[]>;
  }

  async updateRiskScoreRaw(
    id: string,
    riskScore: string,
    reason: unknown,
    tenantId?: string,
  ): Promise<Record<string, unknown>> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.txClient.client.update({
      where,
      data: {
        riskScore: riskScore as any,
        riskScoreReason: reason as any,
        riskScoreUpdatedAt: new Date(),
      },
    }) as Promise<Record<string, unknown>>;
  }
}
