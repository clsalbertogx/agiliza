import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock next/navigation
let mockPathnameValue = '/dashboard';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathnameValue,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { Sidebar } = await import('@/components/sidebar');

describe('Sidebar', () => {
  beforeEach(() => {
    mockPathnameValue = '/dashboard';
  });

  describe('marca e branding', () => {
    it('deve renderizar o nome "Agiliza"', () => {
      render(<Sidebar />);

      expect(screen.getByText('Agiliza')).toBeInTheDocument();
    });

    it('deve renderizar a versão "Agiliza v0.1.0"', () => {
      render(<Sidebar />);

      expect(screen.getByText('Agiliza v0.1.0')).toBeInTheDocument();
    });
  });

  describe('links de navegação', () => {
    it('deve renderizar todos os links de navegação', () => {
      render(<Sidebar />);

      const navLinkLabels = [
        'Dashboard',
        'Clientes',
        'Faturas',
        'Lembretes',
        'Risco',
        'Mensagens',
        'Relatórios',
        'Configurações',
      ];

      navLinkLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('deve ter role="navigation" com aria-label', () => {
      render(<Sidebar />);

      expect(
        screen.getByRole('navigation', { name: /navegação principal/i }),
      ).toBeInTheDocument();
    });

    it('deve renderizar links com href correto', () => {
      render(<Sidebar />);

      const link = screen.getByText('Clientes').closest('a');
      expect(link).toHaveAttribute('href', '/dashboard/clients');
    });
  });

  describe('destaque da rota ativa', () => {
    it('deve destacar Dashboard quando pathname é exatamente /dashboard', () => {
      mockPathnameValue = '/dashboard';
      render(<Sidebar />);

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveClass('bg-green-50');
      expect(dashboardLink).toHaveClass('text-green-700');
    });

    it('deve destacar Clientes quando pathname é /dashboard/clients', () => {
      mockPathnameValue = '/dashboard/clients';
      render(<Sidebar />);

      const clientsLink = screen.getByText('Clientes').closest('a');
      expect(clientsLink).toHaveClass('bg-green-50');
      expect(clientsLink).toHaveClass('text-green-700');
    });

    it('deve destacar Faturas quando pathname começa com /dashboard/invoices', () => {
      mockPathnameValue = '/dashboard/invoices/123';
      render(<Sidebar />);

      const invoicesLink = screen.getByText('Faturas').closest('a');
      expect(invoicesLink).toHaveClass('bg-green-50');
    });

    it('itens sem correspondência devem ter cor neutra', () => {
      mockPathnameValue = '/other-page';
      render(<Sidebar />);

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveClass('text-gray-600');
      expect(dashboardLink).not.toHaveClass('bg-green-50');
    });
  });

  describe('responsividade', () => {
    it('deve estar oculto em mobile (classe hidden)', () => {
      const { container } = render(<Sidebar />);

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('hidden');
      expect(aside).toHaveClass('lg:flex');
    });
  });
});
