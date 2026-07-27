'use client';

import { useEffect, useState } from 'react';

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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/api/reports/cash-flow?tenantId=demo&months=6`,
          { headers: { Authorization: 'ApiKey dev-key' } }
        );
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
    }
    load();
  }, []);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Previsao de Fluxo de Caixa</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-gray-200 rounded-lg" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  const maxNet = Math.max(...(data?.forecast.map(f => f.netForecast) || [0]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Previsao de Fluxo de Caixa</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Receita Prevista</p>
          <p className="text-xl font-bold text-green-700">{fmt(data?.summary.totalExpectedRevenue || 0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Inadimplencia Prevista</p>
          <p className="text-xl font-bold text-red-700">{fmt(data?.summary.totalExpectedDefaults || 0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Recuperacao Prevista</p>
          <p className="text-xl font-bold text-yellow-700">{fmt(data?.summary.totalRecoveryEstimate || 0)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Confianca Media</p>
          <p className="text-xl font-bold text-blue-700">{((data?.summary.averageConfidence || 0) * 100).toFixed(0)}%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Projecao Mensal</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th className="pb-3">Mes</th>
                <th className="pb-3">Receita</th>
                <th className="pb-3">Inadimplencia</th>
                <th className="pb-3">Recuperacao</th>
                <th className="pb-3">Liquido</th>
                <th className="pb-3">Confianca</th>
              </tr>
            </thead>
            <tbody>
              {data?.forecast.map((f, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-3 font-medium capitalize">{f.month}</td>
                  <td className="py-3 text-green-700">{fmt(f.expectedRevenue)}</td>
                  <td className="py-3 text-red-700">{fmt(f.expectedDefaults)}</td>
                  <td className="py-3 text-yellow-700">{fmt(f.recoveryEstimate)}</td>
                  <td className="py-3 font-bold">{(f.netForecast / maxNet) > 0.7 ? '🟢' : (f.netForecast / maxNet) > 0.4 ? '🟡' : '🔴'} {fmt(f.netForecast)}</td>
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
