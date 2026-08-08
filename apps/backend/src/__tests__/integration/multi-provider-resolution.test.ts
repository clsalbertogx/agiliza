import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F2(c) — Integration through the REAL factory (`createProcessPaymentUseCase`),
 * which is the live path used by POST /api/invoices/:id/pay and the auto-pay
 * handler. A tenant configured with Mercado Pago must end up charged via the MP
 * gateway and have `provider = 'mercadopago'` persisted — not Asaas.
 *
 * The Prisma client is mocked at the model level (invoice/payment/config).
 * The Mercado Pago GATEWAY module is mocked only at its SDK boundary: the real
 * `MercadoPagoGateway` class is subclassed with a fake `sdkFactory` (the same
 * injection point used by `mercadopago.gateway.test.ts`), so the gateway's
 * lazy `require('mercadopago')` never loads the real SDK and no network call
 * happens. The fake SDK returns the same wire shape the real SDK produces.
 */
const mockState = vi.hoisted(() => ({
  invoiceFindFirst: vi.fn(),
  invoiceUpdate: vi.fn(),
  paymentCreate: vi.fn(),
  configFindUnique: vi.fn(),
  mpSdkCreate: vi.fn(),
  mpSdkGet: vi.fn(),
  mpSdkCancel: vi.fn(),
}));

vi.mock('@/infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => ({
    invoice: {
      findFirst: mockState.invoiceFindFirst,
      findMany: vi.fn(),
      update: mockState.invoiceUpdate,
      create: vi.fn(),
      count: vi.fn(),
    },
    payment: {
      create: mockState.paymentCreate,
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    paymentProviderConfig: {
      findUnique: mockState.configFindUnique,
      upsert: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  })),
}));

// vi.mock('mercadopago', ...) does NOT intercept the gateway's lazy
// `require('mercadopago')` (native CJS outside Vitest's ESM module graph), so
// the real SDK was reached and attempted a real API call. Mock the gateway
// module instead and swap only the SDK boundary via the real sdkFactory hook.
vi.mock('@/infrastructure/payment/mercadopago.gateway', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/payment/mercadopago.gateway')>();

  // Shape of the real SDK at the gateway boundary (see MercadoPagoSdk).
  const fakeSdk = () => ({
    MercadoPagoConfig: class {
      constructor() {}
    },
    Payment: class {
      create = mockState.mpSdkCreate;
      get = mockState.mpSdkGet;
      cancel = mockState.mpSdkCancel;
    },
  });

  // Real gateway class/logic; only the SDK dependency is swapped.
  class FakeMercadoPagoGateway extends actual.MercadoPagoGateway {
    constructor(options: any) {
      super({ ...options, sdkFactory: fakeSdk });
    }
  }

  return { ...actual, MercadoPagoGateway: FakeMercadoPagoGateway };
});

import { createProcessPaymentUseCase } from '@/presentation/factories/create-process-payment.factory';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const INVOICE_ID = '00000000-0000-0000-0000-000000000003';

const pendingInvoice = {
  id: INVOICE_ID,
  tenantId: TENANT_ID,
  clientId: CLIENT_ID,
  amount: 150.0,
  dueDate: new Date('2026-08-15'),
  description: 'Integration MP invoice',
  status: 'PENDING',
  paymentMethod: null,
  pixQRCode: null,
  pixCopyPaste: null,
  pixExpiresAt: null,
  externalPaymentId: null,
  paidAt: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('F2(c) — multi-provider payment path (factory → resolver → gateway)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Tenant has a Mercado Pago config row; no Asaas config.
    mockState.configFindUnique.mockImplementation(
      async ({ where }: { where: { tenantId_provider: { tenantId: string; provider: string } } }) => {
        if (where.tenantId_provider.provider === 'mercadopago') {
          return {
            tenantId: TENANT_ID,
            provider: 'mercadopago',
            apiKeyEncrypted: 'mp-test-access-token',
            environment: 'sandbox',
          };
        }
        return null;
      },
    );
    mockState.invoiceFindFirst.mockResolvedValue(pendingInvoice);
    mockState.invoiceUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...pendingInvoice,
      ...data,
    }));
    mockState.paymentCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...(args.data ?? args),
    }));
    // What the real MercadoPago SDK would return for a PIX charge.
    mockState.mpSdkCreate.mockImplementation(async () => ({
      id: 'mp-pix-001',
      status: 'pending',
      point_of_interaction: {
        transaction_data: {
          qr_code_base64: 'data:image/png;base64,test-mp-qr',
          qr_code: '00020126580014BR.GOV.BCB.PIX0136mp',
        },
      },
    }));
  });

  it('charges a Mercado Pago tenant via the MP gateway and persists provider = mercadopago', async () => {
    const useCase = createProcessPaymentUseCase();
    const result = await useCase.execute({ invoiceId: INVOICE_ID, tenantId: TENANT_ID });

    expect(result.success).toBe(true);
    // The charge actually went through the (fake) MP SDK — gateway path is
    // MercadoPago, not the Asaas fallback.
    expect(mockState.mpSdkCreate).toHaveBeenCalledTimes(1);
    expect(mockState.paymentCreate).toHaveBeenCalledTimes(1);

    const persisted = mockState.paymentCreate.mock.calls[0][0] as { data: { provider: string } };
    expect(persisted.data.provider).toBe('mercadopago');
  });
});
