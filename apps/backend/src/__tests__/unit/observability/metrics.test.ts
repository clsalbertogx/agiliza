import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import observabilityPlugin from '@/infrastructure/plugins/observability.plugin';

describe('Metrics Route', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(observabilityPlugin);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /metrics returns 200 with prometheus format', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);

    const contentType = res.headers['content-type'];
    expect(contentType).toBeDefined();
    expect(String(contentType)).toContain('text/plain');

    const body = res.body;
    // Default + custom metrics should produce non-empty body
    expect(body.length).toBeGreaterThan(0);
    // Prometheus exposition format uses # HELP / # TYPE comments
    expect(body).toContain('# HELP');
    expect(body).toContain('# TYPE');
  });

  it('GET /metrics includes default process metrics', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    const body = res.body;
    // Default Node.js metrics are prefixed with agiliza_
    expect(body).toContain('agiliza_');
    // At least one of the default metrics should be present
    expect(body).toMatch(/agiliza_(process_cpu|nodejs_eventloop|process_resident_memory)/);
  });

  it('GET /metrics includes custom http request duration histogram', async () => {
    // Trigger a request so the histogram/counter are observed at least once
    await app.inject({ method: 'GET', url: '/metrics' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    const body = res.body;

    expect(body).toContain('agiliza_http_request_duration_seconds');
    expect(body).toContain('agiliza_http_requests_total');
  });

  it('Counter and Histogram metrics are registered', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    const body = res.body;

    // Histogram TYPE line
    expect(body).toMatch(/# TYPE agiliza_http_request_duration_seconds histogram/);
    // Counter TYPE line
    expect(body).toMatch(/# TYPE agiliza_http_requests_total counter/);
  });
});
