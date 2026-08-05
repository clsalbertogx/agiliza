'use client';

import { Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ClientCard, type ClientCardClient } from '@/components/client-card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { api } from '@/lib/api';
import { mapRiskScore } from '@/lib/risk-score';
import { getTenantId } from '@/lib/tenant';

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  riskScore: string;
}

interface Meta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

function mapClient(raw: Client): ClientCardClient {
  return {
    name: raw.name,
    phone: raw.phone,
    email: raw.email ?? '',
    riskScore: mapRiskScore(raw.riskScore),
  };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientCardClient[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantId = getTenantId();
      const payload = await api.get<{ data: Client[]; meta: Meta }>('/api/clients', {
        tenantId,
        perPage: '20',
      });
      setClients(payload.data.map(mapClient));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        </div>
        <ErrorState message={error} details="Verifique sua conexão e tente novamente." onRetry={load} />
      </div>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <EmptyState
          icon={<Users className="w-16 h-16" />}
          title="Nenhum cliente encontrado"
          description="Cadastre seu primeiro cliente para começar."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <span className="text-sm text-gray-400">{clients.length} cliente(s)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <ClientCard key={client.email} client={client} />
        ))}
      </div>
    </div>
  );
}
