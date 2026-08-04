import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceTable } from '@/components/invoice-table';

const sampleInvoices = [
  {
    id: 'inv-1',
    clientName: 'João Silva',
    amount: 149.9,
    dueDate: '2026-08-15T00:00:00Z',
    status: 'PAID' as const,
  },
  {
    id: 'inv-2',
    clientName: 'Maria Santos',
    amount: 99.9,
    dueDate: '2026-08-10T00:00:00Z',
    status: 'PENDING' as const,
  },
  {
    id: 'inv-3',
    clientName: 'Carlos Oliveira',
    amount: 299.7,
    dueDate: '2026-07-01T00:00:00Z',
    status: 'OVERDUE' as const,
  },
];

describe('InvoiceTable', () => {
  it('deve renderizar cabeçalhos corretos', () => {
    render(<InvoiceTable invoices={sampleInvoices} />);

    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText('Valor')).toBeInTheDocument();
    expect(screen.getByText('Vencimento')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('deve renderizar os dados das faturas', () => {
    render(<InvoiceTable invoices={sampleInvoices} />);

    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Carlos Oliveira')).toBeInTheDocument();
  });

  it('deve formatar valores em reais', () => {
    render(<InvoiceTable invoices={sampleInvoices} />);

    expect(screen.getByText('R$ 149,90')).toBeInTheDocument();
    expect(screen.getByText('R$ 99,90')).toBeInTheDocument();
    expect(screen.getByText('R$ 299,70')).toBeInTheDocument();
  });

  it('deve exibir badges de status corretos', () => {
    render(<InvoiceTable invoices={sampleInvoices} />);

    expect(screen.getByText('Pago')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
  });

  it('deve exibir mensagem de lista vazia quando não há faturas', () => {
    render(<InvoiceTable invoices={[]} />);

    expect(screen.getByText('Nenhuma fatura encontrada.')).toBeInTheDocument();
  });

  it('deve chamar onRowClick ao clicar em uma linha', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();

    render(<InvoiceTable invoices={[sampleInvoices[0]]} onRowClick={onRowClick} />);

    await user.click(screen.getByText('João Silva'));

    expect(onRowClick).toHaveBeenCalledWith('inv-1');
  });

  it('não deve ter cursor pointer quando onRowClick não é fornecido', () => {
    render(<InvoiceTable invoices={[sampleInvoices[0]]} />);

    const row = screen.getByText('João Silva').closest('tr');
    expect(row?.className).not.toContain('cursor-pointer');
  });

  it('deve ter aria-label nas linhas quando onRowClick é fornecido', () => {
    render(<InvoiceTable invoices={[sampleInvoices[0]]} onRowClick={vi.fn()} />);

    const row = screen.getByRole('row', { name: /ver fatura de joão silva/i });
    expect(row).toBeInTheDocument();
  });
});
