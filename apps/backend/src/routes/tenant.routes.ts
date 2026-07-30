import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createTenantRepository, testPaymentProviderConnection } from '../presentation/factories';

const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  document: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
});

const updateTenantSchema = createTenantSchema.partial();

const paymentProviderSchema = z.object({
  provider: z.enum(['asaas', 'mercadopago', 'pagbank', 'polar']),
  apiKey: z.string().min(1, 'API key is required'),
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
});

const decisionConfigSchema = z.object({
  defaultChannel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']).optional(),
  sendReminders: z.boolean().optional(),
  leadDays: z.number().int().min(1).max(14).optional(),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekendReminders: z.boolean().optional(),
  maxRemindersPerCycle: z.number().int().min(1).max(10).optional(),
});

const tenantRepo = createTenantRepository();

export async function tenantRoutes(app: FastifyInstance) {
  // POST /api/tenants — Create tenant
  app.post('/api/tenants', async (request, reply) => {
    const parsed = createTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    // Check slug uniqueness
    const existing = await tenantRepo.findBySlug(parsed.data.slug);
    if (existing) {
      reply.code(409);
      return { error: 'Slug already in use' };
    }

    const tenant = await tenantRepo.create({
      id: crypto.randomUUID(),
      ...parsed.data,
      paymentProvider: 'asaas',
      paymentProviderConfig: {},
      decisionConfig: {
        defaultChannel: 'WHATSAPP',
        sendReminders: true,
        leadDays: 3,
        businessHoursStart: '08:00',
        businessHoursEnd: '20:00',
        weekendReminders: false,
        maxRemindersPerCycle: 3,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    reply.code(201);
    return { data: tenant };
  });

  // GET /api/tenants — List tenants
  app.get('/api/tenants', async (request) => {
    const query = request.query as any;
    const page = Math.max(1, parseInt(query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(query.perPage) || 10));
    const skip = (page - 1) * perPage;

    const [data, total] = await Promise.all([
      tenantRepo.findMany({ page, limit: perPage, search: query.search }),
      tenantRepo.count(),
    ]);

    return {
      data,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  });

  // GET /api/tenants/:id — Get tenant
  app.get('/api/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenant = await tenantRepo.findById(id);

    if (!tenant) {
      reply.code(404);
      return { error: 'Tenant not found' };
    }

    return { data: tenant };
  });

  // PATCH /api/tenants/:id — Update tenant
  app.patch('/api/tenants/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existing = await tenantRepo.findById(id);
    if (!existing) {
      reply.code(404);
      return { error: 'Tenant not found' };
    }

    const parsed = updateTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const updated = await tenantRepo.update({
      ...existing,
      ...parsed.data,
    } as any);
    return { data: updated };
  });

  // GET /api/tenants/:id/config — Get tenant configuration
  app.get('/api/tenants/:id/config', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenant = await tenantRepo.findById(id);

    if (!tenant) {
      reply.code(404);
      return { error: 'Tenant not found' };
    }

    return {
      data: {
        config: tenant.config,
        decisionConfig: tenant.decisionConfig,
        paymentProvider: tenant.paymentProvider,
      },
    };
  });

  // PATCH /api/tenants/:id/config — Update tenant general config
  app.patch('/api/tenants/:id/config', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existing = await tenantRepo.findById(id);
    if (!existing) {
      reply.code(404);
      return { error: 'Tenant not found' };
    }

    const updated = await tenantRepo.updateConfig(id, request.body);
    return { data: updated };
  });

  // GET /api/tenants/:id/payment-provider — Get payment provider config
  app.get('/api/tenants/:id/payment-provider', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenant = await tenantRepo.findById(id);

    if (!tenant) {
      reply.code(404);
      return { error: 'Tenant not found' };
    }

    return {
      data: {
        provider: tenant.paymentProvider,
        // Don't expose the full API key
        hasApiKey: !!(tenant.paymentProviderConfig as any)?.apiKey,
        environment: (tenant.paymentProviderConfig as any)?.environment || 'sandbox',
      },
    };
  });

  // PUT /api/tenants/:id/payment-provider — Set payment provider
  app.put('/api/tenants/:id/payment-provider', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existing = await tenantRepo.findById(id);
    if (!existing) {
      reply.code(404);
      return { error: 'Tenant not found' };
    }

    const parsed = paymentProviderSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    // Test connection before saving
    const testResult = testPaymentProviderConnection({
      type: parsed.data.provider,
      apiKey: parsed.data.apiKey,
      environment: parsed.data.environment,
    });

    if (!testResult.success) {
      console.warn('Provider connection test warning:', testResult.error);
    }

    const updated = await tenantRepo.updatePaymentProvider(id, parsed.data.provider, {
      apiKey: parsed.data.apiKey,
      environment: parsed.data.environment,
    });

    return { data: updated };
  });

  // GET /api/tenants/:id/decision-config — Get decision config
  app.get('/api/tenants/:id/decision-config', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenant = await tenantRepo.findById(id);

    if (!tenant) {
      reply.code(404);
      return { error: 'Tenant not found' };
    }

    return { data: tenant.decisionConfig };
  });

  // PUT /api/tenants/:id/decision-config — Update decision config
  app.put('/api/tenants/:id/decision-config', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existing = await tenantRepo.findById(id);
    if (!existing) {
      reply.code(404);
      return { error: 'Tenant not found' };
    }

    const parsed = decisionConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    // Merge with existing config
    const mergedConfig = {
      ...(existing.decisionConfig as object || {}),
      ...parsed.data,
    };

    const updated = await tenantRepo.updateDecisionConfig(id, mergedConfig);
    return { data: updated };
  });
}
