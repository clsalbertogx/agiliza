import { getPrismaClient } from '../prisma.service';
import { BaseRepository } from './base.repository';

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

  async updateRiskScore(id: string, riskScore: string, reason: any) {
    return this.prisma.client.update({
      where: { id },
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
