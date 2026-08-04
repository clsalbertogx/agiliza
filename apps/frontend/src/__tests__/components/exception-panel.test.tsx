import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ExceptionItem, ExceptionPanel, type ExceptionSeverity } from '@/components/exception-panel';

const baseExceptions: ExceptionItem[] = [
  {
    id: 'exc-1',
    type: 'payment_mismatch',
    severity: 'critical',
    status: 'open',
    title: 'Divergência de R$ 150,00',
    description: 'Valor pago difere do valor da fatura.',
    invoiceId: 'inv-1',
    clientName: 'João Silva',
    amount: 1500,
    errorMessage: 'Pagamento parcial detectado',
    occurredAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:05:00.000Z',
    retryCount: 1,
    maxRetries: 3,
  },
  {
    id: 'exc-2',
    type: 'webhook_failed',
    severity: 'high',
    status: 'in_progress',
    title: 'Webhook do provedor falhou',
    description: 'O provedor de pagamento não respondeu.',
    clientName: 'Maria Souza',
    occurredAt: '2026-07-28T09:00:00.000Z',
    updatedAt: '2026-07-28T09:30:00.000Z',
    retryCount: 2,
    maxRetries: 3,
  },
];

function makeException(overrides: Partial<ExceptionItem> & { id: string }): ExceptionItem {
  return {
    type: 'provider_error',
    severity: 'medium',
    status: 'open',
    title: 'Exceção genérica',
    description: 'Descrição padrão.',
    clientName: 'Cliente Padrão',
    occurredAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
    ...overrides,
  };
}

describe('ExceptionPanel', () => {
  const defaultProps = {
    exceptions: baseExceptions,
    onRetry: vi.fn(),
    onResolve: vi.fn(),
    onIgnore: vi.fn(),
  };

  describe('estados de carregamento e erro', () => {
    it('deve exibir skeleton com aria-label "Carregando exceções" quando isLoading é true', () => {
      render(<ExceptionPanel {...defaultProps} isLoading={true} />);

      const loading = screen.getByRole('status', { name: 'Carregando exceções' });
      expect(loading).toBeInTheDocument();
    });

    it('não deve exibir a lista de exceções durante o carregamento', () => {
      render(<ExceptionPanel {...defaultProps} isLoading={true} />);

      expect(screen.queryByText('Divergência de R$ 150,00')).not.toBeInTheDocument();
    });

    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(<ExceptionPanel {...defaultProps} error="Erro ao carregar exceções" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Erro ao carregar exceções')).toBeInTheDocument();
    });

    it('deve chamar onRetryFetch ao clicar em "Tentar novamente" no estado de erro', async () => {
      const onRetryFetch = vi.fn();
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} error="Erro ao carregar" onRetryFetch={onRetryFetch} />);

      await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

      expect(onRetryFetch).toHaveBeenCalledOnce();
    });
  });

  describe('cabeçalho e contagem de pendentes', () => {
    it('deve renderizar o título "Exceções e Reconciliação"', () => {
      render(<ExceptionPanel {...defaultProps} />);

      expect(screen.getByText('Exceções e Reconciliação')).toBeInTheDocument();
    });

    it('deve exibir badge com a quantidade de exceções pendentes', () => {
      render(<ExceptionPanel {...defaultProps} />);

      expect(screen.getByLabelText('2 exceções pendentes')).toBeInTheDocument();
    });

    it('não deve exibir badge de pendentes quando todas as exceções estão resolvidas', () => {
      const resolvedOnly = [makeException({ id: 'exc-r', status: 'resolved' })];
      render(<ExceptionPanel {...defaultProps} exceptions={resolvedOnly} />);

      expect(screen.queryByLabelText(/exceções pendentes/)).not.toBeInTheDocument();
    });
  });

  describe('cartões de exceção', () => {
    it('deve renderizar o título de cada exceção', () => {
      render(<ExceptionPanel {...defaultProps} />);

      expect(screen.getByText('Divergência de R$ 150,00')).toBeInTheDocument();
      expect(screen.getByText('Webhook do provedor falhou')).toBeInTheDocument();
    });

    it('deve renderizar o label de severidade de cada exceção', () => {
      const severities: ExceptionSeverity[] = ['critical', 'high', 'medium', 'low'];
      const exceptions = severities.map((severity, i) => makeException({ id: `exc-sv-${i}`, severity }));

      render(<ExceptionPanel {...defaultProps} exceptions={exceptions} />);

      expect(screen.getByText('Crítico')).toBeInTheDocument();
      expect(screen.getByText('Alto')).toBeInTheDocument();
      expect(screen.getByText('Médio')).toBeInTheDocument();
      expect(screen.getByText('Baixo')).toBeInTheDocument();
    });

    it('deve renderizar badges de status com os labels corretos', () => {
      render(<ExceptionPanel {...defaultProps} />);

      expect(screen.getByText('Aberto')).toBeInTheDocument();
      expect(screen.getByText('Em andamento')).toBeInTheDocument();
    });

    it('deve renderizar o nome do cliente e a data de ocorrência', () => {
      render(<ExceptionPanel {...defaultProps} />);

      expect(screen.getByText(/João Silva/)).toBeInTheDocument();
      expect(screen.getByText(/Maria Souza/)).toBeInTheDocument();
    });

    it('deve aplicar classe de borda específica da severidade no cartão', () => {
      const { container } = render(<ExceptionPanel {...defaultProps} />);

      const section = container.querySelector('section[aria-labelledby="exception-title-exc-1"]');
      expect(section).toHaveClass('border-l-danger-500');
    });
  });

  describe('comportamento colapsável', () => {
    it('deve ocultar a descrição por padrão (cartão colapsado)', () => {
      render(<ExceptionPanel {...defaultProps} />);

      expect(screen.queryByText('Valor pago difere do valor da fatura.')).not.toBeInTheDocument();
    });

    it('deve exibir a descrição ao expandir o cartão', async () => {
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Divergência de R\$ 150,00/ }));

      expect(screen.getByText('Valor pago difere do valor da fatura.')).toBeInTheDocument();
    });

    it('deve alternar aria-expanded ao expandir e recolher', async () => {
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} />);

      const toggle = screen.getByRole('button', { name: /Divergência de R\$ 150,00/ });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');

      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('deve exibir valor formatado e número da fatura quando fornecidos', async () => {
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Divergência de R\$ 150,00/ }));

      expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
      expect(screen.getByText('#inv-1')).toBeInTheDocument();
    });

    it('deve exibir a mensagem de erro do provedor apenas quando expandido', async () => {
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} />);

      expect(screen.queryByText('Pagamento parcial detectado')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Divergência de R\$ 150,00/ }));

      expect(screen.getByText('Pagamento parcial detectado')).toBeInTheDocument();
    });

    it('deve exibir o contador de tentativas quando retryCount e maxRetries são fornecidos', async () => {
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Divergência de R\$ 150,00/ }));

      expect(screen.getByText(/Tentativa 1\/3/)).toBeInTheDocument();
    });
  });

  describe('ações de retry, resolve e ignore', () => {
    it('deve chamar onRetry com o id da exceção ao clicar em "Tentar novamente"', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} onRetry={onRetry} />);

      await user.click(screen.getByRole('button', { name: /Divergência de R\$ 150,00/ }));
      await user.click(screen.getByRole('button', { name: 'Tentar novamente exceção exc-1' }));

      expect(onRetry).toHaveBeenCalledWith('exc-1');
    });

    it('deve chamar onResolve com o id da exceção ao clicar em "Resolver"', async () => {
      const onResolve = vi.fn();
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} onResolve={onResolve} />);

      await user.click(screen.getByRole('button', { name: /Divergência de R\$ 150,00/ }));
      await user.click(screen.getByRole('button', { name: 'Resolver' }));

      expect(onResolve).toHaveBeenCalledWith('exc-1');
    });

    it('deve chamar onIgnore com o id da exceção ao clicar em "Ignorar"', async () => {
      const onIgnore = vi.fn();
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} onIgnore={onIgnore} />);

      await user.click(screen.getByRole('button', { name: /Divergência de R\$ 150,00/ }));
      await user.click(screen.getByRole('button', { name: 'Ignorar' }));

      expect(onIgnore).toHaveBeenCalledWith('exc-1');
    });

    it('não deve renderizar botão "Resolver" quando o status é resolved', async () => {
      const user = userEvent.setup();
      const resolvedExc = makeException({
        id: 'exc-resolved',
        title: 'Falha já resolvida',
        status: 'resolved',
      });

      render(
        <ExceptionPanel
          exceptions={[baseExceptions[0], resolvedExc]}
          onRetry={vi.fn()}
          onResolve={vi.fn()}
          onIgnore={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Mostrar resolvidas' }));
      await user.click(screen.getByRole('button', { name: /Falha já resolvida/ }));

      expect(screen.queryByRole('button', { name: 'Resolver' })).not.toBeInTheDocument();
    });

    it('não deve renderizar botão "Ignorar" quando o status é ignored', async () => {
      const user = userEvent.setup();
      const ignoredExc = makeException({
        id: 'exc-ignored',
        title: 'Falha ignorada',
        status: 'ignored',
      });

      render(
        <ExceptionPanel
          exceptions={[baseExceptions[0], ignoredExc]}
          onRetry={vi.fn()}
          onResolve={vi.fn()}
          onIgnore={vi.fn()}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Mostrar resolvidas' }));
      await user.click(screen.getByRole('button', { name: /Falha ignorada/ }));

      expect(screen.queryByRole('button', { name: 'Ignorar' })).not.toBeInTheDocument();
    });
  });

  describe('guarda de retries máximos', () => {
    function renderMaxedException(onRetry = vi.fn()) {
      const maxedExc = makeException({
        id: 'exc-max',
        title: 'Falha no provedor',
        retryCount: 3,
        maxRetries: 3,
      });

      render(<ExceptionPanel exceptions={[maxedExc]} onRetry={onRetry} onResolve={vi.fn()} />);

      return onRetry;
    }

    it('deve desabilitar o botão de retry quando retryCount atinge maxRetries', async () => {
      const user = userEvent.setup();
      renderMaxedException();

      await user.click(screen.getByRole('button', { name: /Falha no provedor/ }));

      expect(screen.getByRole('button', { name: 'Tentar novamente exceção exc-max' })).toBeDisabled();
    });

    it('deve exibir "Retries esgotados" no botão quando o limite é atingido', async () => {
      const user = userEvent.setup();
      renderMaxedException();

      await user.click(screen.getByRole('button', { name: /Falha no provedor/ }));

      const retryButton = screen.getByRole('button', {
        name: 'Tentar novamente exceção exc-max',
      });
      expect(within(retryButton).getByText('Retries esgotados')).toBeInTheDocument();
    });

    it('deve exibir a indicação "Retries esgotados" no contador de tentativas', async () => {
      const user = userEvent.setup();
      renderMaxedException();

      await user.click(screen.getByRole('button', { name: /Falha no provedor/ }));

      expect(screen.getByText(/Tentativa 3\/3/)).toBeInTheDocument();
      expect(screen.getByText(/Tentativa 3\/3 · Retries esgotados/)).toBeInTheDocument();
    });

    it('não deve chamar onRetry ao clicar no botão desabilitado', async () => {
      const onRetry = renderMaxedException();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Falha no provedor/ }));
      await user.click(screen.getByRole('button', { name: 'Tentar novamente exceção exc-max' }));

      expect(onRetry).not.toHaveBeenCalled();
    });
  });

  describe('filtro de exceções resolvidas/ignoradas', () => {
    it('deve ocultar exceções resolvidas por padrão', () => {
      const withResolved = [
        ...baseExceptions,
        makeException({ id: 'exc-r', title: 'Falha resolvida', status: 'resolved' }),
      ];

      render(<ExceptionPanel exceptions={withResolved} onRetry={vi.fn()} />);

      expect(screen.queryByText('Falha resolvida')).not.toBeInTheDocument();
    });

    it('deve exibir exceções resolvidas após clicar em "Mostrar resolvidas"', async () => {
      const user = userEvent.setup();
      const withResolved = [
        ...baseExceptions,
        makeException({ id: 'exc-r', title: 'Falha resolvida', status: 'resolved' }),
      ];

      render(<ExceptionPanel exceptions={withResolved} onRetry={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Mostrar resolvidas' }));

      expect(screen.getByText('Falha resolvida')).toBeInTheDocument();
    });

    it('deve alternar o label do botão para "Ocultar resolvidas"', async () => {
      const user = userEvent.setup();
      render(<ExceptionPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Mostrar resolvidas' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Mostrar resolvidas' }));

      expect(screen.getByRole('button', { name: 'Ocultar resolvidas' })).toBeInTheDocument();
    });
  });

  describe('ação em massa', () => {
    it('deve renderizar "Marcar todas como resolvidas" quando há múltiplas pendentes e onResolve', () => {
      render(<ExceptionPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Marcar todas como resolvidas' })).toBeInTheDocument();
    });

    it('não deve renderizar "Marcar todas como resolvidas" com apenas uma pendente', () => {
      const singlePending = [baseExceptions[0]];

      render(<ExceptionPanel exceptions={singlePending} onRetry={vi.fn()} onResolve={vi.fn()} />);

      expect(screen.queryByRole('button', { name: 'Marcar todas como resolvidas' })).not.toBeInTheDocument();
    });

    it('não deve renderizar "Marcar todas como resolvidas" sem onResolve', () => {
      render(<ExceptionPanel exceptions={baseExceptions} onRetry={vi.fn()} />);

      expect(screen.queryByRole('button', { name: 'Marcar todas como resolvidas' })).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('deve exibir "Nenhuma exceção encontrada" quando não há exceções pendentes', () => {
      const resolvedOnly = [makeException({ id: 'exc-r', status: 'resolved' })];

      render(<ExceptionPanel exceptions={resolvedOnly} onRetry={vi.fn()} />);

      expect(screen.getByText('Nenhuma exceção encontrada')).toBeInTheDocument();
    });

    it('deve exibir a descrição do empty state', () => {
      const resolvedOnly = [makeException({ id: 'exc-r', status: 'resolved' })];

      render(<ExceptionPanel exceptions={resolvedOnly} onRetry={vi.fn()} />);

      expect(screen.getByText('Todas as reconciliações estão em dia.')).toBeInTheDocument();
    });
  });
});
