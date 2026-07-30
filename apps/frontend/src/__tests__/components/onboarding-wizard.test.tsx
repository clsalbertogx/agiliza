import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingWizard } from '@/components/onboarding-wizard';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('OnboardingWizard', () => {
  const defaultProps = {
    clientId: 'client-1',
    onComplete: vi.fn(),
  };

  describe('step indicator', () => {
    it('deve exibir "Etapa 1 de 3" no passo inicial', () => {
      render(<OnboardingWizard {...defaultProps} />);

      expect(screen.getByText('Etapa 1 de 3')).toBeInTheDocument();
    });

    it('deve atualizar o número da etapa ao navegar', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      const nextButton = screen.getByRole('button', { name: /avançar/i });
      await user.click(nextButton);

      expect(screen.getByText('Etapa 2 de 3')).toBeInTheDocument();
    });
  });

  describe('progress bar', () => {
    it('deve renderizar barra de progresso no passo inicial', () => {
      render(<OnboardingWizard {...defaultProps} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-label', 'Passo 1 de 3');
    });

    it('deve atualizar aria-label ao avançar para o passo 2', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /avançar/i }));

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-label', 'Passo 2 de 3');
    });
  });

  describe('navegação entre etapas', () => {
    it('deve exibir botão "Cancelar" na primeira etapa quando onClose é fornecido', () => {
      render(
        <OnboardingWizard {...defaultProps} onClose={vi.fn()} />,
      );

      expect(
        screen.getByRole('button', { name: /cancelar/i }),
      ).toBeInTheDocument();
    });

    it('deve ocultar botão "Cancelar" e exibir "Voltar" após navegar', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);

      expect(
        screen.getByRole('button', { name: /voltar/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /cancelar/i }),
      ).not.toBeInTheDocument();
    });

    it('deve voltar para etapa anterior ao clicar "Voltar"', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      // Avançar para etapa 2
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);
      expect(screen.getByText('Etapa 2 de 3')).toBeInTheDocument();

      // Voltar para etapa 1
      await user.click(screen.getByRole('button', { name: /voltar/i }));
      await delay(350);
      expect(screen.getByText('Etapa 1 de 3')).toBeInTheDocument();
    });
  });

  describe('conteúdo de cada etapa', () => {
    it('deve exibir opções de canal na etapa 1', () => {
      render(<OnboardingWizard {...defaultProps} />);

      expect(
        screen.getByText('Qual o canal preferido?'),
      ).toBeInTheDocument();
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('SMS')).toBeInTheDocument();
    });

    it('deve exibir input de horário na etapa 2', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);

      expect(
        screen.getByText('Qual o melhor horário?'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Horário preferido'),
      ).toBeInTheDocument();
    });

    it('deve exibir controle de dias de lead na etapa 3', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);

      expect(
        screen.getByText('Quantos dias antes?'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /diminuir dias/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /aumentar dias/i }),
      ).toBeInTheDocument();
    });
  });

  describe('finalização (completion)', () => {
    it('deve exibir botão "Concluir" na última etapa', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);

      expect(
        screen.getByRole('button', { name: /concluir/i }),
      ).toBeInTheDocument();
    });

    it('deve chamar onComplete com os dados corretos ao concluir', async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();
      render(
        <OnboardingWizard
          clientId="client-1"
          onComplete={onComplete}
        />,
      );

      // Navegar até o final
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);

      // Concluir
      await user.click(screen.getByRole('button', { name: /concluir/i }));

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith({
        clientId: 'client-1',
        preferredChannel: 'whatsapp',
        preferredTime: '18:00',
        preferredLeadDays: 5,
      });
    });

    it('deve desabilitar botão "Concluir" durante o envio (isCompleting)', async () => {
      const onComplete = vi.fn();
      const user = userEvent.setup();
      render(
        <OnboardingWizard
          clientId="client-1"
          onComplete={onComplete}
        />,
      );

      // Navegar até o final
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);

      const concludeButton = screen.getByRole('button', { name: /concluir/i });
      await user.click(concludeButton);

      // Após o clique, onComplete síncrono é chamado e isCompleting = true
      expect(concludeButton).toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('deve exibir LoadingSkeleton quando isLoading é true', () => {
      render(
        <OnboardingWizard {...defaultProps} isLoading={true} />,
      );

      const loading = screen.getByRole('status');
      expect(loading).toBeInTheDocument();
      expect(loading).toHaveAttribute('aria-label', 'Carregando...');
    });

    it('não deve exibir o conteúdo do wizard quando isLoading é true', () => {
      render(
        <OnboardingWizard {...defaultProps} isLoading={true} />,
      );

      expect(
        screen.queryByText('Qual o canal preferido?'),
      ).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(
        <OnboardingWizard
          {...defaultProps}
          error="Erro ao carregar dados"
        />,
      );

      expect(
        screen.getByText('Erro ao carregar dados'),
      ).toBeInTheDocument();
    });

    it('deve exibir botão de retry quando error e onClose são fornecidos', () => {
      render(
        <OnboardingWizard
          {...defaultProps}
          error="Erro ao carregar"
          onClose={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: /tentar novamente/i }),
      ).toBeInTheDocument();
    });
  });

  describe('seleção de canal', () => {
    it('deve permitir selecionar WhatsApp como canal padrão', () => {
      render(<OnboardingWizard {...defaultProps} />);

      const whatsappInput = screen.getByDisplayValue('whatsapp');
      expect(whatsappInput).toBeChecked();
    });

    it('deve mudar o canal selecionado ao clicar em outra opção', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      const emailOption = screen.getByText('Email');
      await user.click(emailOption);

      const emailInput = screen.getByDisplayValue('email');
      expect(emailInput).toBeChecked();
    });
  });

  describe('controle de dias de lead', () => {
    it('deve iniciar com valor padrão 5 dias', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);

      expect(
        screen.getByLabelText('5 dias antes do vencimento'),
      ).toBeInTheDocument();
    });

    it('deve incrementar dias ao clicar em "+"', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);

      await user.click(screen.getByRole('button', { name: /aumentar dias/i }));

      expect(
        screen.getByLabelText('6 dias antes do vencimento'),
      ).toBeInTheDocument();
    });

    it('deve decrementar dias ao clicar em "-"', async () => {
      const user = userEvent.setup();
      render(<OnboardingWizard {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);
      await user.click(screen.getByRole('button', { name: /avançar/i }));
      await delay(350);

      await user.click(screen.getByRole('button', { name: /diminuir dias/i }));

      expect(
        screen.getByLabelText('4 dias antes do vencimento'),
      ).toBeInTheDocument();
    });
  });
});
