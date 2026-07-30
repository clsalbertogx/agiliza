import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceForm } from '@/components/invoice-form';

const mockClients = [
  {
    id: 'client-1',
    name: 'João Silva',
    phone: '11999999999',
    riskScore: 'yellow' as const,
  },
  {
    id: 'client-2',
    name: 'Maria Souza',
    phone: '11988888888',
    riskScore: 'green' as const,
  },
  {
    id: 'client-3',
    name: 'Pedro Santos',
    phone: '11977777777',
    riskScore: 'red' as const,
  },
];

describe('InvoiceForm', () => {
  const defaultProps = {
    clients: mockClients,
    onSubmit: vi.fn(),
  };

  describe('renderização dos campos', () => {
    it('deve renderizar o título "Nova Fatura" no modo criação', () => {
      render(<InvoiceForm {...defaultProps} />);

      expect(
        screen.getByText('Nova Fatura'),
      ).toBeInTheDocument();
    });

    it('deve renderizar o título "Editar Fatura" no modo edição', () => {
      render(
        <InvoiceForm
          {...defaultProps}
          initialData={{ clientId: 'client-1' }}
        />,
      );

      expect(
        screen.getByText('Editar Fatura'),
      ).toBeInTheDocument();
    });

    it('deve renderizar campo de busca de cliente', () => {
      render(<InvoiceForm {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('Buscar cliente...'),
      ).toBeInTheDocument();
    });

    it('deve renderizar campo de valor', () => {
      render(<InvoiceForm {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('R$ 1.500,00'),
      ).toBeInTheDocument();
    });

    it('deve renderizar campo de data de vencimento', () => {
      render(<InvoiceForm {...defaultProps} />);

      expect(
        screen.getByLabelText('Data de Vencimento *'),
      ).toBeInTheDocument();
    });

    it('deve renderizar opções de método de pagamento', () => {
      render(<InvoiceForm {...defaultProps} />);

      expect(screen.getByText('PIX')).toBeInTheDocument();
      expect(screen.getByText('Boleto')).toBeInTheDocument();
      expect(screen.getByText('Cartão')).toBeInTheDocument();
    });

    it('deve renderizar campo de descrição opcional', () => {
      render(<InvoiceForm {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('Mensalidade Agosto/2026'),
      ).toBeInTheDocument();
    });
  });

  describe('seleção de cliente', () => {
    it('deve exibir dropdown de clientes ao digitar 2+ caracteres', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Buscar cliente...');
      await user.type(searchInput, 'Jo');

      expect(
        screen.getByRole('listbox'),
      ).toBeInTheDocument();
    });

    it('deve filtrar clientes pelo nome', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Buscar cliente...');
      await user.type(searchInput, 'Maria');

      expect(screen.getByText('Maria Souza')).toBeInTheDocument();
      expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
    });

    it('deve selecionar um cliente ao clicar na opção', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Buscar cliente...');
      await user.type(searchInput, 'João');

      await user.click(screen.getByText('João Silva'));

      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText('Buscar cliente...'),
      ).not.toBeInTheDocument();
    });

    it('deve exibir RiskBadge do cliente selecionado', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Buscar cliente...');
      await user.type(searchInput, 'Pedro');

      await user.click(screen.getByText('Pedro Santos'));

      expect(screen.getByText('Alto Risco')).toBeInTheDocument();
    });

    it('deve exibir "Nenhum cliente encontrado" quando não há match', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Buscar cliente...');
      await user.type(searchInput, 'ZZ');

      expect(
        screen.getByText('Nenhum cliente encontrado'),
      ).toBeInTheDocument();
    });
  });

  describe('formatação de valor', () => {
    it('deve formatar valor no formato BRL ao sair do campo', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm {...defaultProps} />);

      const amountInput = screen.getByPlaceholderText('R$ 1.500,00');
      await user.type(amountInput, '2500,50');
      fireEvent.blur(amountInput);

      // toLocaleString('pt-BR') usa non-breaking space (\u00A0) entre R$ e o valor
      expect(amountInput).toHaveValue('R$\u00A02.500,50');
    });
  });

  describe('validação', () => {
    it('deve desabilitar botão de submit quando formulário é inválido', () => {
      render(<InvoiceForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /criar fatura/i });
      expect(submitButton).toBeDisabled();
    });

    it('deve habilitar botão de submit quando formulário é válido', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm {...defaultProps} />);

      // Selecionar cliente
      const searchInput = screen.getByPlaceholderText('Buscar cliente...');
      await user.type(searchInput, 'João');
      await user.click(screen.getByText('João Silva'));

      // Preencher valor
      const amountInput = screen.getByPlaceholderText('R$ 1.500,00');
      await user.type(amountInput, '1500');

      // Preencher data
      const dateInput = screen.getByLabelText('Data de Vencimento *');
      await user.type(dateInput, '2026-08-30');

      const submitButton = screen.getByRole('button', { name: /criar fatura/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('deve exibir erros de campo quando fieldErrors é fornecido', () => {
      render(
        <InvoiceForm
          {...defaultProps}
          fieldErrors={{
            clientId: 'Selecione um cliente',
            amount: 'Valor inválido',
          }}
        />,
      );

      expect(screen.getByText('Selecione um cliente')).toBeInTheDocument();
      expect(screen.getByText('Valor inválido')).toBeInTheDocument();
    });
  });

  describe('submissão do formulário', () => {
    it('deve chamar onSubmit com os dados corretos', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <InvoiceForm clients={mockClients} onSubmit={onSubmit} />,
      );

      // Selecionar cliente
      const searchInput = screen.getByPlaceholderText('Buscar cliente...');
      await user.type(searchInput, 'João');
      await user.click(screen.getByText('João Silva'));

      // Preencher valor
      const amountInput = screen.getByPlaceholderText('R$ 1.500,00');
      await user.type(amountInput, '2500');

      // Preencher data
      const dateInput = screen.getByLabelText('Data de Vencimento *');
      await user.type(dateInput, '2026-08-30');

      // Submeter
      const submitButton = screen.getByRole('button', { name: /criar fatura/i });
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        clientId: 'client-1',
        amount: 2500,
        dueDate: '2026-08-30',
        paymentMethod: 'pix',
        description: undefined,
      });
    });

    it('deve incluir descrição quando fornecida', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <InvoiceForm clients={mockClients} onSubmit={onSubmit} />,
      );

      // Selecionar cliente
      const searchInput = screen.getByPlaceholderText('Buscar cliente...');
      await user.type(searchInput, 'João');
      await user.click(screen.getByText('João Silva'));

      // Preencher valor
      const amountInput = screen.getByPlaceholderText('R$ 1.500,00');
      await user.type(amountInput, '1500');

      // Preencher data
      const dateInput = screen.getByLabelText('Data de Vencimento *');
      await user.type(dateInput, '2026-08-30');

      // Preencher descrição
      const descInput = screen.getByPlaceholderText('Mensalidade Agosto/2026');
      await user.type(descInput, 'Mensalidade Setembro');

      // Submeter
      await user.click(screen.getByRole('button', { name: /criar fatura/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Mensalidade Setembro',
        }),
      );
    });

    it('deve exibir botão "Voltar" quando onCancel é fornecido', () => {
      render(
        <InvoiceForm {...defaultProps} onCancel={vi.fn()} />,
      );

      expect(
        screen.getByRole('button', { name: /voltar/i }),
      ).toBeInTheDocument();
    });
  });

  describe('submitting state', () => {
    it('deve exibir spinner no botão quando isSubmitting é true', () => {
      render(
        <InvoiceForm
          {...defaultProps}
          isSubmitting={true}
        />,
      );

      const submitButton = screen.getByRole('button', { name: /criar fatura/i });
      expect(submitButton).toBeDisabled();
      // O Loader2 com classe animate-spin deve estar presente
      const spinner = submitButton.querySelector('[class*="animate-spin"]');
      expect(spinner).toBeInTheDocument();
    });

    it('deve exibir submitLabel customizado', () => {
      render(
        <InvoiceForm
          {...defaultProps}
          submitLabel="Atualizar Fatura"
        />,
      );

      expect(
        screen.getByRole('button', { name: /atualizar fatura/i }),
      ).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('deve exibir LoadingSkeleton quando isLoading é true', () => {
      render(
        <InvoiceForm {...defaultProps} isLoading={true} />,
      );

      const loading = screen.getByRole('status');
      expect(loading).toBeInTheDocument();
      expect(loading).toHaveAttribute('aria-label', 'Carregando...');
    });
  });

  describe('error state', () => {
    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(
        <InvoiceForm
          {...defaultProps}
          error="Erro ao carregar dados do cliente"
        />,
      );

      expect(
        screen.getByText('Erro ao carregar dados do cliente'),
      ).toBeInTheDocument();
    });
  });

  describe('seleção de método de pagamento', () => {
    it('deve iniciar com PIX selecionado por padrão', () => {
      render(<InvoiceForm {...defaultProps} />);

      const pixRadio = screen.getByLabelText('PIX');
      expect(pixRadio).toBeChecked();
    });

    it('deve permitir alterar método de pagamento', async () => {
      const user = userEvent.setup();
      render(<InvoiceForm {...defaultProps} />);

      const boletoLabel = screen.getByText('Boleto');
      await user.click(boletoLabel);

      const boletoRadio = screen.getByLabelText('Boleto');
      expect(boletoRadio).toBeChecked();
    });
  });
});
