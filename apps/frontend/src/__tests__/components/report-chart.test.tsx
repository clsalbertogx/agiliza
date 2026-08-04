import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ChartDataPoint, type ChartSeries, ReportChart } from '@/components/report-chart';

const barData: ChartDataPoint[] = [
  { label: 'Jan', value: 1500 },
  { label: 'Fev', value: 3200 },
  { label: 'Mar', value: 850 },
];

const singleData: ChartDataPoint[] = [{ label: 'Jan', value: 1500 }];

const pieData: ChartDataPoint[] = [
  { label: 'Pagos', value: 60 },
  { label: 'Pendentes', value: 40 },
];

const seriesData: ChartSeries[] = [
  { name: 'Recebido', data: [1000, 2000, 500] },
  { name: 'A vencer', data: [500, 1200, 350] },
];

function getTableText(container: HTMLElement): string {
  // pt-BR usa espaço não separável (U+00A0) como separador de milhar
  const table = container.querySelector('table');
  return (table?.textContent ?? '').replace(/\u00A0/g, ' ');
}

describe('ReportChart', () => {
  const defaultProps = {
    type: 'bar' as const,
    title: 'Faturamento por mês',
    data: barData,
  };

  describe('título', () => {
    it('deve renderizar o título do gráfico', () => {
      render(<ReportChart {...defaultProps} />);

      expect(screen.getByText('Faturamento por mês')).toBeInTheDocument();
    });
  });

  describe('gráfico de barras', () => {
    it('deve renderizar svg com aria-label "Gráfico de barras"', () => {
      render(<ReportChart {...defaultProps} />);

      expect(screen.getByRole('img', { name: 'Gráfico de barras' })).toBeInTheDocument();
    });

    it('deve expor rótulos e valores formatados na tabela acessível', () => {
      const { container } = render(<ReportChart {...defaultProps} />);

      const text = getTableText(container);
      expect(text).toContain('Jan');
      expect(text).toContain('Fev');
      expect(text).toContain('R$ 1.500');
      expect(text).toContain('R$ 3.200');
      expect(text).toContain('R$ 850');
    });

    it('deve renderizar a legenda quando há múltiplos pontos de dado', () => {
      render(<ReportChart {...defaultProps} />);

      const legend = screen.getByLabelText('Legenda do gráfico');
      expect(within(legend).getByText('Jan')).toBeInTheDocument();
      expect(within(legend).getByText('Fev')).toBeInTheDocument();
      expect(within(legend).getByText('Mar')).toBeInTheDocument();
    });
  });

  describe('gráfico de barras agrupadas (series)', () => {
    it('deve renderizar svg com aria-label "Gráfico de barras agrupadas" quando series é fornecido', () => {
      render(<ReportChart {...defaultProps} series={seriesData} />);

      expect(screen.getByRole('img', { name: 'Gráfico de barras agrupadas' })).toBeInTheDocument();
    });

    it('deve renderizar a legenda com os nomes das séries', () => {
      render(<ReportChart {...defaultProps} series={seriesData} />);

      const legend = screen.getByLabelText('Legenda do gráfico');
      expect(within(legend).getByText('Recebido')).toBeInTheDocument();
      expect(within(legend).getByText('A vencer')).toBeInTheDocument();
    });
  });

  describe('gráfico de linha', () => {
    it('deve renderizar svg com aria-label "Gráfico de linha"', () => {
      render(<ReportChart {...defaultProps} type="line" />);

      expect(screen.getByRole('img', { name: 'Gráfico de linha' })).toBeInTheDocument();
    });

    it('deve expor rótulos e valores na tabela acessível', () => {
      const { container } = render(<ReportChart {...defaultProps} type="line" />);

      const text = getTableText(container);
      expect(text).toContain('Jan');
      expect(text).toContain('R$ 1.500');
    });
  });

  describe('gráfico de pizza', () => {
    it('deve renderizar svg com aria-label "Gráfico de pizza"', () => {
      render(<ReportChart type="pie" title="Distribuição" data={pieData} />);

      expect(screen.getByRole('img', { name: 'Gráfico de pizza' })).toBeInTheDocument();
    });

    it('deve expor valores e percentuais na tabela acessível', () => {
      const { container } = render(<ReportChart type="pie" title="Distribuição" data={pieData} />);

      const text = getTableText(container);
      expect(text).toContain('Pagos');
      expect(text).toContain('Pendentes');
      // Percentuais usam toFixed(1), com ponto como separador decimal
      expect(text).toContain('60.0%');
      expect(text).toContain('40.0%');
    });
  });

  describe('legenda', () => {
    it('não deve renderizar legenda com um único ponto de dado', () => {
      render(<ReportChart {...defaultProps} data={singleData} />);

      expect(screen.queryByLabelText('Legenda do gráfico')).not.toBeInTheDocument();
    });
  });

  describe('filtro de período', () => {
    it('deve renderizar inputs de data e botão "Aplicar" quando onDateRangeChange é fornecido', () => {
      render(<ReportChart {...defaultProps} onDateRangeChange={vi.fn()} />);

      expect(screen.getByLabelText('Data inicial')).toBeInTheDocument();
      expect(screen.getByLabelText('Data final')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
    });

    it('deve chamar onDateRangeChange com os valores selecionados ao clicar em "Aplicar"', async () => {
      const onDateRangeChange = vi.fn();
      const user = userEvent.setup();
      render(<ReportChart {...defaultProps} onDateRangeChange={onDateRangeChange} />);

      fireEvent.change(screen.getByLabelText('Data inicial'), {
        target: { value: '2026-07' },
      });
      fireEvent.change(screen.getByLabelText('Data final'), {
        target: { value: '2026-08' },
      });
      await user.click(screen.getByRole('button', { name: 'Aplicar' }));

      expect(onDateRangeChange).toHaveBeenCalledWith({
        start: '2026-07',
        end: '2026-08',
      });
    });

    it('não deve renderizar o filtro de período quando onDateRangeChange não é fornecido', () => {
      render(<ReportChart {...defaultProps} />);

      expect(screen.queryByLabelText('Data inicial')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aplicar' })).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('deve exibir a mensagem padrão quando não há dados', () => {
      render(<ReportChart {...defaultProps} data={[]} />);

      expect(screen.getByText('Nenhum dado disponível para o período')).toBeInTheDocument();
    });

    it('deve exibir mensagem customizada via emptyMessage', () => {
      render(<ReportChart {...defaultProps} data={[]} emptyMessage="Sem faturas no período" />);

      expect(screen.getByText('Sem faturas no período')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('deve exibir skeleton com aria-label "Carregando gráfico" quando isLoading é true', () => {
      render(<ReportChart {...defaultProps} isLoading={true} />);

      const loading = screen.getByRole('status', { name: 'Carregando gráfico' });
      expect(loading).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(<ReportChart {...defaultProps} error="Erro ao carregar relatório" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Erro ao carregar relatório')).toBeInTheDocument();
    });

    it('deve chamar onRetry ao clicar em "Tentar novamente"', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();
      render(<ReportChart {...defaultProps} error="Falha na API" onRetry={onRetry} />);

      await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

      expect(onRetry).toHaveBeenCalledOnce();
    });
  });
});
