import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { PaymentGatewayResolverPort } from '@/application/ports/gateways/payment-gateway-resolver.port';
import type { PaymentGatewayPort, PixChargeResponse } from '@/application/ports/payment-gateway.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { isSuccess } from '@/application/types/either';
import { type ProcessPaymentInput, ProcessPaymentUseCase } from '@/application/usecases/process-payment.usecase';
import { type Invoice, InvoiceStatus } from '@/domain/entities/invoice';

function makeGateway(provider: string) {
  const gateway: PaymentGatewayPort = {
    createPixCharge: vi.fn(),
    createCreditCardCharge: vi.fn(),
    createBoletoCharge: vi.fn(),
    getCharge: vi.fn(),
    cancelCharge: vi.fn(),
    verifyWebhook: vi.fn(),
    handleWebhook: vi.fn(),
  };
  (gateway as unknown as { provider: string }).provider = provider;
  return gateway;
}

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

const mockEventBus: EventBusPort = {
  publish: vi.fn(),
  subscribe: vi.fn(),
};

const mockIdGenerator = {
  generate: () => '00000000-0000-0000-0000-000000000099',
  validate: () => true,
};

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const INVOICE_ID = '00000000-0000-0000-0000-000000000003';

const validInput: ProcessPaymentInput = { invoiceId: INVOICE_ID, tenantId: TENANT_ID };

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
  id: 'pix-charge-mp',
  qrCode: 'data:image/png;base64,test-qr-code',
  copyPaste: '00020126580014BR.GOV.BCB.PIX0136test',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  status: 'PENDING',
};

/**
 * F2 — Multi-provider resolution. A tenant configured with Mercado Pago must
 * be charged via the Mercado Pago gateway (resolved per-tenant), NOT the
 * hardcoded Asaas fallback. And the persisted Payment.provider must be the
 * ACTUAL gateway that was used.
 */
describe('ProcessPaymentUseCase — per-tenant gateway resolution (F2)', () => {
  let asaasGateway: PaymentGatewayPort;
  let mpGateway: PaymentGatewayPort;

  beforeEach(() => {
    vi.clearAllMocks();
    asaasGateway = makeGateway('asaas');
    mpGateway = makeGateway('mercadopago');
    vi.mocked(mockInvoiceRepo.findById).mockResolvedValue(mockInvoice);
    vi.mocked(mockInvoiceRepo.update).mockImplementation(async (invoice: Invoice) => invoice);
    vi.mocked(mpGateway.createPixCharge).mockResolvedValue(mockPixCharge);
    vi.mocked(mockPaymentRepo.create).mockImplementation(async (payment) => payment);
  });

  it('uses the resolved Mercado Pago gateway for a tenant configured with MP (not Asaas)', async () => {
    const resolver: PaymentGatewayResolverPort = {
      resolveForTenant: vi.fn().mockResolvedValue({ gateway: mpGateway, provider: 'mercadopago' }),
      resolveForTenantAndProvider: vi.fn(),
    };

    const useCase = new ProcessPaymentUseCase(
      mockInvoiceRepo,
      mockClientRepo,
      mockPaymentRepo,
      asaasGateway,
      mockEventBus,
      resolver,
      mockIdGenerator,
    );

    const result = await useCase.execute(validInput);

    expect(isSuccess(result)).toBe(true);
    expect(resolver.resolveForTenant).toHaveBeenCalledWith(TENANT_ID);
    expect(mpGateway.createPixCharge).toHaveBeenCalledTimes(1);
    expect(asaasGateway.createPixCharge).not.toHaveBeenCalled();
  });

  it('persists the ACTUAL provider used (mercadopago), not a hardcoded/diverging value', async () => {
    const resolver: PaymentGatewayResolverPort = {
      resolveForTenant: vi.fn().mockResolvedValue({ gateway: mpGateway, provider: 'mercadopago' }),
      resolveForTenantAndProvider: vi.fn(),
    };

    const useCase = new ProcessPaymentUseCase(
      mockInvoiceRepo,
      mockClientRepo,
      mockPaymentRepo,
      asaasGateway,
      mockEventBus,
      resolver,
      mockIdGenerator,
    );

    const result = await useCase.execute(validInput);

    expect(isSuccess(result)).toBe(true);
    const recorded = vi.mocked(mockPaymentRepo.create).mock.calls[0][0];
    expect(recorded.provider).toBe('mercadopago');
  });

  it('keeps using the injected fallback gateway when no resolver is provided (backward compat)', async () => {
    vi.mocked(asaasGateway.createPixCharge).mockResolvedValue(mockPixCharge);

    const useCase = new ProcessPaymentUseCase(
      mockInvoiceRepo,
      mockClientRepo,
      mockPaymentRepo,
      asaasGateway,
      mockEventBus,
      undefined,
      mockIdGenerator,
    );

    const result = await useCase.execute(validInput);

    expect(isSuccess(result)).toBe(true);
    expect(asaasGateway.createPixCharge).toHaveBeenCalledTimes(1);
  });
});
