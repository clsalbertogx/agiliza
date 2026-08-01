import { Subscription } from '@/domain/entities/subscription';

export interface SubscriptionRepositoryPort {
  create(subscription: Subscription): Promise<Subscription>;
  findById(id: string, tenantId?: string): Promise<Subscription | null>;
  findByTenantId(tenantId: string): Promise<Subscription[]>;
  findByClientId(clientId: string, tenantId?: string): Promise<Subscription[]>;
  findActiveByNextBillingBefore(date: Date): Promise<Subscription[]>;
  findDueForRenewal(from: Date, to: Date): Promise<Subscription[]>;
  update(id: string, data: Partial<Subscription>): Promise<Subscription>;
  cancel(id: string, tenantId: string): Promise<Subscription>;
}
