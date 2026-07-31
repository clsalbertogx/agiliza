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

  // Handlers
  const sendReceipt = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider);
  const updateRisk = new UpdateRiskScoreHandler(clientRepo, invoiceRepo, riskCalculator);
  const notifyOutbound = new NotifyOutboundHandler(
    env.OUTBOUND_WEBHOOK_URL,
    env.OUTBOUND_WEBHOOK_API_KEY,
  );
  const autoPay = new AutoPayHandler(processPayment, renewSubscription);

  // Subscribe handlers to events
  eventBus.subscribe('payment.confirmed', (e) => sendReceipt.handle(e));
  eventBus.subscribe('payment.confirmed', (e) => updateRisk.handle(e));
  eventBus.subscribe('payment.failed', (e) => updateRisk.handle(e));
  eventBus.subscribe('invoice.overdue', (e) => updateRisk.handle(e));
  eventBus.subscribe('message.read', (e) => updateRisk.handle(e));
  eventBus.subscribe('message.clicked', (e) => updateRisk.handle(e));
  eventBus.subscribe('client.created', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('payment.confirmed', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('invoice.overdue', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('decision.made', (e) => notifyOutbound.handle(e));
  eventBus.subscribe('subscription.invoice.created', (e) => autoPay.handle(e));
}
