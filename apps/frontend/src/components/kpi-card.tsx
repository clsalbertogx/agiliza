'use client';

import { Card, CardContent } from '@/components/ui/card';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
}

export function KpiCard({ title, value, icon, trend, subtitle }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {icon && (
            <div className="text-gray-400" aria-hidden="true">
              {icon}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 text-sm font-medium ${
                trend.isPositive ? 'text-success-600' : 'text-danger-600'
              }`}
            >
              <span aria-hidden="true">
                {trend.isPositive ? '\u2191' : '\u2193'}
              </span>
              {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
