import { getPrismaClient } from '@/infrastructure/database/prisma.service';
import { getTransaction } from '@/infrastructure/database/unit-of-work';
import type { SubscriptionRepositoryPort } from '@/application/ports/repositories/subscription.repository.port';
import type { Subscription } from '@/domain/entities/subscription';
import { SubscriptionMapper, type PersistenceSubscription } from '@/infrastructure/database/mappers/subscription.mapper';

/**
 * Port-compliant Prisma subscription repository.
 * Implements SubscriptionRepositoryPort for use with use cases.
 * Uses a DomainMapper for standardized toDomain/toPersistence mapping.
 *
 * All database operations automatically participate in the ambient
 * Unit of Work transaction when one is active (see PrismaUnitOfWork).
 */
export class PrismaSubscriptionRepository implements SubscriptionRepositoryPort {
  private prisma = getPrismaClient();
  private readonly mapper: SubscriptionMapper;

  constructor(mapper?: SubscriptionMapper) {
    this.mapper = mapper ?? new SubscriptionMapper();
  }

  /**
   * Returns the transactional Prisma client when called inside a
   * PrismaUnitOfWork.execute() callback, or the regular client otherwise.
   */
  private get txClient() {
    return getTransaction() ?? this.prisma;
  }

  async create(subscription: Subscription): Promise<Subscription> {
    const persistence = this.mapper.toPersistence(subscription);
    const result = await this.txClient.subscription.create({ data: persistence as any });
    return this.mapper.toDomain(result as unknown as PersistenceSubscription);
  }

  async findById(id: string, tenantId?: string): Promise<Subscription | null> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const result = await this.txClient.subscription.findFirst({ where });
    return result ? this.mapper.toDomain(result as unknown as PersistenceSubscription) : null;
  }

  async findByTenantId(tenantId: string): Promise<Subscription[]> {
    const result = await this.txClient.subscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return result.map((r) => this.mapper.toDomain(r as unknown as PersistenceSubscription));
  }

  async findByClientId(clientId: string, tenantId?: string): Promise<Subscription[]> {
    const where: any = { clientId };
    if (tenantId) where.tenantId = tenantId;
    const result = await this.txClient.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return result.map((r) => this.mapper.toDomain(r as unknown as PersistenceSubscription));
  }

  async findActiveByNextBillingBefore(date: Date): Promise<Subscription[]> {
    const result = await this.txClient.subscription.findMany({
      where: {
        status: 'ACTIVE',
        nextBilling: { lte: date },
      },
      orderBy: { nextBilling: 'asc' },
    });
    return result.map((r) => this.mapper.toDomain(r as unknown as PersistenceSubscription));
  }

  async findDueForRenewal(from: Date, to: Date): Promise<Subscription[]> {
    const result = await this.txClient.subscription.findMany({
      where: {
        nextBilling: { gte: from, lte: to },
        status: { in: ['ACTIVE', 'GRACE_PERIOD'] },
      },
      orderBy: { nextBilling: 'asc' },
    });
    return result.map((r) => this.mapper.toDomain(r as unknown as PersistenceSubscription));
  }

  async getSubscriptionsForAnalytics(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<Subscription[]> {
    const result = await this.txClient.subscription.findMany({
      where: {
        tenantId,
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'desc' },
    });
    return result.map((r) => this.mapper.toDomain(r as unknown as PersistenceSubscription));
  }

  async update(id: string, data: Partial<Subscription>): Promise<Subscription> {
    const {
      id: _id,
      tenantId,
      clientId,
      plan,
      amount,
      billingCycle,
      status,
      startDate,
      endDate,
      nextBilling,
      cancelledAt,
      trialDays,
      gracePeriodDays,
      trialEndsAt,
      gracePeriodEndsAt,
      autoRenew,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
    } = data as any;
    const updateData: Record<string, unknown> = {};
    if (tenantId !== undefined) updateData.tenantId = tenantId;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (plan !== undefined) updateData.plan = plan;
    if (amount !== undefined) updateData.amount = amount;
    if (billingCycle !== undefined) updateData.billingCycle = billingCycle;
    if (status !== undefined) updateData.status = status;
    if (startDate !== undefined) updateData.startDate = startDate;
    if ('endDate' in data) updateData.endDate = endDate ?? null;
    if (nextBilling !== undefined) updateData.nextBilling = nextBilling;
    if ('cancelledAt' in data) updateData.cancelledAt = cancelledAt ?? null;
    if ('trialDays' in data) updateData.trialDays = trialDays ?? null;
    if ('gracePeriodDays' in data) updateData.gracePeriodDays = gracePeriodDays ?? null;
    if ('trialEndsAt' in data) updateData.trialEndsAt = trialEndsAt ?? null;
    if ('gracePeriodEndsAt' in data) updateData.gracePeriodEndsAt = gracePeriodEndsAt ?? null;
    if (autoRenew !== undefined) updateData.autoRenew = autoRenew;
    const result = await this.txClient.subscription.update({
      where: { id },
      data: updateData as any,
    });
    return this.mapper.toDomain(result as unknown as PersistenceSubscription);
  }

  async cancel(id: string, tenantId: string): Promise<Subscription> {
    const result = await this.txClient.subscription.update({
      where: { id, tenantId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
    return this.mapper.toDomain(result as unknown as PersistenceSubscription);
  }
}
