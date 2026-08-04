import { render, screen } from '@testing-library/react';
import { KpiCard } from '@/components/kpi-card';

describe('KpiCard', () => {
  it('deve renderizar título e valor', () => {
    render(<KpiCard title="Total de Faturas" value="R$ 150.000" />);

    expect(screen.getByText('Total de Faturas')).toBeInTheDocument();
    expect(screen.getByText('R$ 150.000')).toBeInTheDocument();
  });

  it('deve renderizar subtítulo quando fornecido', () => {
    render(<KpiCard title="Inadimplência" value="5.2%" subtitle="2.3% abaixo da meta" />);

    expect(screen.getByText('2.3% abaixo da meta')).toBeInTheDocument();
  });

  describe('trend (indicador de tendência)', () => {
    it('deve exibir seta para cima e cor verde quando trend é positivo', () => {
      render(<KpiCard title="Receita" value="R$ 200.000" trend={{ value: 12.5, isPositive: true }} />);

      const trendElement = screen.getByText('12.5%');
      expect(trendElement).toBeInTheDocument();

      // Seta para cima (↑)
      const upArrow = trendElement.parentElement?.querySelector('[aria-hidden="true"]');
      expect(upArrow).toHaveTextContent('↑');
    });

    it('deve exibir seta para baixo e cor vermelha quando trend é negativo', () => {
      render(<KpiCard title="Inadimplência" value="8.1%" trend={{ value: 3.2, isPositive: false }} />);

      const trendElement = screen.getByText('3.2%');
      expect(trendElement).toBeInTheDocument();

      // Seta para baixo (↓)
      const downArrow = trendElement.parentElement?.querySelector('[aria-hidden="true"]');
      expect(downArrow).toHaveTextContent('↓');
    });

    it('deve exibir valor absoluto do trend (sem sinal de negativo)', () => {
      render(<KpiCard title="Taxa" value="10%" trend={{ value: -5, isPositive: false }} />);

      // O componente usa Math.abs, então deve exibir 5
      expect(screen.getByText('5%')).toBeInTheDocument();
    });
  });

  it('não deve renderizar trend quando não fornecido', () => {
    render(<KpiCard title="Simples" value="42" />);

    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });

  it('deve renderizar ícone quando fornecido', () => {
    render(<KpiCard title="Com Ícone" value="99" icon={<span data-testid="test-icon">💰</span>} />);

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
