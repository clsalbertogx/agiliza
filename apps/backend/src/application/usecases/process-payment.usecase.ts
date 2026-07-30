import { Either, success, failure } from '@/application/types/either';
import { ApplicationError } from '@/application/errors/application.error';
import { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { PaymentGatewayPort } from '@/application/ports/payment-gateway.port';
import { updateInvoice, InvoiceStatus, PaymentMethod } from '@/domain/entities/invoice';

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
    private readonly clientRepo: ClientRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly eventBus: EventBusPort,
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

    // 3. Create PIX charge via payment provider
    let pixCharge;
    try {
      pixCharge = await this.paymentGateway.createPixCharge({
        amount: Number(invoice.amount),
        description: invoice.description || `Invoice ${invoice.id}`,
        externalReference: invoice.id,
      });
    } catch (error: any) {
      return failure(new ApplicationError(
        'Payment provider error: ' + (error.message || 'Unknown error'),
        'PAYMENT_PROVIDER_ERROR',
        502,
      ));
    }

    // 4. Update invoice with PIX data
    const updatedInvoice = updateInvoice(invoice, {
      paymentMethod: PaymentMethod.PIX,
      pixQRCode: pixCharge.qrCode,
      pixCopyPaste: pixCharge.copyPaste,
      pixExpiresAt: pixCharge.expiresAt,
    });
    await this.invoiceRepo.update(updatedInvoice);

    // 5. Return PIX data
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
