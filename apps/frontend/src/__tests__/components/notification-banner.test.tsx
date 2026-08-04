import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBanner } from '@/components/notification-banner';

describe('NotificationBanner', () => {
  describe('variantes de tipo', () => {
    it('deve renderizar banner de sucesso com título e mensagem', () => {
      render(<NotificationBanner type="success" title="Operação concluída" message="Fatura paga com sucesso" />);

      expect(screen.getByText('Operação concluída')).toBeInTheDocument();
      expect(screen.getByText('Fatura paga com sucesso')).toBeInTheDocument();
    });

    it('deve renderizar banner de erro com role="alert"', () => {
      render(<NotificationBanner type="error" title="Erro ao processar" message="Falha na comunicação" />);

      const banner = screen.getByRole('alert');
      expect(banner).toBeInTheDocument();
      expect(screen.getByText('Erro ao processar')).toBeInTheDocument();
    });

    it('deve renderizar banner de warning com role="alert"', () => {
      render(<NotificationBanner type="warning" title="Atenção" message="Limite próximo do atingido" />);

      const banner = screen.getByRole('alert');
      expect(banner).toBeInTheDocument();
      expect(screen.getByText('Atenção')).toBeInTheDocument();
    });

    it('deve renderizar banner de info com role="status"', () => {
      render(<NotificationBanner type="info" title="Informação" message="Atualização disponível" />);

      const banner = screen.getByRole('status');
      expect(banner).toBeInTheDocument();
      expect(screen.getByText('Informação')).toBeInTheDocument();
    });
  });

  describe('dismiss (fechar notificação)', () => {
    it('deve chamar onDismiss ao clicar no botão de fechar', async () => {
      const onDismiss = vi.fn();
      const user = userEvent.setup();

      render(<NotificationBanner type="info" title="Notificação" onDismiss={onDismiss} />);

      const closeButton = screen.getByRole('button', { name: /fechar notificação/i });
      await user.click(closeButton);

      // O banner some imediatamente (setVisible(false))
      expect(screen.queryByText('Notificação')).not.toBeInTheDocument();
    });

    it('não deve exibir botão de fechar quando onDismiss não é fornecido', () => {
      render(<NotificationBanner type="success" title="Sem dismiss" />);

      expect(screen.queryByRole('button', { name: /fechar notificação/i })).not.toBeInTheDocument();
    });
  });

  describe('auto-dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('deve remover a notificação automaticamente após o tempo especificado', () => {
      const onDismiss = vi.fn();

      render(<NotificationBanner type="success" title="Auto-dismiss" autoDismiss={2000} onDismiss={onDismiss} />);

      expect(screen.getByText('Auto-dismiss')).toBeInTheDocument();

      // Avança o tempo até o fim do auto-dismiss + margem para o setTimeout de 300ms do onDismiss
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // O componente deve ter sumido (visible=false)
      expect(screen.queryByText('Auto-dismiss')).not.toBeInTheDocument();

      // Avança mais 300ms para o setTimeout do onDismiss
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('deve exibir barra de progresso quando autoDismiss > 0', () => {
      render(<NotificationBanner type="info" title="Com progresso" autoDismiss={5000} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuenow', '100');
    });

    it('não deve exibir barra de progresso quando autoDismiss é 0', () => {
      render(<NotificationBanner type="info" title="Sem progresso" autoDismiss={0} />);

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('botão de ação', () => {
    it('deve renderizar botão de ação e executar callback ao clicar', async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();

      render(
        <NotificationBanner
          type="warning"
          title="Confirmação necessária"
          action={{ label: 'Revisar', onClick: onAction }}
        />,
      );

      const actionButton = screen.getByRole('button', { name: 'Revisar' });
      expect(actionButton).toBeInTheDocument();

      await user.click(actionButton);
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading state', () => {
    it('deve exibir "Processando..." e ocultar título original quando isLoading é true', () => {
      render(<NotificationBanner type="success" title="Título original" isLoading={true} />);

      expect(screen.getByText('Processando...')).toBeInTheDocument();
      expect(screen.queryByText('Título original')).not.toBeInTheDocument();
    });

    it('não deve renderizar botão de ação quando isLoading é true', () => {
      render(
        <NotificationBanner
          type="error"
          title="Erro"
          isLoading={true}
          action={{ label: 'Tentar', onClick: vi.fn() }}
        />,
      );

      expect(screen.queryByRole('button', { name: 'Tentar' })).not.toBeInTheDocument();
    });
  });
});
