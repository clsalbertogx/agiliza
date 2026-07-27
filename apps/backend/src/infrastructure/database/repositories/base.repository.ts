import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../prisma.service';

export abstract class BaseRepository<T> {
  protected prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  protected abstract get model(): any;

  async findById(id: string, tenantId?: string): Promise<T | null> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.model.findFirst({ where }) as T | null;
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
    include?: any;
  }): Promise<T[]> {
    return this.model.findMany(params);
  }

  async create(data: any): Promise<T> {
    return this.model.create({ data });
  }

  async update(id: string, data: any, tenantId?: string): Promise<T> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.model.update({ where, data });
  }

  async delete(id: string, tenantId?: string): Promise<T> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    return this.model.delete({ where });
  }

  async count(where?: any): Promise<number> {
    return this.model.count({ where });
  }
}
