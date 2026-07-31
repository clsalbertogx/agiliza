import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionTimeline, type TimelineEvent } from '@/components/collection-timeline';

const baseEvents: TimelineEvent[] = [
  {
    id: 'evt-1',
    event: 'queued',
    channel: 'whatsapp',
    timestamp: '2026-07-28T10:00:00.000Z',
    templateName: 'lembrete_vencimento',
  },
  {
    id: 'evt-2',
    event: 'sent',
    channel: 'whatsapp',
    timestamp: '2026-07-28T10:01:00.000Z',
  },
  {
    id: 'evt-3',
    event: 'delivered',
    channel: 'whatsapp',
    timestamp: '2026-07-28T10:02:00.000Z',
  },
  {
    id: 'evt-4',
    event: 'read',
    channel: 'whatsapp',
    timestamp: '2026-07-28T10:05:00.000Z',
  },
];

describe('CollectionTimeline', () => {
  const defaultProps = {
    clientId: 'client-1',
    invoiceId: 'inv-1',
    events: baseEvents,
  };

  describe('renderização da timeline', () => {
    it('deve renderizar título "Histórico de Cobrança"', () => {
      render(<CollectionTimeline {...defaultProps} />);

      expect(screen.getByText('Histórico de Cobrança')).toBeInTheDocument();
    });

    it('deve renderizar lista de eventos com role="list"', () => {
      render(<CollectionTimeline {...defaultProps} />);

      expect(
        screen.getByRole('list', { name: /linha do tempo de cobrança/i }),
      ).toBeInTheDocument();
    });

    it('deve renderizar label de cada evento', () => {
      render(<CollectionTimeline {...defaultProps} />);

      expect(screen.getByText('Na fila')).toBeInTheDocument();
      expect(screen.getByText('Enviado')).toBeInTheDocument();
      expect(screen.getByText('Entregue')).toBeInTheDocument();
      expect(screen.getByText('Lida')).toBeInTheDocument();
    });

    it('deve renderizar canal de cada evento', () => {
      render(<CollectionTimeline {...defaultProps} />);

      const channelTexts = screen.getAllByText(/· WhatsApp/);
      expect(channelTexts.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('evento "clicked"', () => {
    it('deve renderizar label "Clicou" para evento clicked', () => {
      const events: TimelineEvent[] = [
        ...baseEvents,
        {
          id: 'evt-5',
          event: 'clicked',
          channel: 'whatsapp',
          timestamp: '2026-07-28T10:06:00.000Z',
        },
      ];

      render(<CollectionTimeline {...defaultProps} events={events} />);

      expect(screen.getByText('Clicou')).toBeInTheDocument();
    });
  });

  describe('evento de falha', () => {
    it('deve renderizar label "Falhou" para evento failed', () => {
      const events: TimelineEvent[] = [
        {
          id: 'evt-err',
          event: 'failed',
          channel: 'email',
          timestamp: '2026-07-28T10:00:00.000Z',
          errorMessage: 'Endpoint não respondeu',
        },
      ];

      render(<CollectionTimeline {...defaultProps} events={events} />);

      expect(screen.getByText('Falhou')).toBeInTheDocument();
    });

    it('deve exibir mensagem de erro no evento failed', () => {
      const events: TimelineEvent[] = [
        {
          id: 'evt-err',
          event: 'failed',
          channel: 'email',
          timestamp: '2026-07-28T10:00:00.000Z',
          errorMessage: 'Endpoint não respondeu',
        },
      ];

      render(<CollectionTimeline {...defaultProps} events={events} />);

      expect(screen.getByText(/Erro: Endpoint não respondeu/)).toBeInTheDocument();
    });

    it('deve ter role="alert" no evento failed', () => {
      const events: TimelineEvent[] = [
        {
          id: 'evt-err',
          event: 'failed',
          channel: 'email',
          timestamp: '2026-07-28T10:00:00.000Z',
          errorMessage: 'Erro',
        },
      ];

      render(<CollectionTimeline {...defaultProps} events={events} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('deve ter aria-label com mensagem de erro quando failed', () => {
      const events: TimelineEvent[] = [
        {
          id: 'evt-err',
          event: 'failed',
          channel: 'email',
          timestamp: '2026-07-28T10:00:00.000Z',
          errorMessage: 'Timeout na conexão',
        },
      ];

      render(<CollectionTimeline {...defaultProps} events={events} />);

      expect(
        screen.getByLabelText('Falha: Timeout na conexão'),
      ).toBeInTheDocument();
    });
  });

  describe('template name e conteúdo', () => {
    it('deve renderizar template name quando fornecido', () => {
      render(<CollectionTimeline {...defaultProps} />);

      expect(
        screen.getByText('Template: lembrete_vencimento'),
      ).toBeInTheDocument();
    });

    it('deve renderizar conteúdo quando fornecido', () => {
      const events: TimelineEvent[] = [
        {
          id: 'evt-content',
          event: 'sent',
          channel: 'whatsapp',
          timestamp: '2026-07-28T10:00:00.000Z',
          content: 'Olá, sua fatura vence amanhã!',
        },
      ];

      render(<CollectionTimeline {...defaultProps} events={events} />);

      expect(
        screen.getByText(/Olá, sua fatura vence amanhã!/),
      ).toBeInTheDocument();
    });
  });

  describe('nó de entrega pendente', () => {
    it('deve exibir "Aguardando entrega..." quando último evento é queued', () => {
      const events: TimelineEvent[] = [
        {
          id: 'evt-pending',
          event: 'queued',
          channel: 'whatsapp',
          timestamp: '2026-07-28T10:00:00.000Z',
        },
      ];

      render(<CollectionTimeline {...defaultProps} events={events} />);

      expect(screen.getByText('Aguardando entrega...')).toBeInTheDocument();
    });

    it('deve exibir "Aguardando entrega..." quando último evento é sent', () => {
      const events: TimelineEvent[] = [
        {
          id: 'evt-sent',
          event: 'sent',
          channel: 'whatsapp',
          timestamp: '2026-07-28T10:00:00.000Z',
        },
      ];

      render(<CollectionTimeline {...defaultProps} events={events} />);

      expect(screen.getByText('Aguardando entrega...')).toBeInTheDocument();
    });

    it('não deve exibir "Aguardando entrega..." quando evento foi entregue', () => {
      render(<CollectionTimeline {...defaultProps} />);

      expect(
        screen.queryByText('Aguardando entrega...'),
      ).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('deve exibir "Nenhum lembrete enviado" quando não há eventos', () => {
      render(
        <CollectionTimeline
          clientId="client-1"
          invoiceId="inv-1"
          events={[]}
        />,
      );

      expect(screen.getByText('Nenhum lembrete enviado')).toBeInTheDocument();
    });

    it('deve exibir descrição no empty state', () => {
      render(
        <CollectionTimeline
          clientId="client-1"
          invoiceId="inv-1"
          events={[]}
        />,
      );

      expect(
        screen.getByText('Ainda não foram enviados lembretes para esta fatura.'),
      ).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('deve exibir skeleton de carregamento quando isLoading é true', () => {
      render(
        <CollectionTimeline
          clientId="client-1"
          invoiceId="inv-1"
          events={baseEvents}
          isLoading={true}
        />,
      );

      const loading = screen.getByRole('status');
      expect(loading).toBeInTheDocument();
      expect(loading).toHaveAttribute('aria-label', 'Carregando timeline');
    });

    it('não deve exibir eventos durante loading', () => {
      render(
        <CollectionTimeline
          clientId="client-1"
          invoiceId="inv-1"
          events={baseEvents}
          isLoading={true}
        />,
      );

      expect(screen.queryByText('Na fila')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(
        <CollectionTimeline
          clientId="client-1"
          invoiceId="inv-1"
          events={baseEvents}
          error="Erro ao carregar timeline"
        />,
      );

      expect(
        screen.getByText('Erro ao carregar timeline'),
      ).toBeInTheDocument();
    });

    it('deve exibir botão "Tentar novamente" quando onRetry é fornecido', () => {
      render(
        <CollectionTimeline
          clientId="client-1"
          invoiceId="inv-1"
          events={baseEvents}
          error="Erro"
          onRetry={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: /tentar novamente/i }),
      ).toBeInTheDocument();
    });
  });
});
