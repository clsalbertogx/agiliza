import { getPrismaClient } from '../prisma.service';
import { BaseRepository } from './base.repository';
import type { ClientRepositoryPort } from '../../../application/ports/repositories/client.repository.port';
import type { Client } from '../../../domain/entities/client';

export class ClientRepository extends BaseRepository<any> {
  constructor() {
    super();
  }

  protected get model() {
    return this.prisma.client;
  }

  async findByPhone(tenantId: string, phone: string) {
    return this.prisma.client.findFirst({
      where: { tenantId, phone },
    });
  }

  async findByRiskScore(tenantId: string, riskScore: string) {
    return this.prisma.client.findMany({
      where: { tenantId, riskScore: riskScore as any },
      include: {
        invoices: {
          where: { status: 'PENDING' },
          take: 5,
          orderBy: { dueDate: 'asc' },
        },
      },
    });
  }

  async updateRiskScore(id: string, riskScore: string, reason: any, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.client.update({
      where,
      data: {
        riskScore: riskScore as any,
        riskScoreReason: reason,
        riskScoreUpdatedAt: new Date(),
      },
    });
  }

  async search(tenantId: string, query: string, skip = 0, take = 10) {
    return this.prisma.client.findMany({
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
    });
  }
}

/**
 * Normalizes a raw Prisma row into a domain Client,
 * converting date strings to Date objects where needed.
 */
function toClient(raw: unknown): Client {
  const row = raw as Record<string, unknown>;
  if (row && typeof row === 'object') {
    if (typeof row.riskScoreUpdatedAt === 'string') {
      row.riskScoreUpdatedAt = new Date(row.riskScoreUpdatedAt);
    }
    if (typeof row.createdAt === 'string') {
      row.createdAt = new Date(row.createdAt);
    }
    if (typeof row.updatedAt === 'string') {
      row.updatedAt = new Date(row.updatedAt);
    }
  }
  return row as unknown as Client;
}

/**
 * Port-compliant Prisma client repository.
 * Implements ClientRepositoryPort for use with use cases.
 */
export class PrismaClientRepository implements ClientRepositoryPort {
  private prisma = getPrismaClient();

  async findById(id: string): Promise<Client | null> {
    const result = await this.prisma.client.findUnique({ where: { id } });
    return result ? toClient(result) : null;
  }

  async findByPhone(phone: string, tenantId: string): Promise<Client | null> {
    const result = await this.prisma.client.findFirst({
      where: { tenantId, phone },
    });
    return result ? toClient(result) : null;
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
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.client.count({ where }),
    ]);
    return { data: data.map(toClient), total };
  }

  async create(client: Client): Promise<Client> {
    const result = await this.prisma.client.create({ data: client as any });
    return toClient(result);
  }

  async update(client: Client): Promise<Client> {
    const { id, ...data } = client;
    const result = await this.prisma.client.update({
      where: { id },
      data: data as any,
    });
    return toClient(result);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.delete({ where: { id } });
  }

  async count(tenantId: string): Promise<number> {
    return this.prisma.client.count({ where: { tenantId } });
  }
}
