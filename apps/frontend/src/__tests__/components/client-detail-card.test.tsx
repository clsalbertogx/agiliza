import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ClientDetail, ClientDetailCard } from '@/components/client-detail-card';

const defaultClient: ClientDetail = {
  id: 'client-1',
  name: 'Maria Souza',
  phone: '(11) 98888-7777',
  email: 'maria@example.com',
  preferredChannel: 'whatsapp',
  preferredTime: '09:00',
  preferredLeadDays: 5,
  onboardingCompleted: true,
  riskScore: 'yellow',
  riskProbability: 0.45,
  riskFeatures: [
    { name: 'age', label: 'Idade da dívida', value: 90, impact: 0.3 },
    { name: 'score', label: 'Score de crédito', value: 450, impact: -0.2 },
  ],
  paymentStats: {
    totalInvoices: 12,
    paidInvoices: 8,
    overdueInvoices: 4,
    avgPaymentDelay: 15,
    totalPaid: 25000,
  },
  createdAt: '2025-01-15T00:00:00.000Z',
};

describe('ClientDetailCard', () => {
  describe('renderização do header', () => {
    it('deve renderizar nome do cliente', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    });

    it('deve renderizar "Cliente desde" com data formatada', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText(/Cliente desde/)).toBeInTheDocument();
    });

    it('deve renderizar iniciais do nome no avatar', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('MS')).toBeInTheDocument();
    });

    it('deve renderizar botão de editar quando onEdit é fornecido', () => {
      render(<ClientDetailCard client={defaultClient} onEdit={vi.fn()} />);

      expect(screen.getByRole('button', { name: /editar cliente/i })).toBeInTheDocument();
    });

    it('não deve renderizar botão de editar quando onEdit não é fornecido', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.queryByRole('button', { name: /editar cliente/i })).not.toBeInTheDocument();
    });
  });

  describe('seção de contato', () => {
    it('deve renderizar título "Contato"', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('Contato')).toBeInTheDocument();
    });

    it('deve renderizar telefone como link', () => {
      render(<ClientDetailCard client={defaultClient} />);

      const phoneLink = screen.getByRole('link', { name: /\(11\) 98888-7777/ });
      expect(phoneLink).toHaveAttribute('href', 'tel:(11) 98888-7777');
    });

    it('deve renderizar email como link', () => {
      render(<ClientDetailCard client={defaultClient} />);

      const emailLink = screen.getByRole('link', { name: /maria@example.com/ });
      expect(emailLink).toHaveAttribute('href', 'mailto:maria@example.com');
    });

    it('deve exibir "Não cadastrado" quando email não é fornecido', () => {
      render(<ClientDetailCard client={{ ...defaultClient, email: undefined }} />);

      expect(screen.getByText('Não cadastrado')).toBeInTheDocument();
    });
  });

  describe('seção de preferências', () => {
    it('deve renderizar título "Preferências"', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('Preferências')).toBeInTheDocument();
    });

    it('deve renderizar canal de contato', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText(/Canal: WhatsApp/)).toBeInTheDocument();
    });

    it('deve renderizar horário preferido', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText(/Horário: 09:00/)).toBeInTheDocument();
    });

    it('deve renderizar lead days', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText(/Lead: 5 dias/)).toBeInTheDocument();
    });

    it('deve renderizar badge "Onboarding Completo" quando onboardingCompleted é true', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('Onboarding Completo')).toBeInTheDocument();
    });

    it('deve renderizar badge "Onboarding Pendente" quando onboardingCompleted é false', () => {
      render(<ClientDetailCard client={{ ...defaultClient, onboardingCompleted: false }} />);

      expect(screen.getByText('Onboarding Pendente')).toBeInTheDocument();
    });
  });

  describe('seção de risco', () => {
    it('deve renderizar título "Risco"', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('Risco')).toBeInTheDocument();
    });

    it('deve renderizar RiskBadge com o nível correto', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('Médio Risco')).toBeInTheDocument();
    });

    it('deve renderizar risk meter com aria-valuenow', () => {
      render(<ClientDetailCard client={defaultClient} />);

      const meter = screen.getByRole('meter');
      expect(meter).toBeInTheDocument();
      expect(meter).toHaveAttribute('aria-valuenow', '45');
    });

    it('deve renderizar percentual de probabilidade', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('45% de probabilidade')).toBeInTheDocument();
    });

    it('deve renderizar lista de risk features', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('Idade da dívida: 90')).toBeInTheDocument();
      expect(screen.getByText('Score de crédito: 450')).toBeInTheDocument();
    });

    it('deve exibir "Dados insuficientes" quando não há risk features', () => {
      render(<ClientDetailCard client={{ ...defaultClient, riskFeatures: [] }} />);

      expect(screen.getByText('Dados insuficientes para análise de risco')).toBeInTheDocument();
    });
  });

  describe('seção de pagamentos', () => {
    it('deve renderizar título "Pagamentos"', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('Pagamentos')).toBeInTheDocument();
    });

    it('deve renderizar total pago formatado', () => {
      render(<ClientDetailCard client={defaultClient} />);

      // toLocaleString('pt-BR', { style: 'currency' }) usa separador não-16
      expect(screen.getByText((content) => content.includes('25.000,00'))).toBeInTheDocument();
    });

    it('deve renderizar quantidade de faturas pagas', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('deve renderizar quantidade de faturas vencidas', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('deve renderizar atraso médio em dias', () => {
      render(<ClientDetailCard client={defaultClient} />);

      expect(screen.getByText('15 dias')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('deve exibir skeleton de carregamento quando isLoading é true', () => {
      render(<ClientDetailCard client={defaultClient} isLoading={true} />);

      const loading = screen.getByRole('status');
      expect(loading).toBeInTheDocument();
      expect(loading).toHaveAttribute('aria-label', 'Carregando...');
    });

    it('não deve exibir conteúdo do cliente durante loading', () => {
      render(<ClientDetailCard client={defaultClient} isLoading={true} />);

      expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(<ClientDetailCard client={defaultClient} error="Erro ao carregar dados do cliente" />);

      expect(screen.getByText('Erro ao carregar dados do cliente')).toBeInTheDocument();
    });

    it('deve exibir botão "Tentar novamente" quando onRetry é fornecido', () => {
      render(<ClientDetailCard client={defaultClient} error="Erro" onRetry={vi.fn()} />);

      expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
    });

    it('deve chamar onRetry ao clicar em "Tentar novamente"', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();

      render(<ClientDetailCard client={defaultClient} error="Erro" onRetry={onRetry} />);

      await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('callback de edição', () => {
    it('deve chamar onEdit ao clicar no botão de editar', async () => {
      const onEdit = vi.fn();
      const user = userEvent.setup();

      render(<ClientDetailCard client={defaultClient} onEdit={onEdit} />);

      await user.click(screen.getByRole('button', { name: /editar cliente/i }));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });
  });
});
