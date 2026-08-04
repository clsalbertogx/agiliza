'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';

type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE';

interface Invoice {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  onRowClick?: (id: string) => void;
}

const statusToBadgeVariant: Record<InvoiceStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
};

const statusLabel: Record<InvoiceStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  OVERDUE: 'Vencido',
};

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

export function InvoiceTable({ invoices, onRowClick }: InvoiceTableProps) {
  if (invoices.length === 0) {
    return <div className="text-center py-12 text-gray-500 text-sm">Nenhuma fatura encontrada.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <th scope="col" className="p-4 text-left text-sm font-medium text-gray-500">
            Cliente
          </th>
          <th scope="col" className="p-4 text-left text-sm font-medium text-gray-500">
            Valor
          </th>
          <th scope="col" className="p-4 text-left text-sm font-medium text-gray-500">
            Vencimento
          </th>
          <th scope="col" className="p-4 text-left text-sm font-medium text-gray-500">
            Status
          </th>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow
            key={invoice.id}
            className={onRowClick ? 'cursor-pointer' : ''}
            onClick={() => onRowClick?.(invoice.id)}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={
              onRowClick
                ? (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(invoice.id);
                    }
                  }
                : undefined
            }
            aria-label={onRowClick ? `Ver fatura de ${invoice.clientName}` : undefined}
          >
            <TableCell className="font-medium text-gray-900">{invoice.clientName}</TableCell>
            <TableCell className="text-gray-900 tabular-nums">{formatBRL(invoice.amount)}</TableCell>
            <TableCell className="text-gray-600">{formatDate(invoice.dueDate)}</TableCell>
            <TableCell>
              <Badge variant={statusToBadgeVariant[invoice.status]}>{statusLabel[invoice.status]}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
