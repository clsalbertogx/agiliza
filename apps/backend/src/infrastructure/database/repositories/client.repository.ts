import { PrismaClient, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class ClientRepository extends BaseRepository<Prisma.ClientGetPayload<{}>> {
  constructor(prisma: PrismaClient) {
    super(prisma);
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
}
