import type { Client } from '@/domain/entities/client';
import type { Invoice } from '@/domain/entities/invoice';

/**
 * Analytics-specific port for invoice queries.
 * This is a projection interface — it exposes only the data that
 * analytics use cases (CashFlowService) need, not the full CRUD.
 */
export interface AnalyticsInvoiceRepositoryPort {
  findMany(params: { where?: Record<string, unknown>; orderBy?: Record<string, string> }): Promise<Invoice[]>;
  getStats(tenantId: string): Promise<Record<string, unknown>>;
}

/**
 * Analytics-specific port for client queries.
 */
export interface AnalyticsClientRepositoryPort {
  findMany(params: { where?: Record<string, unknown> }): Promise<Client[]>;
}
