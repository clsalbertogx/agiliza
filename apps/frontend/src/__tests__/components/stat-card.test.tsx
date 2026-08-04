import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from '@/components/stat-card';

describe('StatCard', () => {
  it('deve renderizar título e valor', () => {
    render(<StatCard title="Total de Clientes" value="150" />);

    expect(screen.getByText('Total de Clientes')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('deve renderizar subtítulo quando fornecido', () => {
    render(<StatCard title="Receita" value="R$ 50.000" subtitle="Últimos 30 dias" />);

    expect(screen.getByText('Últimos 30 dias')).toBeInTheDocument();
  });

  it('deve exibir tendência positiva com seta para cima', () => {
    render(<StatCard title="Vendas" value="200" trend={{ value: 15, isPositive: true }} />);

    const trendElement = screen.getByText((content) => content.includes('↑'));
    expect(trendElement).toHaveTextContent('15');
    expect(trendElement).toHaveTextContent('%');
  });

  it('deve exibir tendência negativa com seta para baixo', () => {
    render(<StatCard title="Cancelamentos" value="10" trend={{ value: 5, isPositive: false }} />);

    const trendElement = screen.getByText((content) => content.includes('↓'));
    expect(trendElement).toHaveTextContent('5');
    expect(trendElement).toHaveTextContent('%');
  });

  it('deve renderizar ícone quando fornecido', () => {
    render(<StatCard title="Com Ícone" value="99" icon={<span data-testid="test-icon">🔍</span>} />);

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
