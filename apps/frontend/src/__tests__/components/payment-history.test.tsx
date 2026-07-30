import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentHistory } from '@/components/payment-history';

const mockPayments = [
  {
    id: 'pay-1',
    invoiceId: 'inv-1',
    clientName: 'João Silva',
    amount: 1500.00,
    method: 'pix' as const,
    status: 'paid' as const,
    paidAt: '2026-07-28T14:30:00.000Z',
    dueDate: '2026-07-15T00:00:00.000Z',
    provider: 'Stone',
  },
  {
    id: 'pay-2',
    invoiceId: 'inv-2',
    clientName: 'Maria Souza',
    amount: 3200.50,
    method: 'boleto' as const,
    status: 'pending' as const,
    dueDate: '2026-08-01T00:00:00.000Z',
    provider: 'Banco do Brasil',
  },
  {
    id: 'pay-3',
    invoiceId: 'inv-3',
    clientName: 'Pedro Santos',
    amount: 850.00,
    method: 'credit_card' as const,
    status: 'failed' as const,
    paidAt: '2026-07-25T10:00:00.000Z',
    dueDate: '2026-07-20T00:00:00.000Z',
    provider: 'Cielo',
  },
];

describe('PaymentHistory', () => {
  const defaultProps = {
    payments: mockPayments,
    total: 10,
    page: 1,
    perPage: 5,
    onPageChange: vi.fn(),
  };

  describe('título e cabeçalho', () => {
    it('deve renderizar o título "Histórico de Pagamentos"', () => {
      render(<PaymentHistory {...defaultProps} />);

      expect(
        screen.getByText('Histórico de Pagamentos'),
      ).toBeInTheDocument();
    });

    it('deve renderizar botão "Filtrar"', () => {
      render(<PaymentHistory {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: /filtrar pagamentos/i }),
      ).toBeInTheDocument();
    });
  });

  describe('tabela desktop', () => {
    it('deve renderizar tabela com role="table"', () => {
      render(<PaymentHistory {...defaultProps} />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    it('deve renderizar cabeçalhos das colunas', () => {
      render(<PaymentHistory {...defaultProps} />);

      expect(screen.getByText('Cliente')).toBeInTheDocument();
      expect(screen.getByText('Valor')).toBeInTheDocument();
      expect(screen.getByText('Método')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Data Pag.')).toBeInTheDocument();
    });

    it('deve renderizar dados dos clientes (pode aparecer na tabela e mobile)', () => {
      render(<PaymentHistory {...defaultProps} />);

      // Usa getAllByText porque o nome aparece na tabela desktop e no card mobile
      const joaoElements = screen.getAllByText('João Silva');
      expect(joaoElements.length).toBeGreaterThanOrEqual(1);

      const mariaElements = screen.getAllByText('Maria Souza');
      expect(mariaElements.length).toBeGreaterThanOrEqual(1);
    });

    it('deve renderizar valores formatados', () => {
      render(<PaymentHistory {...defaultProps} />);

      const valor1500 = screen.getAllByText((content, node) => content.includes('1.500,00'));
      expect(valor1500.length).toBeGreaterThanOrEqual(1);

      const valor850 = screen.getAllByText((content, node) => content.includes('850,00'));
      expect(valor850.length).toBeGreaterThanOrEqual(1);
    });

    it('deve renderizar badges de status com labels corretos', () => {
      render(<PaymentHistory {...defaultProps} />);

      const pagoElements = screen.getAllByText('Pago');
      expect(pagoElements.length).toBeGreaterThanOrEqual(1);

      const pendenteElements = screen.getAllByText('Pendente');
      expect(pendenteElements.length).toBeGreaterThanOrEqual(1);

      const falhouElements = screen.getAllByText('Falhou');
      expect(falhouElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('layout mobile (cards)', () => {
    it('deve renderizar cards dos clientes', () => {
      render(<PaymentHistory {...defaultProps} />);

      // Cards mobile existem junto da tabela
      const cardLabels = screen.getAllByLabelText(/pagamento de/i);
      expect(cardLabels.length).toBe(3);
    });
  });

  describe('paginação', () => {
    it('deve renderizar controles de paginação quando totalPages > 1', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          total={10}
          perPage={5}
        />,
      );

      const nav = screen.getByLabelText('Paginação');
      expect(nav).toBeInTheDocument();
    });

    it('deve exibir botão "Página anterior" desabilitado na primeira página', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          page={1}
        />,
      );

      const prevButton = screen.getByLabelText('Página anterior');
      expect(prevButton).toBeDisabled();
    });

    it('deve exibir botão "Próxima página" habilitado quando não está na última', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          total={10}
          perPage={5}
          page={1}
        />,
      );

      const nextButton = screen.getByLabelText('Próxima página');
      expect(nextButton).not.toBeDisabled();
    });

    it('deve exibir botão "Próxima página" desabilitado na última página', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          total={10}
          perPage={5}
          page={2}
        />,
      );

      const nextButton = screen.getByLabelText('Próxima página');
      expect(nextButton).toBeDisabled();
    });

    it('deve chamar onPageChange ao clicar em uma página', async () => {
      const onPageChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PaymentHistory
          {...defaultProps}
          onPageChange={onPageChange}
          total={10}
          perPage={5}
          page={1}
        />,
      );

      await user.click(screen.getByLabelText('Página 2'));

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('deve chamar onPageChange ao clicar em "Próxima página"', async () => {
      const onPageChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PaymentHistory
          {...defaultProps}
          onPageChange={onPageChange}
          total={10}
          perPage={5}
          page={1}
        />,
      );

      await user.click(screen.getByLabelText('Próxima página'));

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('não deve renderizar paginação quando totalPages é 1', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          total={3}
          perPage={5}
        />,
      );

      expect(screen.queryByLabelText('Paginação')).not.toBeInTheDocument();
    });
  });

  describe('filtro de status', () => {
    it('deve exibir dropdown de filtro ao clicar em "Filtrar"', async () => {
      const user = userEvent.setup();
      render(<PaymentHistory {...defaultProps} />);

      await user.click(
        screen.getByRole('button', { name: /filtrar pagamentos/i }),
      );

      expect(screen.getByText('Todos')).toBeInTheDocument();
      expect(screen.getByText('Pagos')).toBeInTheDocument();
      expect(screen.getByText('Pendentes')).toBeInTheDocument();
      expect(screen.getByText('Falhos')).toBeInTheDocument();
      expect(screen.getByText('Estornados')).toBeInTheDocument();
    });

    it('deve chamar onFilterChange ao selecionar um filtro', async () => {
      const onFilterChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PaymentHistory
          {...defaultProps}
          filterStatus=""
          onFilterChange={onFilterChange}
        />,
      );

      await user.click(
        screen.getByRole('button', { name: /filtrar pagamentos/i }),
      );
      await user.click(screen.getByText('Pagos'));

      expect(onFilterChange).toHaveBeenCalledWith('paid');
    });

    it('deve exibir badge com filtro ativo quando filterStatus é fornecido', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          filterStatus="paid"
        />,
      );

      expect(screen.getByText('Filtro: Pagos')).toBeInTheDocument();
    });

    it('deve exibir botão de limpar filtro quando filterStatus é fornecido', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          filterStatus="paid"
          onFilterChange={vi.fn()}
        />,
      );

      expect(
        screen.getByLabelText('Limpar filtro'),
      ).toBeInTheDocument();
    });

    it('deve chamar onFilterChange(null) ao limpar filtro', async () => {
      const onFilterChange = vi.fn();
      const user = userEvent.setup();
      render(
        <PaymentHistory
          {...defaultProps}
          filterStatus="paid"
          onFilterChange={onFilterChange}
        />,
      );

      await user.click(screen.getByLabelText('Limpar filtro'));

      expect(onFilterChange).toHaveBeenCalledWith(null);
    });
  });

  describe('empty states', () => {
    it('deve exibir mensagem "Nenhum pagamento encontrado" quando lista está vazia', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          payments={[]}
          total={0}
        />,
      );

      expect(
        screen.getByText('Nenhum pagamento encontrado'),
      ).toBeInTheDocument();
    });

    it('deve exibir "Nenhum resultado para este filtro" quando filtro ativo sem resultados', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          payments={[]}
          total={0}
          filterStatus="paid"
        />,
      );

      expect(
        screen.getByText('Nenhum resultado para este filtro'),
      ).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('deve exibir LoadingSkeleton quando isLoading é true', () => {
      render(
        <PaymentHistory {...defaultProps} isLoading={true} />,
      );

      const loading = screen.getByRole('status');
      expect(loading).toBeInTheDocument();
      expect(loading).toHaveAttribute('aria-label', 'Carregando...');
    });

    it('não deve exibir dados da tabela durante o loading', () => {
      render(
        <PaymentHistory {...defaultProps} isLoading={true} />,
      );

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(
        <PaymentHistory
          {...defaultProps}
          error="Erro ao carregar pagamentos"
          onRetry={vi.fn()}
        />,
      );

      expect(
        screen.getByText('Erro ao carregar pagamentos'),
      ).toBeInTheDocument();
    });
  });

  describe('clique em pagamento', () => {
    it('deve chamar onPaymentClick ao clicar em um payment', async () => {
      const onPaymentClick = vi.fn();
      const user = userEvent.setup();
      render(
        <PaymentHistory
          {...defaultProps}
          onPaymentClick={onPaymentClick}
        />,
      );

      // O card mobile tem role="button" e aria-label
      const paymentCards = screen.getAllByLabelText(/pagamento de/i);
      await user.click(paymentCards[0]);

      expect(onPaymentClick).toHaveBeenCalled();
    });
  });

  describe('estados de estorno (refunded)', () => {
    it('deve exibir "Estornado" quando status é refunded', () => {
      const paymentsWithRefund = [
        {
          ...mockPayments[0],
          status: 'refunded' as const,
          id: 'pay-4',
          clientName: 'Ana Costa',
        },
      ];
      render(
        <PaymentHistory
          {...defaultProps}
          payments={paymentsWithRefund}
          total={1}
        />,
      );

      const estornadoElements = screen.getAllByText('Estornado');
      expect(estornadoElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
