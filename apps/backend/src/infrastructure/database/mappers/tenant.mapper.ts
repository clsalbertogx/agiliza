import type { DomainMapper } from './mapper.interface';
import type { Tenant, PersistenceTenant } from '@/domain/entities/tenant';
import { createTenantFromPersistence, tenantToPersistence } from '@/domain/entities/tenant';

export type { PersistenceTenant } from '@/domain/entities/tenant';

export class TenantMapper implements DomainMapper<PersistenceTenant, Tenant> {
  toDomain(persistence: PersistenceTenant): Tenant {
    return createTenantFromPersistence(persistence);
  }

  toPersistence(domain: Tenant): PersistenceTenant {
    return tenantToPersistence(domain);
  }
}