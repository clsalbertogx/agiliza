import { render, screen } from '@testing-library/react';
import { LoadingSkeleton } from '@/components/loading-skeleton';

describe('LoadingSkeleton', () => {
  describe('renderização geral', () => {
    it('deve ter role="status"', () => {
      render(<LoadingSkeleton variant="card" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('deve ter aria-label "Carregando..."', () => {
      render(<LoadingSkeleton variant="card" />);

      const loading = screen.getByRole('status');
      expect(loading).toHaveAttribute('aria-label', 'Carregando...');
    });

    it('deve renderizar texto "Carregando..." para leitores de tela', () => {
      render(<LoadingSkeleton variant="card" />);

      const srOnly = screen.getByText('Carregando...');
      expect(srOnly).toHaveClass('sr-only');
    });
  });

  describe('variante card', () => {
    it('deve renderizar skeleton para card', () => {
      const { container } = render(<LoadingSkeleton variant="card" />);

      // Deve ter o container com classe bg-white rounded-xl border
      const cardContainer = container.querySelector('.bg-white.rounded-xl');
      expect(cardContainer).toBeInTheDocument();
    });

    it('deve renderizar múltiplos elementos skeleton', () => {
      const { container } = render(<LoadingSkeleton variant="card" />);

      // Deve ter elementos com classe animate-pulse
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('variante table', () => {
    it('deve renderizar skeleton para tabela', () => {
      const { container } = render(<LoadingSkeleton variant="table" />);

      const tableContainer = container.querySelector('.bg-white.rounded-xl');
      expect(tableContainer).toBeInTheDocument();
    });

    it('deve renderizar 5 linhas de skeleton na tabela', () => {
      const { container } = render(<LoadingSkeleton variant="table" />);

      // Deve ter elementos skeleton (linhas)
      const skeletonRows = container.querySelectorAll('.border-b');
      // 5 rows + 1 header = 6 border-b elements
      expect(skeletonRows.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('variante text', () => {
    it('deve renderizar skeleton para texto', () => {
      const { container } = render(<LoadingSkeleton variant="text" />);

      // Container com space-y-3
      const textContainer = container.querySelector('.space-y-3');
      expect(textContainer).toBeInTheDocument();
    });

    it('deve renderizar 4 linhas de skeleton para texto', () => {
      const { container } = render(<LoadingSkeleton variant="text" />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(4);
    });
  });

  describe('variante page', () => {
    it('deve renderizar skeleton para página completa', () => {
      const { container } = render(<LoadingSkeleton variant="page" />);

      // Container principal com space-y-6
      const pageContainer = container.querySelector('.space-y-6');
      expect(pageContainer).toBeInTheDocument();
    });

    it('deve renderizar skeleton de 4 cards de resumo na variante page', () => {
      const { container } = render(<LoadingSkeleton variant="page" />);

      // A page skeleton contém 4 CardSkeletons + 1 TableSkeleton
      const cardContainers = container.querySelectorAll('.bg-white.rounded-xl');
      // 4 cards + 1 table = 5 containers com essa classe
      expect(cardContainers.length).toBe(5);
    });
  });
});
