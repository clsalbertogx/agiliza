'use client';

import { useEffect, useState, useCallback } from 'react';
import { KpiCard } from '@/components/kpi-card';
import { InvoiceTable } from '@/components/invoice-table';
import { RiskBadge } from '@/components/risk-badge';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { ErrorState } from '@/components/error-state';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api';
import { DollarSign, TrendingUp, AlertTriangle, CreditCard } from 'lucide-react';

interface DashboardData {
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  overdueRate: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
}

interface InvoiceRow {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
}

const demoInvoices: InvoiceRow[] = [
  { id: '1', clientName: 'João Silva', amount: 149.90, dueDate: '2026-08-15', status: 'PAID' as const },
  { id: '2', clientName: 'Maria Santos', amount: 99.90, dueDate: '2026-08-10', status: 'PENDING' as const },
  { id: '3', clientName: 'Carlos Oliveira', amount: 299.70, dueDate: '2026-07-01', status: 'OVERDUE' as const },
  { id: '4', clientName: 'Ana Costa', amount: 49.90, dueDate: '2026-08-20', status: 'PAID' as const },
  { id: '5', clientName: 'Pedro Alves', amount: 199.80, dueDate: '2026-07-25', status: 'OVERDUE' as const },
];

const demoDashboardData: DashboardData = {
  totalInvoiced: 15990,
  totalCollected: 12450,
  totalOutstanding: 3540,
  overdueRate: 12,
  totalInvoices: 45,
  paidInvoices: 32,
  pendingInvoices: 8,
  overdueInvoices: 5,
};

const demoRiskDistribution = [
  { level: 'green' as const, probability: 0.85, reason: 'Histórico de pagamentos em dia' },
  { level: 'yellow' as const, probability: 0.45, reason: 'Pagamentos ocasionalmente atrasados' },
  { level: 'red' as const, probability: 0.15, reason: 'Atraso recorrente acima de 30 dias' },
];

interface StatsResponse {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

interface InvoicesResponse {
  data: Array<{
    id: string;
    clientId: string;
    amount: number;
    dueDate: string;
    status: string;
  }>;
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

function mapStatsToDashboard(stats: StatsResponse): DashboardData {
  const totalOutstanding = stats.pendingAmount + stats.overdueAmount;
  const overdueRate = stats.total > 0 ? Math.round((stats.overdue / stats.total) * 100) : 0;

  return {
    totalInvoiced: stats.totalAmount,
    totalCollected: stats.paidAmount,
    totalOutstanding,
    overdueRate,
    totalInvoices: stats.total,
    paidInvoices: stats.paid,
    pendingInvoices: stats.pending,
    overdueInvoices: stats.overdue,
  };
}

function getTenantId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tenant_id') || 'demo';
  }
  return 'demo';
}

export default function DashboardPage() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  const [data, setData] = useState<DashboardData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskDistribution] = useState(demoRiskDistribution);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      // Simulate network delay for demo mode
      await new Promise((r) => setTimeout(r, 400));
      setData(demoDashboardData);
      setInvoices(demoInvoices);
      setLoading(false);
      return;
    }

    try {
      const tenantId = getTenantId();

      // Fetch stats
      const statsPayload = await api.get<{ data: StatsResponse }>('/api/invoices/stats', { tenantId });
      const mapped = mapStatsToDashboard(statsPayload.data);
      setData(mapped);

      // Fetch recent invoices (last 5)
      const invoicesPayload = await api.get<InvoicesResponse>('/api/invoices', {
        tenantId,
        perPage: '5',
      });
      const mappedInvoices: InvoiceRow[] = invoicesPayload.data.map((inv) => ({
        id: inv.id,
        clientName: inv.clientId,
        amount: inv.amount,
        dueDate: inv.dueDate,
        status: inv.status as InvoiceRow['status'],
      }));
      setInvoices(mappedInvoices);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <EmptyState
          title="Nenhum dado disponível"
          description="Crie sua primeira fatura para começar a ver as estatísticas."
        />
      </div>
    );
  }

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-400">
          Atualizado automaticamente
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Faturamento"
          value={fmt(data.totalCollected)}
          subtitle={`De ${fmt(data.totalInvoiced)}`}
          icon={<DollarSign className="w-5 h-5" aria-hidden="true" />}
        />
        <KpiCard
          title="A Receber"
          value={fmt(data.totalOutstanding)}
          subtitle={`${data.overdueRate}% em atraso`}
          icon={<TrendingUp className="w-5 h-5" aria-hidden="true" />}
        />
        <KpiCard
          title="Inadimplência"
          value={`${data.overdueRate}%`}
          subtitle={`${data.overdueInvoices} faturas vencidas`}
          icon={<AlertTriangle className="w-5 h-5" aria-hidden="true" />}
        />
        <KpiCard
          title="Recebimento"
          value={`${data.paidInvoices}/${data.totalInvoices}`}
          subtitle="faturas pagas"
          icon={<CreditCard className="w-5 h-5" aria-hidden="true" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Últimas Faturas
          </h2>
          {invoices.length > 0 ? (
            <InvoiceTable invoices={invoices} />
          ) : (
            <EmptyState
              title="Nenhuma fatura encontrada"
              description="As faturas recentes aparecerão aqui."
            />
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Distribuição de Risco
          </h2>
          <div className="space-y-3">
            {riskDistribution.map((risk) => (
              <div key={risk.level} className="flex justify-between items-center">
                <RiskBadge level={risk.level} probability={risk.probability} reason={risk.reason} />
                <span className="text-gray-700 font-bold">--</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
