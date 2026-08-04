import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/empty-state';

describe('EmptyState', () => {
  describe('renderização básica', () => {
    it('deve renderizar título', () => {
      render(<EmptyState title="Nenhum registro encontrado" />);

      expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
    });

    it('deve ter role="status"', () => {
      render(<EmptyState title="Vazio" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('descrição', () => {
    it('deve renderizar descrição quando fornecida', () => {
      render(<EmptyState title="Nenhuma fatura" description="Crie uma nova fatura para começar" />);

      expect(screen.getByText('Crie uma nova fatura para começar')).toBeInTheDocument();
    });

    it('não deve renderizar descrição quando não fornecida', () => {
      render(<EmptyState title="Apenas título" />);

      // O componente renderiza um h3 e possivelmente um ícone
      // Mas sem description, a tag <p> não deve existir
      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
    });
  });

  describe('ícone', () => {
    it('deve renderizar ícone customizado quando fornecido', () => {
      render(<EmptyState title="Com ícone" icon={<span data-testid="custom-icon">📭</span>} />);

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('deve renderizar ícone padrão Inbox quando não fornecido', () => {
      const { container } = render(<EmptyState title="Padrão" />);

      // O ícone padrão é o Inbox do lucide-react, que renderiza um SVG
      const svg = container.querySelector('svg');
      // O Inbox deve estar presente
      expect(svg).toBeInTheDocument();
    });
  });

  describe('botão de ação', () => {
    it('deve renderizar botão de ação quando action é fornecido', () => {
      render(<EmptyState title="Nenhum cliente" action={{ label: 'Adicionar cliente', onClick: vi.fn() }} />);

      expect(screen.getByRole('button', { name: /adicionar cliente/i })).toBeInTheDocument();
    });

    it('deve chamar onClick do action ao clicar no botão', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<EmptyState title="Vazio" action={{ label: 'Criar', onClick }} />);

      await user.click(screen.getByRole('button', { name: /criar/i }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('não deve renderizar botão quando action não é fornecido', () => {
      render(<EmptyState title="Sem ação" />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
