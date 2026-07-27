'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
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
        // Use demo data if API unavailable
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse" aria-hidden="true">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-400">
          Atualizado automaticamente
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Faturamento" value={fmt(data?.totalCollected || 0)} subtitle={`De ${fmt(data?.totalInvoiced || 0)}`} icon={<DollarSign className="w-5 h-5" aria-hidden="true" />} />
        <StatCard title="A Receber" value={fmt(data?.totalOutstanding || 0)} subtitle={`${data?.overdueRate || 0}% em atraso`} icon={<TrendingUp className="w-5 h-5" aria-hidden="true" />} />
        <StatCard title="Inadimplência" value={`${data?.overdueRate || 0}%`} subtitle={`${data?.overdueInvoices || 0} faturas vencidas`} icon={<AlertTriangle className="w-5 h-5" aria-hidden="true" />} />
        <StatCard title="Recebimento" value={`${data?.paidInvoices || 0}/${data?.totalInvoices || 0}`} subtitle="faturas pagas" icon={<CreditCard className="w-5 h-5" aria-hidden="true" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumo de Faturas</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pagas</span>
              <StatusBadge status="paid" />
              <span className="font-medium">{data?.paidInvoices || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pendentes</span>
              <StatusBadge status="pending" />
              <span className="font-medium">{data?.pendingInvoices || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Vencidas</span>
              <StatusBadge status="overdue" />
              <span className="font-medium">{data?.overdueInvoices || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribuição de Risco</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-green-600 font-medium">Verde (Baixo Risco)</span>
              <span className="text-green-700 font-bold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-yellow-600 font-medium">Amarelo (Médio Risco)</span>
              <span className="text-yellow-700 font-bold">--</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-red-600 font-medium">Vermelho (Alto Risco)</span>
              <span className="text-red-700 font-bold">--</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
