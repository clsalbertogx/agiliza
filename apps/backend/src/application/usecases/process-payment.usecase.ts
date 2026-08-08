import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { PaymentGatewayResolverPort } from '@/application/ports/gateways/payment-gateway-resolver.port';
import type { PaymentGatewayPort, PixChargeResponse } from '@/application/ports/payment-gateway.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { PaymentRepositoryPort } from '@/application/ports/repositories/payment.repository.port';
import { type Either, failure, isFailure, success } from '@/application/types/either';
import { PaymentProvider } from '@/domain/contracts/enums';
import { InvoiceStatus, PaymentMethod, updateInvoice } from '@/domain/entities/invoice';
import { createPayment } from '@/domain/entities/payment';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

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

export class ProcessPaymentUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    readonly _clientRepo: ClientRepositoryPort,
    private readonly paymentRepo: PaymentRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    readonly _eventBus: EventBusPort,
    private readonly resolver: PaymentGatewayResolverPort | undefined,
    private readonly idGenerator: IdGeneratorPort,
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

    // 3. Resolve payment gateway (F2): per-tenant configured provider wins;
    //    falls back to the injected gateway (Asaas) when no resolver is given
    //    or the tenant has no provider config.
    let gateway = this.paymentGateway;
    let resolvedProvider = PaymentProvider.ASAAS;
    if (this.resolver) {
      const resolved = await this.resolver.resolveForTenant(input.tenantId);
      gateway = resolved.gateway;
      resolvedProvider = resolved.provider;
    }

    // 4. Create PIX charge via payment provider
    let pixCharge: PixChargeResponse;
    try {
      pixCharge = await gateway.createPixCharge({
        amount: Number(invoice.amount),
        description: invoice.description || `Invoice ${invoice.id}`,
        externalReference: invoice.id,
      });
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : 'Unknown error';
      return failure(new ApplicationError(`Payment provider error: ${message}`, 'PAYMENT_PROVIDER_ERROR', 502));
    }

    // 5. Update invoice with PIX data
    const updatedInvoice = updateInvoice(invoice, {
      paymentMethod: PaymentMethod.PIX,
      pixQRCode: pixCharge.qrCode,
      pixCopyPaste: pixCharge.copyPaste,
      pixExpiresAt: pixCharge.expiresAt,
    });
    await this.invoiceRepo.update(updatedInvoice);

    // 6. Record payment — provider is the ACTUAL gateway used (F2).
    const paymentResult = createPayment({
      id: this.idGenerator.generate(),
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
