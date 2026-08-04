import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaymentStatus } from '@/components/payment-status';

describe('PaymentStatus', () => {
  it('deve exibir "Aguardando pagamento" quando status é pending', () => {
    render(<PaymentStatus status="pending" />);

    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('deve exibir "Processando pagamento" quando status é processing', () => {
    render(<PaymentStatus status="processing" />);

    expect(screen.getByText('Processando pagamento')).toBeInTheDocument();
  });

  it('deve exibir "Pagamento confirmado" quando status é paid', () => {
    render(<PaymentStatus status="paid" />);

    expect(screen.getByText('Pagamento confirmado')).toBeInTheDocument();
  });

  it('deve exibir "Pagamento recusado" quando status é failed', () => {
    render(<PaymentStatus status="failed" />);

    expect(screen.getByText('Pagamento recusado')).toBeInTheDocument();
  });

  it('deve exibir o método de pagamento quando fornecido', () => {
    render(<PaymentStatus status="pending" method="pix" />);

    expect(screen.getByText('via PIX')).toBeInTheDocument();
  });

  it('deve exibir "Cartão de Crédito" quando método é credit_card', () => {
    render(<PaymentStatus status="paid" method="credit_card" />);

    expect(screen.getByText('via Cartão de Crédito')).toBeInTheDocument();
  });

  it('deve exibir "Boleto" quando método é boleto', () => {
    render(<PaymentStatus status="failed" method="boleto" />);

    expect(screen.getByText('via Boleto')).toBeInTheDocument();
  });
});
