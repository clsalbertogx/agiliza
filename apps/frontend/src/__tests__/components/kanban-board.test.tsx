import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KanbanBoard } from '@/components/kanban-board';

const mockInvoices = [
  {
    id: 'inv-1',
    clientName: 'João Silva',
    amount: 1500.0,
    dueDate: '2026-08-15T00:00:00.000Z',
    status: 'pending' as const,
    riskScore: 'yellow' as const,
    paymentMethod: 'pix' as const,
  },
  {
    id: 'inv-2',
    clientName: 'Maria Souza',
    amount: 3200.5,
    dueDate: '2026-07-01T00:00:00.000Z',
    status: 'overdue' as const,
    riskScore: 'red' as const,
    paymentMethod: 'boleto' as const,
  },
  {
    id: 'inv-3',
    clientName: 'Pedro Santos',
    amount: 850.0,
    dueDate: '2026-07-20T00:00:00.000Z',
    status: 'paid' as const,
    riskScore: 'green' as const,
    paymentMethod: 'credit_card' as const,
  },
  {
    id: 'inv-4',
    clientName: 'Ana Costa',
    amount: 2100.0,
    dueDate: '2026-08-30T00:00:00.000Z',
    status: 'pending' as const,
  },
];

describe('KanbanBoard', () => {
  const defaultProps = {
    invoices: mockInvoices,
    onStatusChange: vi.fn(),
  };

  describe('colunas', () => {
    it('deve renderizar labels padrão (aparece em mobile e desktop)', () => {
      render(<KanbanBoard {...defaultProps} />);

      // Ambos os layouts (mobile accordion + desktop) renderizam os badges
      const pendentes = screen.getAllByText('Pendentes');
      expect(pendentes.length).toBeGreaterThanOrEqual(1);

      const vencidas = screen.getAllByText('Vencidas');
      expect(vencidas.length).toBeGreaterThanOrEqual(1);

      const pagas = screen.getAllByText('Pagas');
      expect(pagas.length).toBeGreaterThanOrEqual(1);
    });

    it('deve renderizar labels customizados quando columns é fornecido', () => {
      render(
        <KanbanBoard
          {...defaultProps}
          columns={{
            pending: 'Aguardando',
            overdue: 'Atrasadas',
            paid: 'Quitadas',
          }}
        />,
      );

      const aguardando = screen.getAllByText('Aguardando');
      expect(aguardando.length).toBeGreaterThanOrEqual(1);

      const atrasadas = screen.getAllByText('Atrasadas');
      expect(atrasadas.length).toBeGreaterThanOrEqual(1);

      const quitadas = screen.getAllByText('Quitadas');
      expect(quitadas.length).toBeGreaterThanOrEqual(1);
    });

    it('deve exibir a contagem correta de itens em cada coluna', () => {
      render(<KanbanBoard {...defaultProps} />);

      // Desktop: aria-label na region
      const pendingRegion = screen.getByRole('region', { name: /pendentes - 2 faturas/i });
      const overdueRegion = screen.getByRole('region', { name: /vencidas - 1 faturas/i });
      const paidRegion = screen.getByRole('region', { name: /pagas - 1 faturas/i });

      expect(pendingRegion).toBeInTheDocument();
      expect(overdueRegion).toBeInTheDocument();
      expect(paidRegion).toBeInTheDocument();
    });
  });

  describe('cartões de fatura', () => {
    it('deve renderizar nome do cliente no cartão', () => {
      render(<KanbanBoard {...defaultProps} />);

      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Maria Souza')).toBeInTheDocument();
      expect(screen.getByText('Pedro Santos')).toBeInTheDocument();
    });

    it('deve renderizar valor formatado no cartão', () => {
      render(<KanbanBoard {...defaultProps} />);

      expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
      expect(screen.getByText('R$ 3.200,50')).toBeInTheDocument();
      expect(screen.getByText('R$ 850,00')).toBeInTheDocument();
    });

    it('deve renderizar RiskBadge quando riskScore é fornecido', () => {
      render(<KanbanBoard {...defaultProps} />);

      expect(screen.getByText('Médio Risco')).toBeInTheDocument();
      expect(screen.getByText('Alto Risco')).toBeInTheDocument();
      expect(screen.getByText('Baixo Risco')).toBeInTheDocument();
    });

    it('deve renderizar label do método de pagamento quando fornecido', () => {
      render(<KanbanBoard {...defaultProps} />);

      expect(screen.getByText('PIX')).toBeInTheDocument();
      expect(screen.getByText('Boleto')).toBeInTheDocument();
      expect(screen.getByText('Cartão')).toBeInTheDocument();
    });
  });

  describe('navegação e interação', () => {
    it('deve chamar onInvoiceClick ao clicar em um cartão', async () => {
      const onInvoiceClick = vi.fn();
      const user = userEvent.setup();
      render(<KanbanBoard {...defaultProps} onInvoiceClick={onInvoiceClick} />);

      const card = screen.getByLabelText('Fatura de João Silva - R$ 1.500,00');
      await user.click(card);

      expect(onInvoiceClick).toHaveBeenCalledWith('inv-1');
    });

    it('deve exibir menu "Mover para" ao clicar no botão de mover', async () => {
      const user = userEvent.setup();
      render(<KanbanBoard {...defaultProps} />);

      const moveButtons = screen.getAllByLabelText('Mover fatura');
      await user.click(moveButtons[0]);

      expect(screen.getByText('Mover para Pagas')).toBeInTheDocument();
    });

    it('deve chamar onStatusChange ao selecionar um destino no menu', async () => {
      const onStatusChange = vi.fn();
      const user = userEvent.setup();
      render(<KanbanBoard invoices={mockInvoices} onStatusChange={onStatusChange} />);

      const moveButtons = screen.getAllByLabelText('Mover fatura');
      await user.click(moveButtons[0]); // Primeiro card: João Silva (pending)

      await user.click(screen.getByText('Mover para Pagas'));

      expect(onStatusChange).toHaveBeenCalledWith('inv-1', 'paid');
    });
  });

  describe('empty state', () => {
    it('deve exibir "Nenhuma fatura encontrada" quando não há invoices', () => {
      render(<KanbanBoard invoices={[]} onStatusChange={vi.fn()} />);

      expect(screen.getByText('Nenhuma fatura encontrada')).toBeInTheDocument();
    });

    it('deve exibir descrição "Crie uma nova fatura para começar" quando vazio', () => {
      render(<KanbanBoard invoices={[]} onStatusChange={vi.fn()} />);

      expect(screen.getByText('Crie uma nova fatura para começar')).toBeInTheDocument();
    });
  });

  describe('colunas vazias', () => {
    it('deve exibir "Nenhuma fatura" em coluna sem itens', () => {
      const onlyPendingInvoices = [
        { ...mockInvoices[0] }, // apenas João Silva (pending)
      ];
      render(<KanbanBoard invoices={onlyPendingInvoices} onStatusChange={vi.fn()} />);

      // Colunas Vencidas e Pagas devem mostrar "Nenhuma fatura"
      const emptyTexts = screen.getAllByText('Nenhuma fatura');
      expect(emptyTexts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('loading state', () => {
    it('deve exibir loading skeleton quando isLoading é true', () => {
      const { container } = render(<KanbanBoard {...defaultProps} isLoading={true} />);

      const loading = screen.getByRole('status');
      expect(loading).toBeInTheDocument();
      expect(loading).toHaveAttribute('aria-label', 'Carregando quadro kanban');
    });

    it('não deve exibir cartões de fatura durante o loading', () => {
      render(<KanbanBoard {...defaultProps} isLoading={true} />);

      expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(<KanbanBoard {...defaultProps} error="Erro ao carregar faturas" onRetry={vi.fn()} />);

      expect(screen.getByText('Erro ao carregar faturas')).toBeInTheDocument();
    });

    it('deve exibir botão "Tentar novamente" quando error e onRetry são fornecidos', () => {
      render(<KanbanBoard {...defaultProps} error="Erro ao carregar" onRetry={vi.fn()} />);

      expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
    });
  });
});
