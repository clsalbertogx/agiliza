import { render, screen } from '@testing-library/react';
import { RiskBadge } from '@/components/risk-badge';

describe('RiskBadge', () => {
  describe('renderização por nível de risco', () => {
    it('deve renderizar "Baixo Risco" com estilo success quando level é green', () => {
      render(<RiskBadge level="green" />);

      const badge = screen.getByText('Baixo Risco');
      expect(badge).toBeInTheDocument();
    });

    it('deve renderizar "Médio Risco" com estilo warning quando level é yellow', () => {
      render(<RiskBadge level="yellow" />);

      const badge = screen.getByText('Médio Risco');
      expect(badge).toBeInTheDocument();
    });

    it('deve renderizar "Alto Risco" com estilo danger quando level é red', () => {
      render(<RiskBadge level="red" />);

      const badge = screen.getByText('Alto Risco');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('tooltip', () => {
    it('deve exibir tooltip com probabilidade quando probability é fornecida', () => {
      render(<RiskBadge level="yellow" probability={0.75} />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent('Probabilidade: 75%');
    });

    it('deve exibir tooltip com motivo quando reason é fornecida', () => {
      render(<RiskBadge level="red" reason="Cliente com histórico de atraso" />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent('Motivo: Cliente com histórico de atraso');
    });

    it('deve exibir tooltip combinado quando probability e reason são fornecidos', () => {
      render(<RiskBadge level="red" probability={0.9} reason="Score baixo" />);

      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('Probabilidade: 90%');
      expect(tooltip).toHaveTextContent('Motivo: Score baixo');
    });

    it('não deve renderizar tooltip quando probability e reason não são fornecidos', () => {
      render(<RiskBadge level="green" />);

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
