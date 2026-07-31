import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSuccess, isFailure } from '@/application/types/either';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { PaymentGatewayPort, PixChargeResponse } from '@/application/ports/payment-gateway.port';
import { Invoice, InvoiceStatus, PaymentMethod } from '@/domain/entities/invoice';
import { ProcessPaymentUseCase, ProcessPaymentInput } from '@/application/usecases/process-payment.usecase';
import { ProcessPaymentWebhookUseCase, ProcessPaymentWebhookInput } from '@/application/usecases/process-payment-webhook.usecase';
import { PaymentWebhookParserPort, PaymentWebhookData } from '@/application/ports/gateways/payment-webhook-parser.port';
import { WebhookVerifierPort } from '@/application/ports/gateways/webhook-verifier.port';
import { success } from '@/application/types/either';

// ── ProcessPaymentUseCase mocks ──────────────────────────────────────

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

// ── ProcessPaymentWebhookUseCase mocks ───────────────────────────────

const mockVerifier: WebhookVerifierPort = {
  verify: vi.fn(),
};

const mockParser: PaymentWebhookParserPort = {
  parse: vi.fn(),
};

// ── Fixtures ─────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const INVOICE_ID = '00000000-0000-0000-0000-000000000003';
const PROVIDER = 'asaas';
const PROVIDER_PAYMENT_ID = 'pay_abc123';

const validProcessPaymentInput: ProcessPaymentInput = {
  invoiceId: INVOICE_ID,
  tenantId: TENANT_ID,
};

const validWebhookInput: ProcessPaymentWebhookInput = {
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

const mockPixCharge: PixChargeResponse = {
  id: 'pix-charge-001',
  qrCode: 'data:image/png;base64,test-qr-code',
  copyPaste: '00020126580014BR.GOV.BCB.PIX0136test',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  status: 'PENDING',
};

const confirmedWebhookData: PaymentWebhookData = {
  providerPaymentId: PROVIDER_PAYMENT_ID,
  status: 'confirmed',
  invoiceId: INVOICE_ID,
  amount: 150.00,
  paidAt: new Date('2026-07-30T12:00:00Z'),
  rawPayload: { event: 'PAYMENT_CONFIRMED', payment: { id: PROVIDER_PAYMENT_ID } },
};

describe('ProcessPaymentUseCase — Payment Recording', () => {
  let processPayment: ProcessPaymentUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    processPayment = new ProcessPaymentUseCase(
      mockInvoiceRepo,
      mockClientRepo,
      mockPaymentRepo,
      mockPaymentGateway,
      mockEventBus,
    );
  });

  it('should create a Payment record when processing a PIX charge', async () => {
    vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
    vi.mocked(mockPaymentGateway.createPixCharge).mockResolvedValue(mockPixCharge);
    vi.mocked(mockInvoiceRepo.update).mockImplementation(async (invoice: Invoice) => invoice);
    vi.mocked(mockPaymentRepo.create).mockImplementation(async (payment) => payment);

    const result = await processPayment.execute(validProcessPaymentInput);

    expect(isSuccess(result)).toBe(true);

    // Verify payment repo was called
    expect(mockPaymentRepo.create).toHaveBeenCalledTimes(1);
    const recordedPayment = vi.mocked(mockPaymentRepo.create).mock.calls[0][0];
    expect(recordedPayment.invoiceId).toBe(INVOICE_ID);
    expect(recordedPayment.tenantId).toBe(TENANT_ID);
    expect(recordedPayment.clientId).toBe(CLIENT_ID);
    expect(recordedPayment.amount).toBe(150.00);
    expect(recordedPayment.status).toBe('PENDING');
    expect(recordedPayment.method).toBe(PaymentMethod.PIX);
  });

  it('should NOT create a Payment record when invoice is already paid', async () => {
    const paidInvoice: Invoice = { ...mockInvoice, status: InvoiceStatus.PAID };
    vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(paidInvoice);

    await processPayment.execute(validProcessPaymentInput);

    expect(mockPaymentGateway.createPixCharge).not.toHaveBeenCalled();
    expect(mockPaymentRepo.create).not.toHaveBeenCalled();
  });

  it('should NOT create a Payment record when payment provider fails', async () => {
    vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
    vi.mocked(mockPaymentGateway.createPixCharge).mockRejectedValue(new Error('Provider down'));

    await processPayment.execute(validProcessPaymentInput);

    expect(mockPaymentRepo.create).not.toHaveBeenCalled();
  });
});

describe('ProcessPaymentWebhookUseCase — Payment Recording', () => {
  let processWebhook: ProcessPaymentWebhookUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    processWebhook = new ProcessPaymentWebhookUseCase(
      mockVerifier,
      mockParser,
      mockInvoiceRepo,
      mockPaymentRepo,
      mockEventBus,
    );
  });

  it('should create a CONFIRMED Payment record when webhook confirms payment', async () => {
    vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
    vi.mocked(mockParser.parse).mockReturnValue(confirmedWebhookData);
    vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
    vi.mocked(mockInvoiceRepo.update).mockImplementation(async (inv) => inv);
    vi.mocked(mockPaymentRepo.create).mockImplementation(async (payment) => payment);

    const result = await processWebhook.execute(validWebhookInput);

    expect(isSuccess(result)).toBe(true);

    // Verify payment repo was called
    expect(mockPaymentRepo.create).toHaveBeenCalledTimes(1);
    const recordedPayment = vi.mocked(mockPaymentRepo.create).mock.calls[0][0];
    expect(recordedPayment.invoiceId).toBe(INVOICE_ID);
    expect(recordedPayment.tenantId).toBe(TENANT_ID);
    expect(recordedPayment.clientId).toBe(CLIENT_ID);
    expect(recordedPayment.amount).toBe(150.00);
    expect(recordedPayment.status).toBe('CONFIRMED');
    expect(recordedPayment.providerPaymentId).toBe(PROVIDER_PAYMENT_ID);
  });

  it('should NOT create a Payment record when invoice is already paid', async () => {
    const paidInvoice: Invoice = { ...mockInvoice, status: InvoiceStatus.PAID };
    vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
    vi.mocked(mockParser.parse).mockReturnValue(confirmedWebhookData);
    vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(paidInvoice);

    const result = await processWebhook.execute(validWebhookInput);

    expect(isSuccess(result)).toBe(true);
    expect(mockPaymentRepo.create).not.toHaveBeenCalled();
    expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
  });

  it('should NOT create a Payment record when webhook signature is invalid', async () => {
    vi.mocked(mockVerifier.verify).mockResolvedValue(success(false));

    await processWebhook.execute(validWebhookInput);

    expect(mockPaymentRepo.create).not.toHaveBeenCalled();
    expect(mockInvoiceRepo.findById).not.toHaveBeenCalled();
  });

  it('should NOT create a Payment record when parser returns null (unknown event)', async () => {
    vi.mocked(mockVerifier.verify).mockResolvedValue(success(true));
    vi.mocked(mockParser.parse).mockReturnValue(null);

    await processWebhook.execute(validWebhookInput);

    expect(mockPaymentRepo.create).not.toHaveBeenCalled();
    expect(mockInvoiceRepo.findById).not.toHaveBeenCalled();
  });
});
