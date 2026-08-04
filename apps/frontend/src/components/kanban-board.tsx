'use client';

import { ScrollArea } from '@radix-ui/react-scroll-area';
import { ArrowRight, ChevronDown, ChevronRight, GripVertical, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { RiskBadge } from '@/components/risk-badge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export interface KanbanInvoice {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  riskScore?: 'green' | 'yellow' | 'red';
  paymentMethod?: 'pix' | 'boleto' | 'credit_card';
}

export interface KanbanBoardProps {
  invoices: KanbanInvoice[];
  columns?: {
    pending: string;
    overdue: string;
    paid: string;
  };
  onStatusChange: (invoiceId: string, newStatus: 'pending' | 'paid' | 'overdue') => void;
  onInvoiceClick?: (invoiceId: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const columnStatuses: Array<'pending' | 'overdue' | 'paid'> = ['pending', 'overdue', 'paid'];
const defaultLabels = { pending: 'Pendentes', overdue: 'Vencidas', paid: 'Pagas' };

const statusToBadgeVariant: Record<string, 'warning' | 'danger' | 'success'> = {
  pending: 'warning',
  overdue: 'danger',
  paid: 'success',
};

const paymentMethodLabel: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  credit_card: 'Cartão',
};

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

function KanbanCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function KanbanColumnSkeleton({ label, count }: { label: string; count: number }) {
  const _cards = ['Pendentes', 'Vencidas', 'Pagas'];
  return (
    <div className="bg-gray-50 rounded-xl p-4 min-w-[280px] flex-1">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-6 rounded-full" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <KanbanCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function InvoiceCard({
  invoice,
  onStatusChange,
  onInvoiceClick,
}: {
  invoice: KanbanInvoice;
  onStatusChange: (invoiceId: string, newStatus: 'pending' | 'paid' | 'overdue') => void;
  onInvoiceClick?: (invoiceId: string) => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const targetStatuses: Array<'pending' | 'paid' | 'overdue'> = ['pending', 'paid', 'overdue'];
  const availableTargets = targetStatuses.filter((s) => s !== invoice.status);

  return (
    // biome-ignore lint/a11y/useSemanticElements: outer element can't be <button> (contains a nested move-menu <button>; nesting is invalid) — kept as clickable div with role="button"
    <div
      className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow"
      role="button"
      tabIndex={0}
      onClick={() => onInvoiceClick?.(invoice.id)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onInvoiceClick) {
          e.preventDefault();
          onInvoiceClick(invoice.id);
        }
      }}
      aria-label={`Fatura de ${invoice.clientName} - ${formatBRL(invoice.amount)}`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle (visual only for MVP) */}
        <div className="flex-shrink-0 mt-0.5 text-gray-300" aria-hidden="true">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{invoice.clientName}</p>
          <p className="text-base font-bold text-gray-900 tabular-nums mt-0.5">{formatBRL(invoice.amount)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Vence: {formatDate(invoice.dueDate)}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {invoice.riskScore && <RiskBadge level={invoice.riskScore} />}
            {invoice.paymentMethod && (
              <span className="text-[10px] uppercase text-gray-400 font-medium">
                {paymentMethodLabel[invoice.paymentMethod]}
              </span>
            )}
          </div>
        </div>

        {/* Move menu */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMoveMenu(!showMoveMenu);
            }}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Mover fatura"
          >
            <ArrowRight className="w-4 h-4 text-gray-400" />
          </button>

          {showMoveMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1"
              role="menu"
              aria-label="Mover para"
            >
              {availableTargets.map((target) => (
                <button
                  key={target}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(invoice.id, target);
                    setShowMoveMenu(false);
                  }}
                >
                  Mover para {defaultLabels[target]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KanbanBoard({
  invoices,
  columns,
  onStatusChange,
  onInvoiceClick,
  isLoading = false,
  error = null,
  onRetry,
}: KanbanBoardProps) {
  const labels = { ...defaultLabels, ...columns };
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col lg:flex-row gap-4" role="status" aria-label="Carregando quadro kanban">
        {columnStatuses.map((status) => (
          <KanbanColumnSkeleton
            key={status}
            label={labels[status]}
            count={invoices.filter((inv) => inv.status === status).length}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  // Check if all columns are empty
  const totalCount = invoices.length;
  if (totalCount === 0) {
    return (
      <EmptyState
        icon={<LayoutDashboard className="w-16 h-16" />}
        title="Nenhuma fatura encontrada"
        description="Crie uma nova fatura para começar"
      />
    );
  }

  const getColumnInvoices = (status: 'pending' | 'overdue' | 'paid') => invoices.filter((inv) => inv.status === status);

  // Mobile: accordion-style
  const renderMobile = () => (
    <div className="space-y-3 lg:hidden">
      {columnStatuses.map((status) => {
        const columnInvoices = getColumnInvoices(status);
        const isOpen = mobileOpen === status;

        return (
          <div key={status} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              onClick={() => setMobileOpen(isOpen ? null : status)}
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-2">
                <Badge variant={statusToBadgeVariant[status]}>{labels[status]}</Badge>
                <span className="text-sm text-gray-500">({columnInvoices.length})</span>
              </div>
              {isOpen ? (
                <ChevronDown className="w-5 h-5 text-gray-400" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" aria-hidden="true" />
              )}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                {columnInvoices.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhuma fatura</p>
                ) : (
                  columnInvoices.map((inv) => (
                    <InvoiceCard
                      key={inv.id}
                      invoice={inv}
                      onStatusChange={onStatusChange}
                      onInvoiceClick={onInvoiceClick}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Desktop: 3-column kanban
  const renderDesktop = () => (
    <div className="hidden lg:flex gap-4">
      {columnStatuses.map((status) => {
        const columnInvoices = getColumnInvoices(status);

        return (
          <section
            key={status}
            className="flex-1 min-w-[280px] bg-gray-50 rounded-xl p-4"
            aria-label={`${labels[status]} - ${columnInvoices.length} faturas`}
          >
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={statusToBadgeVariant[status]}>{labels[status]}</Badge>
              <span className="text-sm text-gray-500 font-medium">({columnInvoices.length})</span>
            </div>

            <ScrollArea className="space-y-3 max-h-[600px] overflow-y-auto">
              {columnInvoices.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma fatura</p>
              ) : (
                columnInvoices.map((inv) => (
                  <InvoiceCard
                    key={inv.id}
                    invoice={inv}
                    onStatusChange={onStatusChange}
                    onInvoiceClick={onInvoiceClick}
                  />
                ))
              )}
            </ScrollArea>
          </section>
        );
      })}
    </div>
  );

  return (
    <div>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {invoices.length > 0 ? `${invoices.length} faturas no quadro` : 'Nenhuma fatura'}
      </div>
      {renderMobile()}
      {renderDesktop()}
    </div>
  );
}
