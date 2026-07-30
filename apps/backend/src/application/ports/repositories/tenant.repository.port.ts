import type { Tenant } from '@/domain/entities/tenant';

export interface TenantRepositoryPort {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  findByEmail(email: string): Promise<Tenant | null>;
  findMany(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: Tenant[]; total: number }>;
  create(tenant: Tenant): Promise<Tenant>;
  update(tenant: Tenant): Promise<Tenant>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}