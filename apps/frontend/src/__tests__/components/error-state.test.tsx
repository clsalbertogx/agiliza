import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from '@/components/error-state';

describe('ErrorState', () => {
  describe('renderização básica', () => {
    it('deve exibir "Não foi possível carregar os dados" como título', () => {
      render(<ErrorState message="Erro genérico" />);

      expect(
        screen.getByText('Não foi possível carregar os dados'),
      ).toBeInTheDocument();
    });

    it('deve exibir a mensagem de erro', () => {
      render(<ErrorState message="Falha na conexão com o servidor" />);

      expect(
        screen.getByText('Falha na conexão com o servidor'),
      ).toBeInTheDocument();
    });

    it('deve ter role="alert"', () => {
      render(<ErrorState message="Erro" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('deve ter aria-live="assertive"', () => {
      render(<ErrorState message="Erro" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('deve renderizar ícone de alerta', () => {
      const { container } = render(<ErrorState message="Erro" />);

      // AlertTriangle do lucide-react renderiza um SVG
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('detalhes do erro', () => {
    it('deve exibir detalhes quando fornecidos', () => {
      render(
        <ErrorState
          message="Erro ao carregar"
          details="Tente novamente mais tarde"
        />,
      );

      expect(
        screen.getByText('Tente novamente mais tarde'),
      ).toBeInTheDocument();
    });

    it('não deve renderizar detalhes quando não fornecidos', () => {
      render(<ErrorState message="Erro" />);

      // details não fornecido, componente não renderiza tag <p> extra
      // O componente sempre tem texto de mensagem e título
      // O botão "Tentar novamente" não está sem onRetry
      // O texto de detalhes não deve aparecer
      expect(screen.queryByText(/Tente/)).not.toBeInTheDocument();
    });
  });

  describe('botão de retry', () => {
    it('deve renderizar botão "Tentar novamente" quando onRetry é fornecido', () => {
      render(<ErrorState message="Erro" onRetry={vi.fn()} />);

      expect(
        screen.getByRole('button', { name: /tentar novamente/i }),
      ).toBeInTheDocument();
    });

    it('não deve renderizar botão quando onRetry não é fornecido', () => {
      render(<ErrorState message="Erro" />);

      expect(
        screen.queryByRole('button', { name: /tentar novamente/i }),
      ).not.toBeInTheDocument();
    });

    it('deve chamar onRetry ao clicar no botão', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();

      render(<ErrorState message="Erro" onRetry={onRetry} />);

      await user.click(
        screen.getByRole('button', { name: /tentar novamente/i }),
      );
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});
