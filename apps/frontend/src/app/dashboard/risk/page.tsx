'use client';

import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ClientCard } from '@/components/client-card';
import { EmptyState } from '@/components/empty-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { RiskBadge } from '@/components/risk-badge';

interface Client {
  name: string;
  phone: string;
  email: string;
  riskScore: 'green' | 'yellow' | 'red';
}

export default function RiskPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/api/clients/risk?tenantId=demo`,
          { headers: { Authorization: 'ApiKey dev-key' } },
        );
        if (res.ok) {
          const json = await res.json();
          setClients(json.data);
          return;
        }
      } catch {
        // Fall through to demo data
      }
      setClients([
        { name: 'João Silva', phone: '85999990001', email: 'joao@email.com', riskScore: 'green' },
        { name: 'Maria Santos', phone: '85999990002', email: 'maria@email.com', riskScore: 'yellow' },
        { name: 'Carlos Oliveira', phone: '85999990003', email: 'carlos@email.com', riskScore: 'red' },
        { name: 'Ana Costa', phone: '85999990004', email: 'ana@email.com', riskScore: 'green' },
        { name: 'Pedro Alves', phone: '85999990005', email: 'pedro@email.com', riskScore: 'yellow' },
      ]);
    }
    load().finally(() => setLoading(false));
  }, []);

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

  const greenCount = clients.filter((c) => c.riskScore === 'green').length;
  const yellowCount = clients.filter((c) => c.riskScore === 'yellow').length;
  const redCount = clients.filter((c) => c.riskScore === 'red').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard de Risco</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-success-50 border border-success-200 rounded-xl p-6">
          <p className="text-lg font-bold text-success-800">{greenCount} clientes</p>
          <RiskBadge level="green" probability={0.85} reason="Histórico de pagamentos em dia" />
        </div>
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-6">
          <p className="text-lg font-bold text-warning-800">{yellowCount} clientes</p>
          <RiskBadge level="yellow" probability={0.5} reason="Pagamentos ocasionalmente atrasados" />
        </div>
        <div className="bg-danger-50 border border-danger-200 rounded-xl p-6">
          <p className="text-lg font-bold text-danger-800">{redCount} clientes</p>
          <RiskBadge level="red" probability={0.2} reason="Atraso recorrente acima de 30 dias" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <ClientCard key={client.email} client={client} />
        ))}
      </div>
    </div>
  );
}
