'use client';

import { ChevronLeft, ChevronRight, CreditCard, FileText, Filter, QrCode, Receipt, X } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  clientName: string;
  amount: number;
  method: 'pix' | 'boleto' | 'credit_card';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paidAt?: string;
  dueDate: string;
  provider: string;
}

export interface PaymentHistoryProps {
  payments: PaymentRecord[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPaymentClick?: (paymentId: string) => void;
  filterStatus?: string;
  onFilterChange?: (status: string | null) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const methodConfig: Record<string, { icon: React.ReactNode; label: string }> = {
  pix: {
    icon: <QrCode className="w-4 h-4" aria-hidden="true" />,
    label: 'PIX',
  },
  boleto: {
    icon: <FileText className="w-4 h-4" aria-hidden="true" />,
    label: 'Boleto',
  },
  credit_card: {
    icon: <CreditCard className="w-4 h-4" aria-hidden="true" />,
    label: 'Cartão',
  },
};

const statusToBadgeVariant: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  refunded: 'default',
};

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Estornado',
};

const filterOptions = [
  { value: '', label: 'Todos' },
  { value: 'paid', label: 'Pagos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'failed', label: 'Falhos' },
  { value: 'refunded', label: 'Estornados' },
];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR');
}

export function PaymentHistory({
  payments,
  total,
  page,
  perPage,
  onPageChange,
  onPaymentClick,
  filterStatus,
  onFilterChange,
  isLoading = false,
  error = null,
  onRetry,
}: PaymentHistoryProps) {
  const [showFilter, setShowFilter] = useState(false);
  const totalPages = Math.ceil(total / perPage);

  if (isLoading) {
    return <LoadingSkeleton variant="table" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const isFiltered = payments.length === 0 && filterStatus;
  const isUnfilteredEmpty = payments.length === 0 && !filterStatus;

  // Mobile card layout
  const renderMobileCard = (payment: PaymentRecord) => {
    const method = methodConfig[payment.method] ?? { icon: null, label: payment.method };
    return (
      <div
        key={payment.id}
        className={`bg-white rounded-xl border border-gray-100 p-4 shadow-sm ${
          onPaymentClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
        }`}
        onClick={() => onPaymentClick?.(payment.id)}
        role={onPaymentClick ? 'button' : undefined}
        tabIndex={onPaymentClick ? 0 : undefined}
        onKeyDown={
          onPaymentClick
            ? (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPaymentClick(payment.id);
                }
              }
            : undefined
        }
        aria-label={`Pagamento de ${payment.clientName} - ${formatBRL(payment.amount)}`}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900">{payment.clientName}</p>
          <Badge variant={statusToBadgeVariant[payment.status]}>{statusLabel[payment.status]}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-gray-900 tabular-nums">{formatBRL(payment.amount)}</span>
          <span className="flex items-center gap-1 text-gray-500">
            {method.icon}
            {method.label}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Vencimento: {formatDate(payment.dueDate)}
          {payment.paidAt && ` | Pago: ${formatDate(payment.paidAt)}`}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Histórico de Pagamentos</h2>
        <div className="flex items-center gap-2">
          {filterStatus && (
            <Badge variant="default" className="flex items-center gap-1">
              <span>Filtro: {filterOptions.find((f) => f.value === filterStatus)?.label}</span>
              <button
                type="button"
                onClick={() => onFilterChange?.(null)}
                className="ml-1 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Limpar filtro"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilter(!showFilter)}
              aria-label="Filtrar pagamentos"
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
              Filtrar
            </Button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      filterStatus === option.value || (!filterStatus && option.value === '')
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      onFilterChange?.(option.value || null);
                      setShowFilter(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty states */}
      {isFiltered && (
        <EmptyState
          icon={<Filter className="w-16 h-16" />}
          title="Nenhum resultado para este filtro"
          action={{
            label: 'Limpar filtros',
            onClick: () => onFilterChange?.(null),
          }}
        />
      )}

      {isUnfilteredEmpty && (
        <EmptyState
          icon={<Receipt className="w-16 h-16" />}
          title="Nenhum pagamento encontrado"
          action={{
            label: 'Criar nova fatura',
            onClick: () => {},
          }}
        />
      )}

      {payments.length === 0 && !isFiltered && !isUnfilteredEmpty && (
        <EmptyState icon={<Receipt className="w-16 h-16" />} title="Nenhum pagamento encontrado" />
      )}

      {/* Desktop table */}
      {payments.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table aria-label="Histórico de pagamentos">
              <TableHeader>
                <TableRow>
                  <th scope="col" className="p-4 text-left text-sm font-medium text-gray-500">
                    Cliente
                  </th>
                  <th scope="col" className="p-4 text-left text-sm font-medium text-gray-500">
                    Valor
                  </th>
                  <th scope="col" className="p-4 text-left text-sm font-medium text-gray-500">
                    Método
                  </th>
                  <th scope="col" className="p-4 text-left text-sm font-medium text-gray-500">
                    Status
                  </th>
                  <th scope="col" className="p-4 text-left text-sm font-medium text-gray-500">
                    Data Pag.
                  </th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const method = methodConfig[payment.method] ?? { icon: null, label: payment.method };
                  return (
                    <TableRow
                      key={payment.id}
                      className={onPaymentClick ? 'cursor-pointer' : ''}
                      onClick={() => onPaymentClick?.(payment.id)}
                      tabIndex={onPaymentClick ? 0 : undefined}
                      onKeyDown={
                        onPaymentClick
                          ? (e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onPaymentClick(payment.id);
                              }
                            }
                          : undefined
                      }
                    >
                      <TableCell className="font-medium text-gray-900">{payment.clientName}</TableCell>
                      <TableCell className="text-gray-900 tabular-nums font-medium">
                        {formatBRL(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                          {method.icon}
                          {method.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusToBadgeVariant[payment.status]}>{statusLabel[payment.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">{formatDate(payment.paidAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">{payments.map(renderMobileCard)}</div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-1" aria-label="Paginação">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  aria-label={`Página ${pageNum}`}
                  aria-current={pageNum === page ? 'page' : undefined}
                >
                  {pageNum}
                </Button>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                aria-label="Próxima página"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
