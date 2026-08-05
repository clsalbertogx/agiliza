'use client';

import { AlertTriangle, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { InvoiceTable } from '@/components/invoice-table';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { StatCard } from '@/components/stat-card';
import { api } from '@/lib/api';
import { getTenantId } from '@/lib/tenant';

interface InvoiceStats {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

interface Invoice {
  id: string;
  clientId: string;
  amount: number;
  dueDate: string | null;
  status: string;
}

interface Client {
  id: string;
  name: string;
}

interface Meta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

type TableStatus = 'PENDING' | 'PAID' | 'OVERDUE';

function isCoreStatus(status: string): status is TableStatus {
  return status === 'PENDING' || status === 'PAID' || status === 'OVERDUE';
}

export default function InvoicesPage() {
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantId = getTenantId();
      const [statsPayload, invoicesPayload, clientsPayload] = await Promise.all([
        api.get<{ data: InvoiceStats }>('/api/invoices/stats', { tenantId }),
        api.get<{ data: Invoice[]; meta: Meta }>('/api/invoices', { tenantId, perPage: '20' }),
        api.get<{ data: Client[] }>('/api/clients', { tenantId, perPage: '100' }),
      ]);
      setStats(statsPayload.data);
      setInvoices(invoicesPayload.data);

      const clientNameById: Record<string, string> = {};
      for (const client of clientsPayload.data) {
        clientNameById[client.id] = client.name;
      }
      setClientNames(clientNameById);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar faturas');
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
        <h1 className="text-2xl font-bold text-gray-900">Faturas</h1>
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Faturas</h1>
        </div>
        <ErrorState message={error} details="Verifique sua conexão e tente novamente." onRetry={load} />
      </div>
    );
  }

  if (!stats || invoices.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Faturas</h1>
        <EmptyState
          title="Nenhuma fatura encontrada"
          description="Crie sua primeira fatura para começar a acompanhar os valores."
        />
      </div>
    );
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const tableInvoices = invoices
    .filter((inv) => isCoreStatus(inv.status))
    .map((inv) => ({
      id: inv.id,
      clientName: clientNames[inv.clientId] ?? inv.clientId,
      amount: inv.amount,
      dueDate: inv.dueDate ?? '',
      status: inv.status as TableStatus,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Faturas</h1>
        <span className="text-sm text-gray-400">{stats.total} fatura(s)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Faturado"
          value={fmt(stats.totalAmount)}
          subtitle={`${stats.total} faturas`}
          icon={<DollarSign className="w-5 h-5" aria-hidden="true" />}
        />
        <StatCard
          title="Pago"
          value={fmt(stats.paidAmount)}
          subtitle={`${stats.paid} faturas pagas`}
          icon={<CheckCircle2 className="w-5 h-5" aria-hidden="true" />}
        />
        <StatCard
          title="Pendente"
          value={fmt(stats.pendingAmount)}
          subtitle={`${stats.pending} faturas pendentes`}
          icon={<Clock className="w-5 h-5" aria-hidden="true" />}
        />
        <StatCard
          title="Vencido"
          value={fmt(stats.overdueAmount)}
          subtitle={`${stats.overdue} faturas vencidas`}
          icon={<AlertTriangle className="w-5 h-5" aria-hidden="true" />}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Lista de Faturas</h2>
        {tableInvoices.length > 0 ? (
          <InvoiceTable invoices={tableInvoices} />
        ) : (
          <EmptyState title="Nenhuma fatura encontrada" description="As faturas aparecerão aqui." />
        )}
      </div>
    </div>
  );
}
