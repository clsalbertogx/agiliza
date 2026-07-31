// @deprecated — not wired yet
'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { BarChart3, TrendingUp, PieChart, Calendar } from 'lucide-react';

export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ReportChartProps {
  type: ChartType;
  title: string;
  data: ChartDataPoint[];
  series?: ChartSeries[];
  dateRange?: {
    start: string;
    end: string;
  };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  height?: number;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
}

const chartTypeIcons: Record<ChartType, React.ReactNode> = {
  bar: <BarChart3 className="w-5 h-5" aria-hidden="true" />,
  line: <TrendingUp className="w-5 h-5" aria-hidden="true" />,
  pie: <PieChart className="w-5 h-5" aria-hidden="true" />,
};

const defaultColors = [
  '#22c55e', // primary-500
  '#3b82f6', // info-500
  '#f59e0b', // warning-500
  '#ef4444', // danger-500
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div role="status" aria-label="Carregando gráfico" className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
      </div>
      <div
        className="bg-gray-100 rounded-xl animate-pulse"
        style={{ height: `${height}px` }}
        aria-hidden="true"
      />
    </div>
  );
}

// -------- Bar Chart --------
function BarChart({
  data,
  series,
  height,
}: {
  data: ChartDataPoint[];
  series?: ChartSeries[];
  height: number;
}) {
  const padding = { top: 20, right: 20, bottom: 50, left: 60 };
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const hasSeries = series && series.length > 0;

  // For simple bar chart
  const maxValue = hasSeries
    ? Math.max(...series!.flatMap((s) => s.data), 1)
    : Math.max(...data.map((d) => d.value), 1);

  const yLabels = useMemo(() => {
    const labels: number[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      labels.push(Math.round((maxValue / steps) * i));
    }
    return labels;
  }, [maxValue]);

  const barWidth = hasSeries && series
    ? Math.min(innerWidth / data.length / (series.length + 1) - 4, 30)
    : Math.min(innerWidth / data.length - 8, 50);

  // Build accessible table data
  const tableData = hasSeries && series
    ? series!.map((s) => ({
        name: s.name,
        values: data.map((d, i) => ({ label: d.label, value: s.data[i] ?? 0 })),
      }))
    : [
        {
          name: 'Valores',
          values: data.map((d) => ({ label: d.label, value: d.value })),
        },
      ];

  return (
    <>
      {/* Screen reader accessible table */}
      <table className="sr-only" aria-hidden="true">
        <thead>
          <tr>
            <th>Série</th>
            {data.map((d) => (
              <th key={d.label}>{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              {row.values.map((v) => (
                <td key={v.label}>{formatBRL(v.value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Gráfico de ${hasSeries ? 'barras agrupadas' : 'barras'}`}
      >
        {/* Y-axis labels and gridlines */}
        {yLabels.map((label) => {
          const y = padding.top + innerHeight - (label / maxValue) * innerHeight;
          return (
            <g key={label}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="text-xs fill-gray-400"
              >
                {formatBRL(label)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = padding.left + (i + 0.5) * (innerWidth / data.length);
          return (
            <text
              key={d.label}
              x={x}
              y={chartHeight - padding.bottom + 20}
              textAnchor="end"
              transform={`rotate(-45, ${x}, ${chartHeight - padding.bottom + 20})`}
              className="text-xs fill-gray-500"
            >
              {d.label.length > 12 ? `${d.label.slice(0, 10)}...` : d.label}
            </text>
          );
        })}

        {/* Bars */}
        {hasSeries && series ? (
          // Multi-series grouped bars
          <>
            {series.map((s, si) => (
              <g key={s.name}>
                {data.map((d, di) => {
                  const value = s.data[di] ?? 0;
                  const barHeight = (value / maxValue) * innerHeight;
                  const groupWidth = innerWidth / data.length;
                  const x =
                    padding.left + di * groupWidth + (groupWidth / (series.length + 1)) * si + 2;
                  const y = padding.top + innerHeight - barHeight;
                  return (
                    <rect
                      key={`${s.name}-${di}`}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill={s.color ?? defaultColors[si % defaultColors.length]}
                      rx={2}
                      className="hover:opacity-80 transition-opacity"
                    >
                      <title>{`${s.name}: ${formatBRL(value)}`}</title>
                    </rect>
                  );
                })}
              </g>
            ))}
          </>
        ) : (
          // Single series bars
          <>
            {data.map((d, i) => {
              const barHeight = (d.value / maxValue) * innerHeight;
              const x = padding.left + (i + 0.25) * (innerWidth / data.length);
              const y = padding.top + innerHeight - barHeight;
              return (
                <rect
                  key={d.label}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={d.color ?? defaultColors[0]}
                  rx={2}
                  className="hover:opacity-80 transition-opacity"
                >
                  <title>{`${d.label}: ${formatBRL(d.value)}`}</title>
                </rect>
              );
            })}
          </>
        )}

        {/* Baseline */}
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={chartWidth - padding.right}
          y2={padding.top + innerHeight}
          stroke="#d1d5db"
          strokeWidth={1}
        />
      </svg>
    </>
  );
}

// -------- Line Chart --------
function LineChart({
  data,
  series,
  height,
}: {
  data: ChartDataPoint[];
  series?: ChartSeries[];
  height: number;
}) {
  const padding = { top: 20, right: 20, bottom: 50, left: 60 };
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const hasSeries = series && series.length > 0;
  const maxValue = hasSeries
    ? Math.max(...series!.flatMap((s) => s.data), 1)
    : Math.max(...data.map((d) => d.value), 1);

  const yLabels = useMemo(() => {
    const labels: number[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      labels.push(Math.round((maxValue / steps) * i));
    }
    return labels;
  }, [maxValue]);

  const getX = (i: number) =>
    padding.left + (i / (data.length - 1 || 1)) * innerWidth;

  const getY = (value: number) =>
    padding.top + innerHeight - (value / maxValue) * innerHeight;

  // Accessible table
  const tableData = hasSeries && series
    ? series!.map((s) => ({
        name: s.name,
        values: data.map((d, i) => ({ label: d.label, value: s.data[i] ?? 0 })),
      }))
    : [
        {
          name: 'Valores',
          values: data.map((d) => ({ label: d.label, value: d.value })),
        },
      ];

  return (
    <>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Período</th>
            {data.map((d) => (
              <th key={d.label}>{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              {row.values.map((v) => (
                <td key={v.label}>{formatBRL(v.value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Gráfico de linha"
      >
        {/* Grid lines */}
        {yLabels.map((label) => {
          const y = getY(label);
          return (
            <g key={label}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="text-xs fill-gray-400"
              >
                {formatBRL(label)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = getX(i);
          return (
            <text
              key={d.label}
              x={x}
              y={chartHeight - padding.bottom + 20}
              textAnchor="end"
              transform={`rotate(-45, ${x}, ${chartHeight - padding.bottom + 20})`}
              className="text-xs fill-gray-500"
            >
              {d.label.length > 12 ? `${d.label.slice(0, 10)}...` : d.label}
            </text>
          );
        })}

        {/* Lines */}
        {hasSeries && series
          ? series.map((s, si) => {
              const points = s.data
                .map((value, i) => `${getX(i)},${getY(value)}`)
                .join(' ');
              return (
                <g key={s.name}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={s.color ?? defaultColors[si % defaultColors.length]}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {s.data.map((value, i) => (
                    <circle
                      key={`${s.name}-${i}`}
                      cx={getX(i)}
                      cy={getY(value)}
                      r={3}
                      fill={s.color ?? defaultColors[si % defaultColors.length]}
                      className="hover:r-5 transition-all"
                    >
                      <title>{`${s.name} - ${data[i].label}: ${formatBRL(value)}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })
          : (() => {
              const points = data
                .map((d, i) => `${getX(i)},${getY(d.value)}`)
                .join(' ');
              return (
                <g>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={defaultColors[0]}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {data.map((d, i) => (
                    <circle
                      key={d.label}
                      cx={getX(i)}
                      cy={getY(d.value)}
                      r={3}
                      fill={d.color ?? defaultColors[0]}
                    >
                      <title>{`${d.label}: ${formatBRL(d.value)}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })()}

        {/* Baseline */}
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={chartWidth - padding.right}
          y2={padding.top + innerHeight}
          stroke="#d1d5db"
          strokeWidth={1}
        />
      </svg>
    </>
  );
}

// -------- Pie Chart --------
function PieChartSvg({
  data,
  height,
}: {
  data: ChartDataPoint[];
  height: number;
}) {
  const cx = 150;
  const cy = 150;
  const radius = 120;
  const chartWidth = 400;
  const chartHeight = height;

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let currentAngle = -Math.PI / 2;

  const segments = data.map((d) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const midAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius * 0.65;
    const lx = cx + labelRadius * Math.cos(midAngle);
    const ly = cy + labelRadius * Math.sin(midAngle);

    return { path, color: d.color ?? defaultColors[data.indexOf(d) % defaultColors.length], d, lx, ly };
  });

  return (
    <>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Valor</th>
            <th>Percentual</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{formatBRL(d.value)}</td>
              <td>{((d.value / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full max-w-[400px] mx-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Gráfico de pizza"
      >
        {segments.map((seg) => (
          <g key={seg.d.label}>
            <path d={seg.path} fill={seg.color} className="hover:opacity-80 transition-opacity">
              <title>{`${seg.d.label}: ${formatBRL(seg.d.value)} (${((seg.d.value / total) * 100).toFixed(1)}%)`}</title>
            </path>
            {seg.d.value / total > 0.05 && (
              <text
                x={seg.lx}
                y={seg.ly}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-xs fill-white font-medium"
              >
                {`${((seg.d.value / total) * 100).toFixed(0)}%`}
              </text>
            )}
          </g>
        ))}
      </svg>
    </>
  );
}

function ChartLegend({ data, series }: { data: ChartDataPoint[]; series?: ChartSeries[] }) {
  const items = series
    ? series.map((s, i) => ({ label: s.name, color: s.color ?? defaultColors[i % defaultColors.length] }))
    : data.map((d, i) => ({ label: d.label, color: d.color ?? defaultColors[i % defaultColors.length] }));

  if (items.length <= 1 && !series) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4" aria-label="Legenda do gráfico">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <span className="text-xs text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ReportChart({
  type,
  title,
  data,
  series,
  dateRange,
  onDateRangeChange,
  height = 300,
  isLoading = false,
  error = null,
  onRetry,
  emptyMessage = 'Nenhum dado disponível para o período',
}: ReportChartProps) {
  const [localStart, setLocalStart] = useState(dateRange?.start ?? '');
  const [localEnd, setLocalEnd] = useState(dateRange?.end ?? '');

  if (isLoading) return <ChartSkeleton height={height} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const hasData = data.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {chartTypeIcons[type]}
            <CardTitle>{title}</CardTitle>
          </div>

          {/* Date range */}
          {onDateRangeChange && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <input
                  type="month"
                  value={localStart}
                  onChange={(e) => setLocalStart(e.target.value)}
                  className="pl-8 h-9 rounded-lg border border-gray-300 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 w-32"
                  aria-label="Data inicial"
                />
              </div>
              <span className="text-gray-400 text-sm">─</span>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                <input
                  type="month"
                  value={localEnd}
                  onChange={(e) => setLocalEnd(e.target.value)}
                  className="pl-8 h-9 rounded-lg border border-gray-300 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 w-32"
                  aria-label="Data final"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onDateRangeChange({ start: localStart, end: localEnd })}
              >
                Aplicar
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="py-8">
            <EmptyState
              icon={<BarChart3 className="w-12 h-12" />}
              title={emptyMessage}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: type === 'pie' ? 'auto' : '400px' }}>
              {type === 'bar' && <BarChart data={data} series={series} height={height} />}
              {type === 'line' && <LineChart data={data} series={series} height={height} />}
              {type === 'pie' && <PieChartSvg data={data} height={height} />}
            </div>
            <ChartLegend data={data} series={series} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
