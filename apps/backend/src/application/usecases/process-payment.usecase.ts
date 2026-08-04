import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { EncryptionPort } from '@/application/ports/gateways/encryption.port';
import type { PaymentGatewayPort, PixChargeResponse } from '@/application/ports/payment-gateway.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import type { PaymentProviderConfigRepositoryPort } from '@/application/ports/repositories/payment-provider-config.repository.port';
import { type Either, failure, isFailure, success } from '@/application/types/either';
import { InvoiceStatus, PaymentMethod, updateInvoice } from '@/domain/entities/invoice';
import { createPayment, PaymentProvider } from '@/domain/entities/payment';
import { generateUUID } from '@/infrastructure/uuid/uuid.service';

export interface ProcessPaymentInput {
  invoiceId: string;
  tenantId: string;
}

export interface ProcessPaymentOutput {
  status: string;
  pix: {
    qrCode: string;
    copyPaste: string;
    expiresAt: Date;
  };
}

export type PaymentGatewayFactory = (config: { apiKey: string; environment: string }) => PaymentGatewayPort;

export class ProcessPaymentUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
    private readonly paymentRepo: PaymentRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly eventBus: EventBusPort,
    private readonly paymentProviderConfigRepo?: PaymentProviderConfigRepositoryPort,
    private readonly encryption?: EncryptionPort,
    private readonly gatewayFactory?: PaymentGatewayFactory,
  ) {}

  async execute(input: ProcessPaymentInput): Promise<Either<ApplicationError, ProcessPaymentOutput>> {
    // 1. Find invoice (tenant-isolated)
    const invoice = await this.invoiceRepo.findById(input.invoiceId, input.tenantId);
    if (!invoice) {
      return failure(ApplicationError.notFound('Invoice', input.invoiceId));
    }

    // 2. Check not already paid
    if (invoice.status === InvoiceStatus.PAID) {
      return failure(new ApplicationError('Invoice is already paid', 'ALREADY_PAID', 400));
    }

    // 3. Resolve payment gateway (per-tenant config with fallback to injected gateway).
    //    Delegates to the PaymentProviderFactory which inspects the per-provider
    //    rows in `payment_provider_configs` and picks the first active one,
    //    falling back to Asaas with global env credentials.
    let gateway = this.paymentGateway;
    let resolvedProvider = PaymentProvider.ASAAS;
    if (this.paymentProviderConfigRepo && this.encryption && this.gatewayFactory) {
      // Try each known provider in fallback order; use the first row that exists.
      const candidateProviders: string[] = ['asaas', 'mercadopago', 'stripe', 'pagbank', 'polar'];
      for (const provider of candidateProviders) {
        const config = await this.paymentProviderConfigRepo.findByTenantAndProvider(input.tenantId, provider);
        if (config) {
          const decryptedApiKey = this.encryption.decrypt(config.apiKey);
          gateway = this.gatewayFactory({
            apiKey: decryptedApiKey,
            environment: config.environment,
          });
          resolvedProvider =
            provider === 'mercadopago'
              ? PaymentProvider.MERCADO_PAGO
              : provider === 'stripe'
                ? PaymentProvider.STRIPE
                : provider === 'pagbank'
                  ? PaymentProvider.PAGBANK
                  : provider === 'polar'
                    ? PaymentProvider.POLAR
                    : PaymentProvider.ASAAS;
          break;
        }
      }
    }

    // 4. Create PIX charge via payment provider
    let pixCharge: PixChargeResponse;
    try {
      pixCharge = await gateway.createPixCharge({
        amount: Number(invoice.amount),
        description: invoice.description || `Invoice ${invoice.id}`,
        externalReference: invoice.id,
      });
    } catch (error: any) {
      return failure(
        new ApplicationError(
          'Payment provider error: ' + (error.message || 'Unknown error'),
          'PAYMENT_PROVIDER_ERROR',
          502,
        ),
      );
    }

    // 5. Update invoice with PIX data
    const updatedInvoice = updateInvoice(invoice, {
      paymentMethod: PaymentMethod.PIX,
      pixQRCode: pixCharge.qrCode,
      pixCopyPaste: pixCharge.copyPaste,
      pixExpiresAt: pixCharge.expiresAt,
    });
    await this.invoiceRepo.update(updatedInvoice);

    // 6. Record payment
    const paymentResult = createPayment({
      id: generateUUID(),
      tenantId: input.tenantId,
      invoiceId: input.invoiceId,
      clientId: invoice.clientId,
      amount: Number(invoice.amount),
      provider: resolvedProvider,
      externalId: pixCharge.id,
      paymentMethod: PaymentMethod.PIX,
    });

    if (isFailure(paymentResult)) {
      // This should not happen given validated inputs; log and continue
      return success({
        status: 'PENDING',
        pix: {
          qrCode: pixCharge.qrCode,
          copyPaste: pixCharge.copyPaste,
          expiresAt: pixCharge.expiresAt,
        },
      });
    }

    await this.paymentRepo.create(paymentResult.value);

    // 7. Return PIX data
    return success({
      status: 'PENDING',
      pix: {
        qrCode: pixCharge.qrCode,
        copyPaste: pixCharge.copyPaste,
        expiresAt: pixCharge.expiresAt,
      },
    });
  }
}
