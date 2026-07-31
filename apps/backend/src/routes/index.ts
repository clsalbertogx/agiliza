import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.routes';
import { clientRoutes } from './client.routes';
import { invoiceRoutes } from './invoice.routes';
import { decisionRoutes } from './decision.routes';
import { webhookRoutes } from './webhook.routes';
import { tenantRoutes } from './tenant.routes';
import { reminderRoutes } from './reminder.routes';
import { onboardingRoutes } from './onboarding.routes';
import { reportRoutes } from './report.routes';
import { subscriptionRoutes } from './subscription.routes';

export async function registerRoutes(app: FastifyInstance) {
  await healthRoutes(app);
  await tenantRoutes(app);
  await clientRoutes(app);
  await invoiceRoutes(app);
  await decisionRoutes(app);
  await reminderRoutes(app);
  await onboardingRoutes(app);
  await reportRoutes(app);
  await webhookRoutes(app);
  await subscriptionRoutes(app);
}
