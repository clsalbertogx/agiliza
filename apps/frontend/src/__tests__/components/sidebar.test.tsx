import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';

// Mock next/navigation
let mockPathnameValue = '/dashboard';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathnameValue,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
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

      expect(screen.getAllByText('Agiliza').length).toBeGreaterThan(0);
    });

    it('deve renderizar a versão "Agiliza v0.12.0"', () => {
      render(<Sidebar />);

      expect(screen.getByText('Agiliza v0.12.0')).toBeInTheDocument();
    });
  });

  describe('links de navegação', () => {
    it('deve renderizar todos os links de navegação', () => {
      render(<Sidebar />);

      const navLinkLabels = ['Dashboard', 'Clientes', 'Faturas', 'Lembretes', 'Risco', 'Relatórios', 'Configurações'];

      navLinkLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('não deve renderizar o item "Mensagens"', () => {
      render(<Sidebar />);

      expect(screen.queryByText('Mensagens')).not.toBeInTheDocument();
      expect(screen.queryByText('Mensagens')?.closest('a')).toBeUndefined();
    });

    it('deve ter role="navigation" com aria-label', () => {
      render(<Sidebar />);

      expect(screen.getByRole('navigation', { name: /navegação principal/i })).toBeInTheDocument();
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

  describe('navegação mobile (drawer)', () => {
    it('deve renderizar o botão hamburger com aria-label "Abrir menu"', () => {
      render(<Sidebar />);

      expect(screen.getByRole('button', { name: /abrir menu/i })).toBeInTheDocument();
    });

    it('abre o drawer com os 7 links ao clicar no hamburger', async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      await user.click(screen.getByRole('button', { name: /abrir menu/i }));

      const dialog = screen.getByRole('dialog', { name: /menu móvel/i });
      const navLinkLabels = ['Dashboard', 'Clientes', 'Faturas', 'Lembretes', 'Risco', 'Relatórios', 'Configurações'];
      navLinkLabels.forEach((label) => {
        expect(within(dialog).getByRole('link', { name: label })).toBeInTheDocument();
      });
    });

    it('fecha o drawer ao clicar em um link de navegação', async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      await user.click(screen.getByRole('button', { name: /abrir menu/i }));
      expect(screen.getByRole('dialog', { name: /menu móvel/i })).toBeInTheDocument();

      await user.click(
        within(screen.getByRole('dialog', { name: /menu móvel/i })).getByRole('link', { name: 'Clientes' }),
      );

      expect(screen.queryByRole('dialog', { name: /menu móvel/i })).not.toBeInTheDocument();
    });

    it('fecha o drawer ao pressionar Escape', async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      await user.click(screen.getByRole('button', { name: /abrir menu/i }));
      expect(screen.getByRole('dialog', { name: /menu móvel/i })).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog', { name: /menu móvel/i })).not.toBeInTheDocument();
    });

    it('fecha o drawer ao clicar no backdrop', async () => {
      const user = userEvent.setup();
      render(<Sidebar />);

      await user.click(screen.getByRole('button', { name: /abrir menu/i }));
      expect(screen.getByRole('dialog', { name: /menu móvel/i })).toBeInTheDocument();

      // O primeiro botão "Fechar menu" no DOM é o backdrop sobreposto ao conteúdo.
      await user.click(screen.getAllByRole('button', { name: /fechar menu/i })[0]);

      expect(screen.queryByRole('dialog', { name: /menu móvel/i })).not.toBeInTheDocument();
    });
  });
});
