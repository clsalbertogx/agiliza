import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { ClientRiskScore } from '@/domain/contracts/enums';
import type { Client } from '@/domain/entities/client';

export interface ListClientsInput {
  tenantId: string;
  page?: number;
  perPage?: number;
  search?: string;
  riskScore?: string;
}

export interface ListClientsOutput {
  data: Array<{
    id: string;
    tenantId: string;
    name: string;
    phone: string;
    email?: string;
    document?: string;
    preferredChannel: string;
    preferredTime?: string;
    preferredLeadDays: number;
    riskScore: ClientRiskScore;
    totalInvoices: number;
    paidInvoices: number;
    avgPaymentDelay: number | null;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

function clientToOutput(client: Client): ListClientsOutput['data'][number] {
  return {
    id: client.id,
    tenantId: client.tenantId,
    name: client.name,
    phone: client.phone,
    email: client.email,
    document: client.document,
    preferredChannel: client.preferredChannel,
    preferredTime: client.preferredTime,
    preferredLeadDays: client.preferredLeadDays,
    riskScore: client.riskScore.clientRiskScore,
    totalInvoices: client.totalInvoices,
    paidInvoices: client.paidInvoices,
    avgPaymentDelay: client.avgPaymentDelay,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export class ListClientsUseCase {
  constructor(private readonly clientRepo: ClientRepositoryPort) {}

  async execute(input: ListClientsInput): Promise<ListClientsOutput> {
    const page = Math.max(1, input.page || 1);
    const perPage = Math.min(100, Math.max(1, input.perPage || 10));

    const result = await this.clientRepo.findMany({
      tenantId: input.tenantId,
      page,
      limit: perPage,
      search: input.search,
      status: input.riskScore,
    });

    return {
      data: result.data.map(clientToOutput),
      meta: {
        total: result.total,
        page,
        perPage,
        totalPages: Math.ceil(result.total / perPage),
      },
    };
  }
}
