import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { PaymentGatewayPort, PixChargeResponse } from '@/application/ports/payment-gateway.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { isFailure, isSuccess } from '@/application/types/either';
import { type ProcessPaymentInput, ProcessPaymentUseCase } from '@/application/usecases/process-payment.usecase';
import { type Invoice, InvoiceStatus, PaymentMethod } from '@/domain/entities/invoice';

const mockInvoiceRepo: InvoiceRepositoryPort = {
  findById: vi.fn(),
  findExistingForSubscription: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  getStats: vi.fn(),
};

const mockClientRepo: ClientRepositoryPort = {
  findById: vi.fn(),
  findByPhone: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  updateRiskScore: vi.fn(),
};

const mockPaymentRepo: PaymentRepositoryPort = {
  create: vi.fn(),
  findByInvoiceId: vi.fn(),
  findById: vi.fn(),
};

const mockPaymentGateway: PaymentGatewayPort = {
  createPixCharge: vi.fn(),
  createCreditCardCharge: vi.fn(),
  createBoletoCharge: vi.fn(),
  getCharge: vi.fn(),
  cancelCharge: vi.fn(),
  verifyWebhook: vi.fn(),
  handleWebhook: vi.fn(),
};

const mockEventBus: EventBusPort = {
  publish: vi.fn(),
  subscribe: vi.fn(),
};

describe('ProcessPaymentUseCase', () => {
  let useCase: ProcessPaymentUseCase;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
  const INVOICE_ID = '00000000-0000-0000-0000-000000000003';

  const validInput: ProcessPaymentInput = {
    invoiceId: INVOICE_ID,
    tenantId: TENANT_ID,
  };

  const mockInvoice: Invoice = {
    id: INVOICE_ID,
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    amount: 150.0,
    dueDate: new Date('2026-08-15'),
    description: 'Test invoice',
    status: InvoiceStatus.PENDING,
    paymentMethod: undefined,
    pixQRCode: undefined,
    pixCopyPaste: undefined,
    pixExpiresAt: undefined,
    externalPaymentId: undefined,
    paidAt: undefined,
    metadata: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPixCharge: PixChargeResponse = {
    id: 'pix-charge-001',
    qrCode: 'data:image/png;base64,test-qr-code',
    copyPaste: '00020126580014BR.GOV.BCB.PIX0136test',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'PENDING',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ProcessPaymentUseCase(
      mockInvoiceRepo,
      mockClientRepo,
      mockPaymentRepo,
      mockPaymentGateway,
      mockEventBus,
    );
  });

  describe('Happy Path', () => {
    it('should create PIX charge for pending invoice and return PIX data', async () => {
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
      vi.mocked(mockPaymentGateway.createPixCharge).mockResolvedValue(mockPixCharge);
      vi.mocked(mockInvoiceRepo.update).mockImplementation(async (invoice: Invoice) => invoice);

      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value.status).toBe('PENDING');
        expect(result.value.pix.qrCode).toBe(mockPixCharge.qrCode);
        expect(result.value.pix.copyPaste).toBe(mockPixCharge.copyPaste);
        expect(result.value.pix.expiresAt).toEqual(mockPixCharge.expiresAt);
      }
    });

    it('should update invoice with PIX data', async () => {
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
      vi.mocked(mockPaymentGateway.createPixCharge).mockResolvedValue(mockPixCharge);
      vi.mocked(mockInvoiceRepo.update).mockImplementation(async (invoice: Invoice) => invoice);

      await useCase.execute(validInput);

      expect(mockInvoiceRepo.update).toHaveBeenCalledTimes(1);
      const updatedInvoice = vi.mocked(mockInvoiceRepo.update).mock.calls[0][0];
      expect(updatedInvoice.paymentMethod).toBe(PaymentMethod.PIX);
      expect(updatedInvoice.pixQRCode).toBe(mockPixCharge.qrCode);
      expect(updatedInvoice.pixCopyPaste).toBe(mockPixCharge.copyPaste);
      expect(updatedInvoice.pixExpiresAt).toEqual(mockPixCharge.expiresAt);
    });

    it('should call payment gateway with correct parameters', async () => {
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
      vi.mocked(mockPaymentGateway.createPixCharge).mockResolvedValue(mockPixCharge);
      vi.mocked(mockInvoiceRepo.update).mockImplementation(async (invoice: Invoice) => invoice);

      await useCase.execute(validInput);

      expect(mockPaymentGateway.createPixCharge).toHaveBeenCalledTimes(1);
      expect(mockPaymentGateway.createPixCharge).toHaveBeenCalledWith({
        amount: 150.0,
        description: 'Test invoice',
        externalReference: INVOICE_ID,
      });
    });

    it('should fallback to invoice ID in description when description is not set', async () => {
      const invoiceWithoutDesc: Invoice = { ...mockInvoice, description: undefined };
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(invoiceWithoutDesc);
      vi.mocked(mockPaymentGateway.createPixCharge).mockResolvedValue(mockPixCharge);
      vi.mocked(mockInvoiceRepo.update).mockImplementation(async (invoice: Invoice) => invoice);

      await useCase.execute(validInput);

      expect(mockPaymentGateway.createPixCharge).toHaveBeenCalledWith({
        amount: 150.0,
        description: `Invoice ${INVOICE_ID}`,
        externalReference: INVOICE_ID,
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should return NOT_FOUND for non-existent invoice', async () => {
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(null);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('NOT_FOUND');
        expect(result.value.statusCode).toBe(404);
        expect(result.value.message).toContain('Invoice');
      }
    });

    it('should return ALREADY_PAID for paid invoice', async () => {
      const paidInvoice: Invoice = { ...mockInvoice, status: InvoiceStatus.PAID };
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(paidInvoice);

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('ALREADY_PAID');
        expect(result.value.statusCode).toBe(400);
      }
    });

    it('should handle payment provider errors with message', async () => {
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
      vi.mocked(mockPaymentGateway.createPixCharge).mockRejectedValue(new Error('Provider API unavailable'));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('PAYMENT_PROVIDER_ERROR');
        expect(result.value.statusCode).toBe(502);
        expect(result.value.message).toContain('Provider API unavailable');
      }
    });

    it('should handle payment provider errors without message', async () => {
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
      vi.mocked(mockPaymentGateway.createPixCharge).mockRejectedValue(new Error(''));

      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('PAYMENT_PROVIDER_ERROR');
        expect(result.value.statusCode).toBe(502);
        expect(result.value.message).toContain('Unknown error');
      }
    });

    it('should not update invoice when payment fails', async () => {
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
      vi.mocked(mockPaymentGateway.createPixCharge).mockRejectedValue(new Error('Error'));

      await useCase.execute(validInput);

      expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
    });

    it('should not create payment when invoice is already paid', async () => {
      const paidInvoice: Invoice = { ...mockInvoice, status: InvoiceStatus.PAID };
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(paidInvoice);

      await useCase.execute(validInput);

      expect(mockPaymentGateway.createPixCharge).not.toHaveBeenCalled();
      expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
    });
  });
});
