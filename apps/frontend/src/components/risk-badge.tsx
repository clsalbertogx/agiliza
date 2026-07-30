'use client';

import { Badge } from '@/components/ui/badge';

interface RiskBadgeProps {
  level: 'green' | 'yellow' | 'red';
  probability?: number;
  reason?: string;
}

const levelToVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
};

const levelLabel: Record<string, string> = {
  green: 'Baixo Risco',
  yellow: 'Médio Risco',
  red: 'Alto Risco',
};

export function RiskBadge({ level, probability, reason }: RiskBadgeProps) {
  const variant = levelToVariant[level];
  const label = levelLabel[level];
  const tooltipParts: string[] = [];
  if (probability !== undefined) {
    tooltipParts.push(`Probabilidade: ${(probability * 100).toFixed(0)}%`);
  }
  if (reason) {
    tooltipParts.push(`Motivo: ${reason}`);
  }
  const tooltipText = tooltipParts.join(' | ');

  return (
    <span className="inline-flex relative group">
      <Badge variant={variant}>{label}</Badge>
      {tooltipText && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
        >
          {tooltipText}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
