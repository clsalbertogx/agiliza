import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/status-badge';

describe('StatusBadge', () => {
  describe('cores por status', () => {
    it('deve renderizar "Verde" quando status é green', () => {
      render(<StatusBadge status="green" />);

      const badge = screen.getByText('Verde');
      expect(badge).toBeInTheDocument();
    });

    it('deve renderizar "Amarelo" quando status é yellow', () => {
      render(<StatusBadge status="yellow" />);

      expect(screen.getByText('Amarelo')).toBeInTheDocument();
    });

    it('deve renderizar "Vermelho" quando status é red', () => {
      render(<StatusBadge status="red" />);

      expect(screen.getByText('Vermelho')).toBeInTheDocument();
    });

    it('deve renderizar "Pago" quando status é paid', () => {
      render(<StatusBadge status="paid" />);

      expect(screen.getByText('Pago')).toBeInTheDocument();
    });

    it('deve renderizar "Pendente" quando status é pending', () => {
      render(<StatusBadge status="pending" />);

      expect(screen.getByText('Pendente')).toBeInTheDocument();
    });

    it('deve renderizar "Vencido" quando status é overdue', () => {
      render(<StatusBadge status="overdue" />);

      expect(screen.getByText('Vencido')).toBeInTheDocument();
    });
  });

  describe('label customizado', () => {
    it('deve renderizar label customizado quando fornecido', () => {
      render(<StatusBadge status="paid" label="Liquidado" />);

      expect(screen.getByText('Liquidado')).toBeInTheDocument();
      expect(screen.queryByText('Pago')).not.toBeInTheDocument();
    });

    it('deve usar label padrão quando label não é fornecido', () => {
      render(<StatusBadge status="pending" />);

      expect(screen.getByText('Pendente')).toBeInTheDocument();
    });
  });

  describe('dot indicator', () => {
    it('deve renderizar dot indicator', () => {
      const { container } = render(<StatusBadge status="green" />);

      // O dot é um span com classe bg-success-500
      const dot = container.querySelector('span.rounded-full');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('status inválido', () => {
    it('deve retornar null para status desconhecido', () => {
      // Passando um status inválido via TS cast
      const { container } = render(<StatusBadge status={'invalid' as any} />);

      expect(container.innerHTML).toBe('');
    });
  });
});
