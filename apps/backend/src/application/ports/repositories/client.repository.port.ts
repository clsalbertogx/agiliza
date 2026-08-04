import type { Client, RiskScore } from '@/domain/entities/client';

export interface ClientRepositoryPort {
  findById(id: string, tenantId?: string): Promise<Client | null>;
  findByPhone(phone: string, tenantId: string): Promise<Client | null>;
  findMany(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ data: Client[]; total: number }>;
  create(client: Client): Promise<Client>;
  update(client: Client): Promise<Client>;
  delete(id: string): Promise<void>;
  count(tenantId: string): Promise<number>;
  updateRiskScore(id: string, riskScore: RiskScore, riskScoreReason?: string): Promise<void>;
}
