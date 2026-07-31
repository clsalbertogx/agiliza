import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MessageTracking,
  type MessageDetails,
  type MessageTrackingEvent,
} from '@/components/message-tracking';

function makeEvent(
  event: MessageTrackingEvent['event'],
  overrides: Partial<MessageTrackingEvent> = {},
): MessageTrackingEvent {
  return { event, timestamp: '2026-07-28T10:00:00.000Z', ...overrides };
}

function makeData(overrides: Partial<MessageDetails> = {}): MessageDetails {
  return {
    id: 'msg-1',
    clientId: 'client-1',
    clientName: 'João Silva',
    channel: 'whatsapp',
    templateName: 'lembrete_vencimento',
    status: 'delivered',
    events: [
      makeEvent('queued', { timestamp: '2026-07-28T10:00:00.000Z' }),
      makeEvent('sent', { timestamp: '2026-07-28T10:01:00.000Z' }),
      makeEvent('delivered', { timestamp: '2026-07-28T10:02:00.000Z' }),
    ],
    sentAt: '2026-07-28T10:01:00.000Z',
    deliveredAt: '2026-07-28T10:02:00.000Z',
    ...overrides,
  };
}

describe('MessageTracking', () => {
  const defaultProps = {
    messageId: 'msg-1',
    data: makeData(),
  };

  describe('informações do cabeçalho', () => {
    it('deve renderizar o título "Rastreamento de Mensagem"', () => {
      render(<MessageTracking {...defaultProps} />);

      expect(screen.getByText('Rastreamento de Mensagem')).toBeInTheDocument();
    });

    it('deve renderizar o nome do cliente', () => {
      render(<MessageTracking {...defaultProps} />);

      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });

    it('deve renderizar o canal formatado como "WhatsApp"', () => {
      render(<MessageTracking {...defaultProps} />);

      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });

    it('deve renderizar os canais "Email" e "SMS"', () => {
      const { rerender } = render(
        <MessageTracking
          messageId="msg-email"
          data={makeData({ channel: 'email' })}
        />,
      );
      expect(screen.getByText('Email')).toBeInTheDocument();

      rerender(
        <MessageTracking
          messageId="msg-sms"
          data={makeData({ channel: 'sms' })}
        />,
      );
      expect(screen.getByText('SMS')).toBeInTheDocument();
    });

    it('deve renderizar o nome do template', () => {
      render(<MessageTracking {...defaultProps} />);

      expect(screen.getByText('lembrete_vencimento')).toBeInTheDocument();
    });

    it('deve renderizar o badge de status com o label do evento', () => {
      const data = makeData({
        status: 'queued',
        events: [],
      });

      render(<MessageTracking messageId="msg-queued" data={data} />);

      expect(screen.getByText('Na fila para envio')).toBeInTheDocument();
    });
  });

  describe('linha do tempo de eventos', () => {
    it('deve renderizar a lista com aria-label "Linha do tempo da mensagem"', () => {
      render(<MessageTracking {...defaultProps} />);

      expect(
        screen.getByRole('list', { name: 'Linha do tempo da mensagem' }),
      ).toBeInTheDocument();
    });

    it('deve renderizar o label de cada evento realizado', () => {
      render(<MessageTracking {...defaultProps} />);

      expect(screen.getByText('Na fila para envio')).toBeInTheDocument();
      expect(screen.getByText('Enviada')).toBeInTheDocument();
      // "Entregue" aparece no badge de status e no nó da timeline
      expect(screen.getAllByText('Entregue').length).toBeGreaterThanOrEqual(1);
    });

    it('deve renderizar um nó (listitem) por evento quando o status é final', () => {
      const data = makeData({
        status: 'clicked',
        events: [
          makeEvent('queued'),
          makeEvent('sent'),
          makeEvent('delivered'),
          makeEvent('read'),
          makeEvent('clicked'),
        ],
      });

      render(<MessageTracking messageId="msg-full" data={data} />);

      expect(screen.getAllByRole('listitem')).toHaveLength(5);
    });

    it('deve renderizar o label "Clicou no link" para evento clicked', () => {
      const data = makeData({
        status: 'clicked',
        events: [makeEvent('queued'), makeEvent('clicked')],
      });

      render(<MessageTracking messageId="msg-clicked" data={data} />);

      // "Clicou no link" aparece no badge de status e no nó da timeline
      expect(screen.getAllByText('Clicou no link').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('eventos futuros / pendentes', () => {
    it('deve exibir "Em andamento..." com os próximos eventos quando o status é sent', () => {
      const data = makeData({
        status: 'sent',
        events: [
          makeEvent('queued', { timestamp: '2026-07-28T10:00:00.000Z' }),
          makeEvent('sent', { timestamp: '2026-07-28T10:01:00.000Z' }),
        ],
      });

      render(<MessageTracking messageId="msg-sent" data={data} />);

      expect(screen.getAllByText('Em andamento...')).toHaveLength(3);
      expect(screen.getByText('Entregue')).toBeInTheDocument();
      expect(screen.getByText('Lida')).toBeInTheDocument();
      // "Clicou no link" aparece no badge de status e no nó da timeline
      expect(screen.getAllByText('Clicou no link').length).toBeGreaterThanOrEqual(1);
    });

    it('não deve exibir eventos futuros quando o status é final (clicked)', () => {
      const data = makeData({
        status: 'clicked',
        events: [
          makeEvent('queued'),
          makeEvent('sent'),
          makeEvent('delivered'),
          makeEvent('read'),
          makeEvent('clicked'),
        ],
      });

      render(<MessageTracking messageId="msg-final" data={data} />);

      expect(screen.queryByText('Em andamento...')).not.toBeInTheDocument();
    });
  });

  describe('evento de falha na timeline', () => {
    it('deve marcar o nó do evento failed com role="alert"', () => {
      const data = makeData({
        status: 'failed',
        events: [
          makeEvent('failed', { metadata: { error: 'HTTP 500' } }),
        ],
      });

      render(<MessageTracking messageId="msg-failed" data={data} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('deve exibir a mensagem de erro do metadata no nó failed', () => {
      const data = makeData({
        status: 'failed',
        events: [
          makeEvent('failed', { metadata: { error: 'Endpoint indisponível' } }),
        ],
      });

      render(<MessageTracking messageId="msg-failed" data={data} />);

      expect(screen.getByText(/Erro: Endpoint indisponível/)).toBeInTheDocument();
    });
  });

  describe('alerta de mensagem com falha', () => {
    it('deve exibir "Erro no envio" com a mensagem de erro quando o status é failed', () => {
      const data = makeData({
        status: 'failed',
        errorMessage: 'Provedor recusou a mensagem',
        events: [makeEvent('failed')],
      });

      render(<MessageTracking messageId="msg-failed" data={data} />);

      expect(screen.getByText('Erro no envio')).toBeInTheDocument();
      expect(screen.getByText('Provedor recusou a mensagem')).toBeInTheDocument();
    });

    it('não deve exibir o alerta de erro quando a mensagem não falhou', () => {
      render(<MessageTracking {...defaultProps} />);

      expect(screen.queryByText('Erro no envio')).not.toBeInTheDocument();
    });
  });

  describe('pré-visualização do conteúdo', () => {
    it('deve renderizar o conteúdo da mensagem em blockquote', () => {
      const data = makeData({
        content: 'Olá, sua fatura vence amanhã. Acesse para pagar.',
      });

      render(<MessageTracking {...defaultProps} data={data} />);

      expect(screen.getByText('Conteúdo da Mensagem')).toBeInTheDocument();
      expect(
        screen.getByText(/Olá, sua fatura vence amanhã/),
      ).toBeInTheDocument();
    });

    it('não deve renderizar a seção de conteúdo quando content não é fornecido', () => {
      render(<MessageTracking {...defaultProps} />);

      expect(
        screen.queryByText('Conteúdo da Mensagem'),
      ).not.toBeInTheDocument();
    });
  });

  describe('sem eventos registrados', () => {
    it('deve renderizar cabeçalho e eventos pendentes mesmo sem eventos', () => {
      const data = makeData({
        status: 'queued',
        events: [],
      });

      render(<MessageTracking messageId="msg-empty" data={data} />);

      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getAllByText('Em andamento...')).toHaveLength(4);
    });

    it('deve renderizar linha do tempo vazia quando o status é final e não há eventos', () => {
      const data = makeData({
        status: 'clicked',
        events: [],
      });

      render(<MessageTracking messageId="msg-final-empty" data={data} />);

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    });
  });

  describe('loading state', () => {
    it('deve exibir skeleton com aria-label "Carregando..." quando isLoading é true', () => {
      render(<MessageTracking {...defaultProps} isLoading={true} />);

      const loading = screen.getByRole('status');
      expect(loading).toBeInTheDocument();
      expect(loading).toHaveAttribute('aria-label', 'Carregando...');
    });

    it('não deve exibir os dados durante o carregamento', () => {
      render(<MessageTracking {...defaultProps} isLoading={true} />);

      expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(
        <MessageTracking
          {...defaultProps}
          error="Erro ao carregar rastreamento"
        />,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText('Erro ao carregar rastreamento'),
      ).toBeInTheDocument();
    });

    it('deve chamar onRetry ao clicar em "Tentar novamente"', async () => {
      const onRetry = vi.fn();
      const user = userEvent.setup();
      render(
        <MessageTracking
          {...defaultProps}
          error="Falha na conexão"
          onRetry={onRetry}
        />,
      );

      await user.click(
        screen.getByRole('button', { name: /tentar novamente/i }),
      );

      expect(onRetry).toHaveBeenCalledOnce();
    });
  });
});
