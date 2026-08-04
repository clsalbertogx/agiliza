import type { FastifyInstance } from 'fastify';
import { clientRoutes } from './client.routes';
import { decisionRoutes } from './decision.routes';
import { healthRoutes } from './health.routes';
import { invoiceRoutes } from './invoice.routes';
import { onboardingRoutes } from './onboarding.routes';
import { reminderRoutes } from './reminder.routes';
import { reportRoutes } from './report.routes';
import { subscriptionRoutes } from './subscription.routes';
import { tenantRoutes } from './tenant.routes';
import { webhookRoutes } from './webhook.routes';

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
