import promClient from 'prom-client';

// Create a Registry
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: 'agiliza_' });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'agiliza_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestsTotal = new promClient.Counter({
  name: 'agiliza_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeSubscriptionsGauge = new promClient.Gauge({
  name: 'agiliza_active_subscriptions',
  help: 'Current number of active subscriptions',
  registers: [register],
});

export const totalInvoicesCreated = new promClient.Counter({
  name: 'agiliza_invoices_created_total',
  help: 'Total number of invoices created',
  registers: [register],
});

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export async function getMetricsContentType(): Promise<string> {
  return register.contentType;
}

export { register };
