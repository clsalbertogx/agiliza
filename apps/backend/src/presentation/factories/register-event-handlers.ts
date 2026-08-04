import { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/invoice.repository';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaPaymentRepository } from '@/infrastructure/database/repositories/payment.repository';
import { PrismaSubscriptionRepository } from '@/infrastructure/database/repositories/subscription.repository';
import { AsaasPaymentProvider } from '@/infrastructure/payment/asaas.provider';
import { EvolutionMessageProvider } from '@/infrastructure/messaging/evolution/evolution-message.provider';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';
import { RiskCalculatorService } from '@/application/services/risk-calculator.service';
import { SendReceiptHandler } from '@/application/events/handlers/send-receipt.handler';
import { UpdateRiskScoreHandler } from '@/application/events/handlers/update-risk-score.handler';
import { NotifyOutboundHandler } from '@/application/events/handlers/notify-outbound.handler';
import { AutoPayHandler } from '@/application/events/handlers/auto-pay.handler';
import { ProcessPaymentUseCase } from '@/application/usecases/process-payment.usecase';
import { RenewSubscriptionUseCase } from '@/application/usecases/renew-subscription.usecase';
import { AlertOnPaymentFailedHandler } from '@/application/events/handlers/alert-on-payment-failed.handler';
import { createAlertService } from '@/presentation/factories/create-alert-service.factory';
import { BullMQDLQPublisher } from '@/infrastructure/queue/bullmq-dlq.publisher';
import { env } from '@/config/env';

export function registerEventHandlers(eventBus: EventBusPort): void {
  // Repositories
  const invoiceRepo = new PrismaInvoiceRepository();
  const clientRepo = new PrismaClientRepository();
  const paymentRepo = new PrismaPaymentRepository();
  const subscriptionRepo = new PrismaSubscriptionRepository();
  const idGenerator = new UuidV7Generator();

  // Payment provider
  const paymentProvider = new AsaasPaymentProvider({
    apiKey: env.ASAAS_API_KEY,
    environment: env.ASAAS_ENVIRONMENT,
  });

  // Messaging
  const messageProvider = new EvolutionMessageProvider({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: 'agiliza',
  });

  // Services
  const riskCalculator = new RiskCalculatorService(clientRepo, invoiceRepo);

  // Use cases
  const processPayment = new ProcessPaymentUseCase(
    invoiceRepo,
    clientRepo,
    paymentRepo,
    paymentProvider,
    eventBus,
  );
  const renewSubscription = new RenewSubscriptionUseCase(
    subscriptionRepo,
    eventBus,
    idGenerator,
  );

  // DLQ adapter — shared by all retryable handlers so failed events land
  // in the same `failed-webhooks` queue for manual inspection.
  const dlqPublisher = new BullMQDLQPublisher();

  // Alerting — notifies on critical events (payment failures, DLQ drains).
  // Silently no-ops when SLACK_WEBHOOK_URL is not configured.
  const alertService = createAlertService();
  const alertOnPaymentFailed = new AlertOnPaymentFailedHandler(alertService);

  // Handlers
  const sendReceipt = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider, dlqPublisher);
  const updateRisk = new UpdateRiskScoreHandler(clientRepo, invoiceRepo, riskCalculator, dlqPublisher);
  const notifyOutbound = new NotifyOutboundHandler(
    env.OUTBOUND_WEBHOOK_URL,
    env.OUTBOUND_WEBHOOK_API_KEY,
    dlqPublisher,
  );
  const autoPay = new AutoPayHandler(processPayment, renewSubscription, dlqPublisher);

  // Subscribe handlers to events. We wrap each `handle` call with
  // `handleWithRetry` so transient failures are retried with exponential
  // backoff and end up in the DLQ after `maxRetries`.
  eventBus.subscribe('payment.confirmed', (e) => sendReceipt.handleWithRetry(e));
  eventBus.subscribe('payment.confirmed', (e) => updateRisk.handleWithRetry(e));
  eventBus.subscribe('payment.failed', (e) => updateRisk.handleWithRetry(e));
  eventBus.subscribe('payment.failed', (e) => alertOnPaymentFailed.handle(e));
  eventBus.subscribe('invoice.overdue', (e) => updateRisk.handleWithRetry(e));
  eventBus.subscribe('message.read', (e) => updateRisk.handleWithRetry(e));
  eventBus.subscribe('message.clicked', (e) => updateRisk.handleWithRetry(e));
  eventBus.subscribe('client.created', (e) => notifyOutbound.handleWithRetry(e));
  eventBus.subscribe('payment.confirmed', (e) => notifyOutbound.handleWithRetry(e));
  eventBus.subscribe('invoice.overdue', (e) => notifyOutbound.handleWithRetry(e));
  eventBus.subscribe('decision.made', (e) => notifyOutbound.handleWithRetry(e));
  eventBus.subscribe('subscription.invoice.created', (e) => autoPay.handleWithRetry(e));
}
