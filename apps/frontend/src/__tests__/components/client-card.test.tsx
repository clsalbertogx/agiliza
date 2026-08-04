import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientCard } from '@/components/client-card';

const defaultClient = {
  name: 'João Silva',
  phone: '11999999999',
  email: 'joao@example.com',
  riskScore: 'yellow' as const,
};

describe('ClientCard', () => {
  describe('renderização básica', () => {
    it('deve renderizar nome do cliente', () => {
      render(<ClientCard client={defaultClient} />);

      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    it('deve renderizar telefone formatado', () => {
      render(<ClientCard client={defaultClient} />);

      expect(screen.getByText('(11) 99999-9999')).toBeInTheDocument();
    });

    it('deve renderizar email do cliente', () => {
      render(<ClientCard client={defaultClient} />);

      expect(screen.getByText('joao@example.com')).toBeInTheDocument();
    });
  });

  describe('indicador de risco', () => {
    it('deve renderizar dot colorido para risco yellow', () => {
      render(<ClientCard client={defaultClient} />);

      const riskLabel = screen.getByLabelText('Médio risco');
      expect(riskLabel).toBeInTheDocument();
    });

    it('deve renderizar label de risco green', () => {
      render(<ClientCard client={{ ...defaultClient, riskScore: 'green' }} />);

      const riskLabel = screen.getByLabelText('Baixo risco');
      expect(riskLabel).toBeInTheDocument();
    });

    it('deve renderizar label de risco red', () => {
      render(<ClientCard client={{ ...defaultClient, riskScore: 'red' }} />);

      const riskLabel = screen.getByLabelText('Alto risco');
      expect(riskLabel).toBeInTheDocument();
    });

    it('deve exibir texto do riskScore em uppercase', () => {
      render(<ClientCard client={defaultClient} />);

      expect(screen.getByText('yellow')).toBeInTheDocument();
    });
  });

  describe('comportamento de clique', () => {
    it('deve ter role="button" quando onSelect é fornecido', () => {
      render(<ClientCard client={defaultClient} onSelect={vi.fn()} />);

      const card = screen.getByRole('button');
      expect(card).toBeInTheDocument();
    });

    it('deve ter aria-label com nome do cliente quando onSelect é fornecido', () => {
      render(<ClientCard client={defaultClient} onSelect={vi.fn()} />);

      expect(screen.getByLabelText('Ver detalhes de João Silva')).toBeInTheDocument();
    });

    it('deve chamar onSelect ao clicar no card', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      render(<ClientCard client={defaultClient} onSelect={onSelect} />);

      await user.click(screen.getByRole('button'));
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onSelect ao pressionar Enter', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      render(<ClientCard client={defaultClient} onSelect={onSelect} />);

      const card = screen.getByRole('button');
      card.focus();
      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('deve chamar onSelect ao pressionar Espaço', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();

      render(<ClientCard client={defaultClient} onSelect={onSelect} />);

      const card = screen.getByRole('button');
      card.focus();
      await user.keyboard(' ');
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('não deve ter role="button" quando onSelect não é fornecido', () => {
      render(<ClientCard client={defaultClient} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('formatação de telefone', () => {
    it('deve formatar telefone com 9 dígitos', () => {
      render(<ClientCard client={{ ...defaultClient, phone: '11987654321' }} />);

      expect(screen.getByText('(11) 98765-4321')).toBeInTheDocument();
    });

    it('deve formatar telefone com 8 dígitos', () => {
      render(<ClientCard client={{ ...defaultClient, phone: '1133334444' }} />);

      expect(screen.getByText('(11) 3333-4444')).toBeInTheDocument();
    });
  });
});
