// Available for wire-up — not yet connected to a page.
// Exported from the barrel; natural home: exceptions/reconciliation view.
'use client';

import { ScrollArea } from '@radix-ui/react-scroll-area';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type ExceptionSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ExceptionStatus = 'open' | 'in_progress' | 'resolved' | 'ignored';

export interface ExceptionItem {
  id: string;
  type:
    | 'payment_mismatch'
    | 'webhook_failed'
    | 'message_failed'
    | 'duplicate_invoice'
    | 'provider_error'
    | 'reconciliation_gap';
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  title: string;
  description: string;
  invoiceId?: string;
  clientName?: string;
  amount?: number;
  errorMessage?: string;
  occurredAt: string;
  updatedAt: string;
  retryCount?: number;
  maxRetries?: number;
}

export interface ExceptionPanelProps {
  exceptions: ExceptionItem[];
  onRetry: (exceptionId: string) => void;
  onResolve?: (exceptionId: string) => void;
  onIgnore?: (exceptionId: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetryFetch?: () => void;
}

const severityConfig: Record<ExceptionSeverity, { dot: string; border: string; label: string }> = {
  critical: {
    dot: 'bg-danger-500',
    border: 'border-l-danger-500',
    label: 'Crítico',
  },
  high: {
    dot: 'bg-warning-500',
    border: 'border-l-warning-500',
    label: 'Alto',
  },
  medium: {
    dot: 'bg-info-500',
    border: 'border-l-info-500',
    label: 'Médio',
  },
  low: {
    dot: 'bg-gray-400',
    border: 'border-l-gray-400',
    label: 'Baixo',
  },
};

const statusBadgeVariant: Record<ExceptionStatus, 'danger' | 'warning' | 'success' | 'default'> = {
  open: 'danger',
  in_progress: 'warning',
  resolved: 'success',
  ignored: 'default',
};

const statusLabel: Record<ExceptionStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  ignored: 'Ignorado',
};

const typeIcon: Record<string, React.ReactNode> = {
  payment_mismatch: <XCircle className="w-4 h-4" aria-hidden="true" />,
  webhook_failed: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
  message_failed: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
  duplicate_invoice: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
  provider_error: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
  reconciliation_gap: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
};

function formatBRL(value?: number): string {
  if (value === undefined) return '';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExceptionPanel({
  exceptions,
  onRetry,
  onResolve,
  onIgnore,
  isLoading = false,
  error = null,
  onRetryFetch,
}: ExceptionPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showResolved, setShowResolved] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredExceptions = showResolved
    ? exceptions
    : exceptions.filter((e) => e.status !== 'resolved' && e.status !== 'ignored');

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando exceções">
        {[1, 2, 3, 4].map((i) => (
          <LoadingSkeleton key={i} variant="card" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetryFetch} />;
  }

  if (filteredExceptions.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle className="w-16 h-16" />}
        title="Nenhuma exceção encontrada"
        description="Todas as reconciliações estão em dia."
      />
    );
  }

  const pendingCount = exceptions.filter((e) => e.status !== 'resolved' && e.status !== 'ignored').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          Exceções e Reconciliação
          {pendingCount > 0 && (
            <Badge variant="danger" aria-label={`${pendingCount} exceções pendentes`}>
              {pendingCount}
            </Badge>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowResolved(!showResolved)}
          aria-label={showResolved ? 'Ocultar resolvidas' : 'Mostrar resolvidas'}
        >
          {showResolved ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
          {showResolved ? 'Ocultar resolvidas' : 'Mostrar resolvidas'}
        </Button>
      </div>

      {/* Exception list */}
      <ScrollArea className="max-h-[600px] overflow-y-auto space-y-3">
        {filteredExceptions.map((exception) => {
          const severity = severityConfig[exception.severity];
          const isExpanded = expandedIds.has(exception.id);
          const isMaxRetries =
            exception.retryCount !== undefined &&
            exception.maxRetries !== undefined &&
            exception.retryCount >= exception.maxRetries;

          return (
            <section
              key={exception.id}
              aria-labelledby={`exception-title-${exception.id}`}
              className={`bg-white rounded-xl border border-gray-100 border-l-4 ${severity.border} shadow-sm overflow-hidden`}
            >
              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => toggleExpand(exception.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                aria-expanded={isExpanded}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${severity.dot} flex-shrink-0`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 uppercase">{severity.label}</span>
                    <Badge variant={statusBadgeVariant[exception.status]}>{statusLabel[exception.status]}</Badge>
                  </div>
                  <h3 id={`exception-title-${exception.id}`} className="text-sm font-semibold text-gray-900 mt-0.5">
                    {exception.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {exception.clientName && `${exception.clientName} · `}
                    {formatDateTime(exception.occurredAt)}
                  </p>
                </div>
                <div className="flex-shrink-0 text-gray-400">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-5 h-5" aria-hidden="true" />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm text-gray-700">{exception.description}</p>

                  {exception.amount !== undefined && (
                    <div className="flex gap-4 text-sm">
                      <p className="text-gray-500">
                        Valor: <span className="font-medium text-gray-900">{formatBRL(exception.amount)}</span>
                      </p>
                      {exception.invoiceId && (
                        <p className="text-gray-500">
                          Fatura: <span className="font-medium text-gray-900">#{exception.invoiceId}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {exception.errorMessage && (
                    <div className="p-3 bg-danger-50 rounded-lg text-sm text-danger-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{exception.errorMessage}</span>
                    </div>
                  )}

                  {exception.retryCount !== undefined && exception.maxRetries !== undefined && (
                    <p className="text-xs text-gray-400">
                      Tentativa {exception.retryCount}/{exception.maxRetries}
                      {isMaxRetries && ' · Retries esgotados'}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(exception.id)}
                      disabled={isMaxRetries}
                      aria-label={`Tentar novamente exceção ${exception.id}`}
                    >
                      <RefreshCw className="w-4 h-4" aria-hidden="true" />
                      {isMaxRetries ? 'Retries esgotados' : 'Tentar novamente'}
                    </Button>
                    {onResolve && exception.status !== 'resolved' && (
                      <Button variant="ghost" size="sm" onClick={() => onResolve(exception.id)}>
                        Resolver
                      </Button>
                    )}
                    {onIgnore && exception.status !== 'ignored' && (
                      <Button variant="ghost" size="sm" onClick={() => onIgnore(exception.id)}>
                        Ignorar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </ScrollArea>

      {/* Bulk resolve */}
      {onResolve && pendingCount > 1 && (
        <div className="text-center pt-2">
          <Button variant="ghost" size="sm">
            Marcar todas como resolvidas
          </Button>
        </div>
      )}
    </div>
  );
}
