import type { DomainMapper } from './mapper.interface';
import type { Subscription, PersistenceSubscription } from '@/domain/entities/subscription';
import { createSubscriptionFromPersistence, subscriptionToPersistence } from '@/domain/entities/subscription';

export type { PersistenceSubscription } from '@/domain/entities/subscription';

export class SubscriptionMapper implements DomainMapper<PersistenceSubscription, Subscription> {
  toDomain(persistence: PersistenceSubscription): Subscription {
    return createSubscriptionFromPersistence(persistence);
  }

  toPersistence(domain: Subscription): PersistenceSubscription {
    return subscriptionToPersistence(domain);
  }
}
