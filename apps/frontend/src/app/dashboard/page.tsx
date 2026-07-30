'use client';

import { useEffect, useState } from 'react';
import { KpiCard } from '@/components/kpi-card';
import { InvoiceTable } from '@/components/invoice-table';
import { RiskBadge } from '@/components/risk-badge';
import { LoadingSkeleton } from '@/components/loading-skeleton';
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

const demoInvoices = [
  { id: '1', clientName: 'João Silva', amount: 149.90, dueDate: '2026-08-15', status: 'PAID' as const },
  { id: '2', clientName: 'Maria Santos', amount: 99.90, dueDate: '2026-08-10', status: 'PENDING' as const },
  { id: '3', clientName: 'Carlos Oliveira', amount: 299.70, dueDate: '2026-07-01', status: 'OVERDUE' as const },
  { id: '4', clientName: 'Ana Costa', amount: 49.90, dueDate: '2026-08-20', status: 'PAID' as const },
  { id: '5', clientName: 'Pedro Alves', amount: 199.80, dueDate: '2026-07-25', status: 'OVERDUE' as const },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/api/invoices/stats?tenantId=demo`,
          { headers: { Authorization: 'ApiKey dev-key' } }
        );
        const json = await res.json();
        setData(json.data);
      } catch {
        setData({
          totalInvoiced: 15990,
          totalCollected: 12450,
          totalOutstanding: 3540,
          overdueRate: 12,
          totalInvoices: 45,
          paidInvoices: 32,
          pendingInvoices: 8,
          overdueInvoices: 5,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <LoadingSkeleton variant="page" />
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
          value={fmt(data?.totalCollected || 0)}
          subtitle={`De ${fmt(data?.totalInvoiced || 0)}`}
          icon={<DollarSign className="w-5 h-5" aria-hidden="true" />}
        />
        <KpiCard
          title="A Receber"
          value={fmt(data?.totalOutstanding || 0)}
          subtitle={`${data?.overdueRate || 0}% em atraso`}
          icon={<TrendingUp className="w-5 h-5" aria-hidden="true" />}
        />
        <KpiCard
          title="Inadimplência"
          value={`${data?.overdueRate || 0}%`}
          subtitle={`${data?.overdueInvoices || 0} faturas vencidas`}
          icon={<AlertTriangle className="w-5 h-5" aria-hidden="true" />}
        />
        <KpiCard
          title="Recebimento"
          value={`${data?.paidInvoices || 0}/${data?.totalInvoices || 0}`}
          subtitle="faturas pagas"
          icon={<CreditCard className="w-5 h-5" aria-hidden="true" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Últimas Faturas
          </h2>
          <InvoiceTable invoices={demoInvoices} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Distribuição de Risco
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <RiskBadge level="green" probability={0.85} reason="Histórico de pagamentos em dia" />
              <span className="text-green-700 font-bold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <RiskBadge level="yellow" probability={0.45} reason="Pagamentos ocasionalmente atrasados" />
              <span className="text-yellow-700 font-bold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <RiskBadge level="red" probability={0.15} reason="Atraso recorrente acima de 30 dias" />
              <span className="text-red-700 font-bold">--</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
