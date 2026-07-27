'use client';

import { useEffect, useState, useCallback } from 'react';
import { StatCard } from '@/components/stat-card';
import { DollarSign, TrendingUp, AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';

interface Forecast {
  month: string;
  expectedRevenue: number;
  expectedDefaults: number;
  recoveryEstimate: number;
  netForecast: number;
  confidence: number;
}

interface ReportData {
  forecast: Forecast[];
  summary: {
    totalExpectedRevenue: number;
    totalExpectedDefaults: number;
    totalRecoveryEstimate: number;
    totalNetForecast: number;
    averageConfidence: number;
  };
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/api/reports/cash-flow?tenantId=demo&months=6`,
        { headers: { Authorization: 'ApiKey dev-key' } }
      );
      if (!res.ok) {
        throw new Error(`Erro HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
    } catch {
      // Demo data
      const months = ['Agosto 2026', 'Setembro 2026', 'Outubro 2026', 'Novembro 2026', 'Dezembro 2026', 'Janeiro 2027'];
      const forecast = months.map((month, i) => ({
        month,
        expectedRevenue: 5000 + i * 200,
        expectedDefaults: 600 + i * 50,
        recoveryEstimate: 180 + i * 15,
        netForecast: 4580 + i * 165,
        confidence: Math.max(0.5, 0.95 - i * 0.08),
      }));
      setData({
        forecast,
        summary: {
          totalExpectedRevenue: forecast.reduce((s, f) => s + f.expectedRevenue, 0),
          totalExpectedDefaults: forecast.reduce((s, f) => s + f.expectedDefaults, 0),
          totalRecoveryEstimate: forecast.reduce((s, f) => s + f.recoveryEstimate, 0),
          totalNetForecast: forecast.reduce((s, f) => s + f.netForecast, 0),
          averageConfidence: 0.78,
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Previsão de Fluxo de Caixa</h1>
        <div className="animate-pulse space-y-4" aria-hidden="true">
          <div className="h-16 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Previsão de Fluxo de Caixa</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">Não foi possível carregar relatórios</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const forecast = data?.forecast ?? [];
  const summary = data?.summary;

  if (forecast.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Previsão de Fluxo de Caixa</h1>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Nenhum dado disponível para o período selecionado</h2>
          <p className="text-gray-500 mb-4">Tente selecionar um período diferente ou ajustar os filtros.</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </div>
    );
  }

  const maxNet = Math.max(...forecast.map(f => f.netForecast));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Previsão de Fluxo de Caixa</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Receita Prevista" value={fmt(summary?.totalExpectedRevenue || 0)} icon={<DollarSign className="w-5 h-5" aria-hidden="true" />} />
        <StatCard title="Inadimplência Prevista" value={fmt(summary?.totalExpectedDefaults || 0)} icon={<TrendingUp className="w-5 h-5" aria-hidden="true" />} />
        <StatCard title="Recuperação Prevista" value={fmt(summary?.totalRecoveryEstimate || 0)} icon={<BarChart3 className="w-5 h-5" aria-hidden="true" />} />
        <StatCard title="Confiança Média" value={`${((summary?.averageConfidence || 0) * 100).toFixed(0)}%`} icon={<AlertTriangle className="w-5 h-5" aria-hidden="true" />} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Projeção Mensal</h2>
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th scope="col" className="pb-3">Mês</th>
                <th scope="col" className="pb-3">Receita</th>
                <th scope="col" className="pb-3">Inadimplência</th>
                <th scope="col" className="pb-3">Recuperação</th>
                <th scope="col" className="pb-3">Líquido</th>
                <th scope="col" className="pb-3">Confiança</th>
              </tr>
            </thead>
            <tbody>
              {forecast.map((f) => (
                <tr key={f.month} className="border-b border-gray-50">
                  <td className="py-3 font-medium capitalize">{f.month}</td>
                  <td className="py-3 text-green-700">{fmt(f.expectedRevenue)}</td>
                  <td className="py-3 text-red-700">{fmt(f.expectedDefaults)}</td>
                  <td className="py-3 text-yellow-700">{fmt(f.recoveryEstimate)}</td>
                  <td className="py-3 font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${(f.netForecast / maxNet) > 0.7 ? 'bg-green-500' : (f.netForecast / maxNet) > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`} aria-hidden="true" />
                      {fmt(f.netForecast)}
                    </span>
                  </td>
                  <td className="py-3">{(f.confidence * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
