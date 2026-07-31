import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSuccess, isFailure, success } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { ProcessPaymentWebhookUseCase, ProcessPaymentWebhookInput } from '@/application/usecases/process-payment-webhook.usecase';
import { PaymentWebhookParserPort, PaymentWebhookData } from '@/application/ports/gateways/payment-webhook-parser.port';
import { WebhookVerifierPort } from '@/application/ports/gateways/webhook-verifier.port';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { Invoice, InvoiceStatus } from '@/domain/entities/invoice';

// ── Mocks ────────────────────────────────────────────────────────────

const mockVerifier: WebhookVerifierPort = {
  verify: vi.fn(),
};

const mockParser: PaymentWebhookParserPort = {
  parse: vi.fn(),
};

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

const mockPaymentRepo: PaymentRepositoryPort = {
  create: vi.fn(),
  findByInvoiceId: vi.fn(),
  findById: vi.fn(),
};

const mockEventBus: EventBusPort = {
  publish: vi.fn(),
  subscribe: vi.fn(),
};

// ── Fixtures ─────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const INVOICE_ID = '00000000-0000-0000-0000-000000000003';
const PROVIDER = 'asaas';
const PROVIDER_PAYMENT_ID = 'pay_abc123';

const validInput: ProcessPaymentWebhookInput = {
  provider: PROVIDER,
  rawBody: JSON.stringify({ event: 'PAYMENT_CONFIRMED', payment: { id: PROVIDER_PAYMENT_ID, externalReference: INVOICE_ID, value: 150.00 } }),
  signature: 'valid-signature',
  tenantId: TENANT_ID,
};

const mockInvoice: Invoice = {
  id: INVOICE_ID,
  tenantId: TENANT_ID,
  clientId: CLIENT_ID,
  amount: 150.00,
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

function makeUseCase() {
  return new ProcessPaymentWebhookUseCase(
    mockVerifier,
    mockParser,
    mockInvoiceRepo,
    mockPaymentRepo,
    mockEventBus,
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ProcessPaymentWebhookUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Signature Verification', () => {
    it('should verify the webhook signature before processing', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(null);

      const useCase = makeUseCase();
      await useCase.execute(validInput);

      expect(mockVerifier.verify).toHaveBeenCalledTimes(1);
      expect(mockVerifier.verify).toHaveBeenCalledWith(
        PROVIDER,
        validInput.rawBody,
        validInput.signature,
        TENANT_ID,
      );
    });

    it('should return UNAUTHORIZED for invalid signature', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(false));

      const useCase = makeUseCase();
      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('UNAUTHORIZED');
        expect(result.value.statusCode).toBe(401);
        expect(result.value.message).toContain('Invalid webhook signature');
      }
    });

    it('should propagate verifier errors', async () => {
      const verifierError = ApplicationError.internal('DB failure');
      vi.mocked(mockVerifier.verify).mockResolvedValue({ success: false, value: verifierError } as any);

      const useCase = makeUseCase();
      const result = await useCase.execute(validInput);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.message).toContain('DB failure');
      }
    });

    it('should not parse or update anything when signature is invalid', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(false));

      const useCase = makeUseCase();
      await useCase.execute(validInput);

      expect(mockParser.parse).not.toHaveBeenCalled();
      expect(mockInvoiceRepo.findById).not.toHaveBeenCalled();
      expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Payment Confirmed', () => {
    const confirmedData: PaymentWebhookData = {
      providerPaymentId: PROVIDER_PAYMENT_ID,
      status: 'confirmed',
      invoiceId: INVOICE_ID,
      amount: 150.00,
      paidAt: new Date('2026-07-30T12:00:00Z'),
      rawPayload: { event: 'PAYMENT_CONFIRMED', payment: { id: PROVIDER_PAYMENT_ID } },
    };

    it('should mark invoice as PAID for PAYMENT_CONFIRMED', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(confirmedData);
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
      vi.mocked(mockInvoiceRepo.update).mockImplementation(async (inv) => inv);

      const useCase = makeUseCase();
      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      expect(mockInvoiceRepo.findById).toHaveBeenCalledWith(INVOICE_ID, TENANT_ID);
      expect(mockInvoiceRepo.update).toHaveBeenCalledTimes(1);

      const updatedInvoice = vi.mocked(mockInvoiceRepo.update).mock.calls[0][0];
      expect(updatedInvoice.status).toBe(InvoiceStatus.PAID);
      expect(updatedInvoice.externalPaymentId).toBe(PROVIDER_PAYMENT_ID);
      expect(updatedInvoice.paidAt).toEqual(confirmedData.paidAt);
    });

    it('should publish payment.confirmed event when invoice is paid', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(confirmedData);
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
      vi.mocked(mockInvoiceRepo.update).mockImplementation(async (inv) => inv);

      const useCase = makeUseCase();
      await useCase.execute(validInput);

      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = vi.mocked(mockEventBus.publish).mock.calls[0][0];
      expect(publishedEvent.eventType).toBe('payment.confirmed');
      expect(publishedEvent.clientId).toBe(CLIENT_ID);
      expect(publishedEvent.tenantId).toBe(TENANT_ID);
      expect(publishedEvent.invoiceId).toBe(INVOICE_ID);
      expect(publishedEvent.metadata).toEqual({
        amount: 150.00,
        provider: PROVIDER,
        providerPaymentId: PROVIDER_PAYMENT_ID,
      });
    });

    it('should use current date when paidAt is not provided', async () => {
      const confirmedDataNoPaidAt: PaymentWebhookData = {
        providerPaymentId: PROVIDER_PAYMENT_ID,
        status: 'confirmed',
        invoiceId: INVOICE_ID,
        amount: 150.00,
        paidAt: undefined,
        rawPayload: { event: 'PAYMENT_CONFIRMED', payment: { id: PROVIDER_PAYMENT_ID } },
      };
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(confirmedDataNoPaidAt);
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
      vi.mocked(mockInvoiceRepo.update).mockImplementation(async (inv) => inv);

      const useCase = makeUseCase();
      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      expect(mockInvoiceRepo.update).toHaveBeenCalledTimes(1);
      const updatedInvoice = vi.mocked(mockInvoiceRepo.update).mock.calls[0][0];
      expect(updatedInvoice.paidAt).toBeInstanceOf(Date);
    });

    it('should not update invoice if already PAID', async () => {
      const paidInvoice: Invoice = { ...mockInvoice, status: InvoiceStatus.PAID };
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(confirmedData);
      vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(paidInvoice);

      const useCase = makeUseCase();
      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Payment Failed', () => {
    const failedData: PaymentWebhookData = {
      providerPaymentId: PROVIDER_PAYMENT_ID,
      status: 'failed',
      invoiceId: INVOICE_ID,
      rawPayload: { event: 'PAYMENT_FAILED', payment: { id: PROVIDER_PAYMENT_ID } },
    };

    it('should not change invoice for PAYMENT_FAILED', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(failedData);

      const useCase = makeUseCase();
      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      expect(mockInvoiceRepo.findById).not.toHaveBeenCalled();
      expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Unknown Event', () => {
    it('should handle unknown event type gracefully (parser returns null)', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(null);

      const useCase = makeUseCase();
      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.value.received).toBe(true);
        expect(result.value.provider).toBe(PROVIDER);
      }
      expect(mockInvoiceRepo.findById).not.toHaveBeenCalled();
      expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Webhook Data Parsing', () => {
    it('should pass parsed body to the parser', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(null);

      const useCase = makeUseCase();
      await useCase.execute(validInput);

      expect(mockParser.parse).toHaveBeenCalledTimes(1);
      expect(mockParser.parse).toHaveBeenCalledWith(
        PROVIDER,
        JSON.parse(validInput.rawBody),
      );
    });

    it('should return failure for invalid JSON body', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));

      const useCase = makeUseCase();
      const result = await useCase.execute({
        ...validInput,
        rawBody: 'not-json',
      });

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.value.code).toBe('VALIDATION_ERROR');
        expect(result.value.statusCode).toBe(400);
      }
    });
  });

  describe('Payment Refunded', () => {
    const refundedData: PaymentWebhookData = {
      providerPaymentId: PROVIDER_PAYMENT_ID,
      status: 'refunded',
      invoiceId: INVOICE_ID,
      amount: 150.00,
      rawPayload: { event: 'PAYMENT_REFUNDED', payment: { id: PROVIDER_PAYMENT_ID } },
    };

    it('should not update invoice for PAYMENT_REFUNDED', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(refundedData);

      const useCase = makeUseCase();
      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      expect(mockInvoiceRepo.findById).not.toHaveBeenCalled();
      expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('Missing invoiceId in webhook', () => {
    const confirmedDataNoInvoice: PaymentWebhookData = {
      providerPaymentId: PROVIDER_PAYMENT_ID,
      status: 'confirmed',
      invoiceId: undefined,
      amount: 150.00,
      rawPayload: { event: 'PAYMENT_CONFIRMED', payment: { id: PROVIDER_PAYMENT_ID } },
    };

    it('should not update invoice when invoiceId is missing', async () => {
      vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
      vi.mocked(mockParser.parse).mockReturnValue(confirmedDataNoInvoice);

      const useCase = makeUseCase();
      const result = await useCase.execute(validInput);

      expect(isSuccess(result)).toBe(true);
      expect(mockInvoiceRepo.findById).not.toHaveBeenCalled();
      expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
