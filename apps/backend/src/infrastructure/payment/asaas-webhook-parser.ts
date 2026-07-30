import { PaymentWebhookParserPort, PaymentWebhookData } from '@/application/ports/gateways/payment-webhook-parser.port';

export class AsaasWebhookParser implements PaymentWebhookParserPort {
  parse(provider: string, payload: Record<string, unknown>): PaymentWebhookData | null {
    if (provider !== 'asaas') {
      return null;
    }

    const event = payload.event as string | undefined;
    const payment = payload.payment as Record<string, unknown> | undefined;

    if (!payment) {
      return null;
    }

    const providerPaymentId = payment.id as string;
    if (!providerPaymentId) {
      return null;
    }

    const invoiceId = (payment.externalReference as string) || undefined;

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      return {
        providerPaymentId,
        status: 'confirmed',
        invoiceId,
        amount: payment.value ? Number(payment.value) : undefined,
        paidAt: payment.confirmedDate ? new Date(payment.confirmedDate as string) : new Date(),
        rawPayload: payload,
      };
    }

    if (event === 'PAYMENT_FAILED') {
      return {
        providerPaymentId,
        status: 'failed',
        invoiceId,
        rawPayload: payload,
      };
    }

    if (event === 'PAYMENT_REFUNDED') {
      return {
        providerPaymentId,
        status: 'refunded',
        invoiceId,
        amount: payment.value ? Number(payment.value) : undefined,
        rawPayload: payload,
      };
    }

    return null;
  }
}
