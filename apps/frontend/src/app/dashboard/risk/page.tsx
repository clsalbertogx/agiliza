'use client';

import { Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ClientCard, type ClientCardClient } from '@/components/client-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { RiskBadge } from '@/components/risk-badge';
import { StatCard } from '@/components/stat-card';
import { api } from '@/lib/api';
import { mapRiskScore, type RiskLevel } from '@/lib/risk-score';
import { getTenantId } from '@/lib/tenant';

interface RiskBucket {
  count: number;
  percentage: number;
}

interface RiskDistribution {
  green: RiskBucket;
  yellow: RiskBucket;
  red: RiskBucket;
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  riskScore: string;
}

const demoClients: ClientCardClient[] = [
  { name: 'João Silva', phone: '85999990001', email: 'joao@email.com', riskScore: 'green' },
  { name: 'Maria Santos', phone: '85999990002', email: 'maria@email.com', riskScore: 'yellow' },
  { name: 'Carlos Oliveira', phone: '85999990003', email: 'carlos@email.com', riskScore: 'red' },
  { name: 'Ana Costa', phone: '85999990004', email: 'ana@email.com', riskScore: 'green' },
  { name: 'Pedro Alves', phone: '85999990005', email: 'pedro@email.com', riskScore: 'yellow' },
];

function deriveDistribution(clients: ClientCardClient[]): RiskDistribution {
  const total = clients.length || 1;
  const green = clients.filter((c) => c.riskScore === 'green').length;
  const yellow = clients.filter((c) => c.riskScore === 'yellow').length;
  const red = clients.filter((c) => c.riskScore === 'red').length;
  return {
    green: { count: green, percentage: Math.round((green / total) * 100) },
    yellow: { count: yellow, percentage: Math.round((yellow / total) * 100) },
    red: { count: red, percentage: Math.round((red / total) * 100) },
  };
}

function mapClient(raw: Client): ClientCardClient {
  return {
    name: raw.name,
    phone: raw.phone,
    email: raw.email ?? '',
    riskScore: mapRiskScore(raw.riskScore),
  };
}

export default function RiskPage() {
  const [distribution, setDistribution] = useState<RiskDistribution | null>(null);
  const [clients, setClients] = useState<ClientCardClient[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantId = getTenantId();
      const [distPayload, clientsPayload] = await Promise.all([
        api.get<{ data: RiskDistribution }>('/api/reports/risk-distribution', { tenantId }),
        api.get<{ data: Client[] }>('/api/clients', { tenantId, perPage: '100' }),
      ]);
      setDistribution(distPayload.data);
      setClients(clientsPayload.data.map(mapClient));
    } catch (err: unknown) {
      // Defensive fallback: keep the page functional when the API is unavailable.
      setClients(demoClients);
      setDistribution(deriveDistribution(demoClients));
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados de risco');
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Risco</h1>
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Risco</h1>
        <EmptyState
          icon={<Users className="w-16 h-16" />}
          title="Nenhum cliente encontrado"
          description="Não há clientes cadastrados para análise de risco."
        />
      </div>
    );
  }

  const buckets: { level: RiskLevel; bucket: RiskBucket }[] = [
    { level: 'green', bucket: distribution?.green ?? deriveDistribution(clients).green },
    { level: 'yellow', bucket: distribution?.yellow ?? deriveDistribution(clients).yellow },
    { level: 'red', bucket: distribution?.red ?? deriveDistribution(clients).red },
  ];

  const bucketLabel: Record<RiskLevel, string> = {
    green: 'Baixo Risco',
    yellow: 'Médio Risco',
    red: 'Alto Risco',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Risco</h1>
        {error && <span className="text-sm text-gray-400">Usando dados de demonstração</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {buckets.map(({ level, bucket }) => (
          <StatCard
            key={level}
            title={bucketLabel[level]}
            value={bucket.count}
            subtitle={`${bucket.percentage}% das faturas`}
            icon={<RiskBadge level={level} />}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <ClientCard key={client.email} client={client} />
        ))}
      </div>
    </div>
  );
}
