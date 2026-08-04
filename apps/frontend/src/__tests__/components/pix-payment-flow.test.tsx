import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PixPaymentFlow } from '@/components/pix-payment-flow';

// Use a far-future date so the countdown never expires during tests
const FAR_FUTURE = new Date();
FAR_FUTURE.setFullYear(FAR_FUTURE.getFullYear() + 1);

const mockPixData = {
  qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  copyPasteKey:
    '00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540410.005802BR5912JohnDoe6009SaoPaulo62070503***6304ABCD',
  expiresAt: FAR_FUTURE.toISOString(),
  amount: 1500.5,
  invoiceId: 'inv-123',
};

const defaultProps = {
  invoiceId: 'inv-123',
  pixData: mockPixData,
  onPaid: vi.fn(),
};

describe('PixPaymentFlow', () => {
  describe('renderização padrão (pending)', () => {
    it('deve renderizar o valor do PIX formatado', () => {
      render(<PixPaymentFlow {...defaultProps} />);

      expect(screen.getByText('R$ 1.500,50')).toBeInTheDocument();
    });

    it('deve renderizar a imagem do QR Code', () => {
      render(<PixPaymentFlow {...defaultProps} />);

      const qrImage = screen.getByAltText('QR Code para pagamento PIX');
      expect(qrImage).toBeInTheDocument();
      expect(qrImage).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'));
    });

    it('deve renderizar a chave PIX para cópia', () => {
      render(<PixPaymentFlow {...defaultProps} />);

      const pixKey = screen.getByLabelText('Chave PIX para copiar');
      expect(pixKey).toBeInTheDocument();
      expect(pixKey).toHaveTextContent(
        '00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540410.005802BR5912JohnDoe6009SaoPaulo62070503***6304ABCD',
      );
    });

    it('deve renderizar botão de copiar código PIX', () => {
      render(<PixPaymentFlow {...defaultProps} />);

      expect(screen.getByRole('button', { name: /copiar código pix/i })).toBeInTheDocument();
    });

    it('deve renderizar o timer de expiração', () => {
      render(<PixPaymentFlow {...defaultProps} />);

      expect(screen.getByText(/expira em/i)).toBeInTheDocument();
    });

    it('deve renderizar o status de pagamento como "Aguardando pagamento"', () => {
      render(<PixPaymentFlow {...defaultProps} />);

      expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument();
    });
  });

  describe('botão de copiar', () => {
    it('deve copiar a chave PIX para a área de transferência ao clicar', async () => {
      const user = userEvent.setup();
      render(<PixPaymentFlow {...defaultProps} />);

      const copyButton = screen.getByRole('button', { name: /copiar código pix/i });
      await user.click(copyButton);

      // Verifica que o texto 'Copiado!' aparece (indica que a cópia funcionou)
      expect(await screen.findByText('Copiado!')).toBeInTheDocument();
    });

    it('deve exibir "Copiado!" após copiar', async () => {
      // Setup clipboard mock
      if (navigator.clipboard) {
        vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      }
      render(<PixPaymentFlow {...defaultProps} />);

      const copyButton = screen.getByRole('button', { name: /copiar código pix/i });
      const user = userEvent.setup();
      await user.click(copyButton);

      expect(await screen.findByText('Copiado!')).toBeInTheDocument();
    });
  });

  describe('estado de pagamento confirmado (paid)', () => {
    it('deve exibir "Pagamento Confirmado!" quando pollStatus é "paid"', () => {
      render(<PixPaymentFlow {...defaultProps} pollStatus="paid" />);

      expect(screen.getByText('Pagamento Confirmado!')).toBeInTheDocument();
    });

    it('deve exibir o valor pago no estado de confirmação', () => {
      render(<PixPaymentFlow {...defaultProps} pollStatus="paid" />);

      expect(screen.getByText('R$ 1.500,50')).toBeInTheDocument();
    });

    it('deve exibir botão "Voltar para faturas" quando pago', () => {
      render(<PixPaymentFlow {...defaultProps} pollStatus="paid" />);

      expect(screen.getByRole('button', { name: /voltar para faturas/i })).toBeInTheDocument();
    });

    it('deve chamar onPaid ao clicar em "Voltar para faturas"', async () => {
      const onPaid = vi.fn();
      const user = userEvent.setup();
      render(<PixPaymentFlow {...defaultProps} pollStatus="paid" onPaid={onPaid} />);

      await user.click(screen.getByRole('button', { name: /voltar para faturas/i }));

      expect(onPaid).toHaveBeenCalledTimes(1);
    });
  });

  describe('estado expirado (expired)', () => {
    it('deve exibir "QR Code Expirado" quando pollStatus é "expired"', () => {
      render(<PixPaymentFlow {...defaultProps} pollStatus="expired" />);

      expect(screen.getByText('QR Code Expirado')).toBeInTheDocument();
    });

    it('deve exibir botão "Gerar novo QR Code" quando expirado', () => {
      render(<PixPaymentFlow {...defaultProps} pollStatus="expired" />);

      expect(screen.getByRole('button', { name: /gerar novo qr code/i })).toBeInTheDocument();
    });

    it('deve chamar onExpired ao clicar em "Gerar novo QR Code"', async () => {
      const onExpired = vi.fn();
      const user = userEvent.setup();
      render(<PixPaymentFlow {...defaultProps} pollStatus="expired" onExpired={onExpired} />);

      await user.click(screen.getByRole('button', { name: /gerar novo qr code/i }));

      expect(onExpired).toHaveBeenCalledTimes(1);
    });

    it('deve exibir botão "Cancelar pagamento" quando onCancel é fornecido no estado expirado', () => {
      render(<PixPaymentFlow {...defaultProps} pollStatus="expired" onCancel={vi.fn()} />);

      expect(screen.getByRole('button', { name: /cancelar pagamento/i })).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('deve exibir skeleton de carregamento quando isLoading é true', () => {
      render(<PixPaymentFlow {...defaultProps} isLoading={true} />);

      const loading = screen.getByRole('status');
      expect(loading).toBeInTheDocument();
      expect(loading).toHaveAttribute('aria-label', 'Carregando PIX');
    });

    it('não deve exibir QR Code quando isLoading é true', () => {
      render(<PixPaymentFlow {...defaultProps} isLoading={true} />);

      expect(screen.queryByAltText('QR Code para pagamento PIX')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('deve exibir mensagem de erro quando error é fornecido', () => {
      render(<PixPaymentFlow {...defaultProps} error="Erro ao carregar PIX" />);

      expect(screen.getByText('Erro ao carregar PIX')).toBeInTheDocument();
    });
  });

  describe('polling e timer', () => {
    it('deve exibir PaymentStatus com status "processing" quando pollStatus é "processing"', () => {
      render(<PixPaymentFlow {...defaultProps} pollStatus="processing" />);

      expect(screen.getByText('Processando pagamento')).toBeInTheDocument();
    });

    it('deve exibir botão "Cancelar" quando onCancel é fornecido', () => {
      render(<PixPaymentFlow {...defaultProps} onCancel={vi.fn()} />);

      expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    });
  });
});
