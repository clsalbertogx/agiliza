import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { logger } from '@/config/logger';
import type { PaymentProvider } from '@/domain/entities/tenant';
import { createToken } from '@/infrastructure/auth';
import {
  createGetPaymentProviderConfigUseCase,
  createIdGenerator,
  createTenantRepository,
  createUpsertPaymentProviderConfigUseCase,
  testPaymentProviderConnection,
} from '@/presentation/factories';

const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
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
  businessHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  businessHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  weekendReminders: z.boolean().optional(),
  maxRemindersPerCycle: z.number().int().min(1).max(10).optional(),
});

const tenantRepo = createTenantRepository();

// ── Tenant-scope guards ─────────────────────────────────────────────
// a1: every /:id route must only act on the authenticated tenant's own
// record — returning 403 on a mismatched id (never reading tenant B).
// E3: config mutations additionally require the 'owner' role. Only 'owner'
// tokens are issued today (signup); multi-role RBAC is future work — this
// guard means "authenticated + own tenant" is sufficient for now.
function isOwnTenant(request: FastifyRequest, id: string): boolean {
  return request.tenantId === id;
}

function isOwner(request: FastifyRequest): boolean {
  return request.authPayload?.role === 'owner';
}

// Pass-through response envelopes for OpenAPI (see client.routes.ts).
const dataEnvelope = {
  type: 'object',
  properties: {
    data: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
};

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const createTenantBodySchema = {
  type: 'object',
  required: ['name', 'slug', 'email'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    slug: { type: 'string', minLength: 3, maxLength: 100, pattern: '^[a-z0-9-]+$' },
    document: { type: 'string' },
    email: { type: 'string', format: 'email' },
    phone: { type: 'string' },
  },
} as const;

const paymentProviderBodySchema = {
  type: 'object',
  required: ['provider', 'apiKey'],
  properties: {
    provider: { type: 'string', enum: ['asaas', 'mercadopago', 'pagbank', 'polar'] },
    apiKey: { type: 'string', minLength: 1 },
    environment: { type: 'string', enum: ['sandbox', 'production'] },
  },
} as const;

const decisionConfigBodySchema = {
  type: 'object',
  properties: {
    defaultChannel: { type: 'string', enum: ['WHATSAPP', 'EMAIL', 'SMS'] },
    sendReminders: { type: 'boolean' },
    leadDays: { type: 'integer', minimum: 1, maximum: 14 },
    businessHoursStart: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
    businessHoursEnd: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
    weekendReminders: { type: 'boolean' },
    maxRemindersPerCycle: { type: 'integer', minimum: 1, maximum: 10 },
  },
} as const;

export async function tenantRoutes(app: FastifyInstance) {
  // POST /api/tenants — Create tenant (public signup). Stricter per-IP rate
  // limit than the global one: this endpoint is unauthenticated by design.
  app.post(
    '/api/tenants',
    {
      config: {
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
      schema: {
        tags: ['Tenants'],
        summary: 'Create a new tenant',
        description: 'Público — signup sem autenticação',
        security: [],
        body: createTenantBodySchema,
        response: {
          201: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
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
        id: createIdGenerator().generate(),
        ...parsed.data,
        paymentProvider: 'asaas' as PaymentProvider,
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
      });

      const token = createToken(
        { tenantId: tenant.id, userId: 'owner', role: 'owner' },
        // JWT_SECRET comes from the environment (validated in config/env.ts).
        // No hardcoded fallback — see auth.plugin.ts.
        process.env.JWT_SECRET ?? '',
      );

      reply.code(201);
      return { data: { tenant }, token };
    },
  );

  // GET /api/tenants — List tenants
  // REMOVED (security): it returned every tenant's full record (document,
  // email, phone, paymentProviderConfig, decisionConfig) to any signed-in
  // tenant. The frontend never used it, so the route is gone rather than
  // role-gated. A tenant-scoped equivalent can be reintroduced if needed.

  // GET /api/tenants/:id — Get tenant
  app.get(
    '/api/tenants/:id',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Get a tenant by ID',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isOwnTenant(request, id)) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      const tenant = await tenantRepo.findById(id);

      if (!tenant) {
        reply.code(404);
        return { error: 'Tenant not found' };
      }

      return { data: tenant };
    },
  );

  // PATCH /api/tenants/:id — Update tenant
  app.patch(
    '/api/tenants/:id',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Update a tenant',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            slug: { type: 'string', minLength: 3, maxLength: 100, pattern: '^[a-z0-9-]+$' },
            document: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
          },
        },
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isOwnTenant(request, id)) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

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
      });
      return { data: updated };
    },
  );

  // GET /api/tenants/:id/config — Get tenant configuration
  app.get(
    '/api/tenants/:id/config',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Get tenant configuration',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isOwnTenant(request, id)) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

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
    },
  );

  // PATCH /api/tenants/:id/config — Update tenant general config.
  // No body schema on purpose: config is an arbitrary JSON blob and a schema
  // would strip unknown keys (Fastify ajv removeAdditional).
  app.patch(
    '/api/tenants/:id/config',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Update tenant configuration',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isOwnTenant(request, id) || !isOwner(request)) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      const existing = await tenantRepo.findById(id);
      if (!existing) {
        reply.code(404);
        return { error: 'Tenant not found' };
      }

      const updated = await tenantRepo.updateConfig(id, request.body as Record<string, unknown>);
      return { data: updated };
    },
  );

  // GET /api/tenants/:id/payment-provider — Get payment provider config
  app.get(
    '/api/tenants/:id/payment-provider',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Get payment provider configuration',
        description: 'Returns the configuration for the tenant payment provider.',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isOwnTenant(request, id)) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      // Check tenant exists
      const tenant = await tenantRepo.findById(id);
      if (!tenant) {
        reply.code(404);
        return { error: 'Tenant not found' };
      }

      const getConfig = createGetPaymentProviderConfigUseCase();
      const config = await getConfig.execute(id, tenant.paymentProvider);

      if (config.success && config.value) {
        return {
          data: {
            provider: tenant.paymentProvider,
            hasApiKey: true,
            environment: config.value.environment,
          },
        };
      }

      return {
        data: {
          provider: tenant.paymentProvider,
          hasApiKey: false,
          environment: 'sandbox',
        },
      };
    },
  );

  // PUT /api/tenants/:id/payment-provider — Set payment provider
  app.put(
    '/api/tenants/:id/payment-provider',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Set payment provider credentials',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: paymentProviderBodySchema,
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isOwnTenant(request, id) || !isOwner(request)) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

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
        type: parsed.data.provider as PaymentProvider,
        apiKey: parsed.data.apiKey,
        environment: parsed.data.environment,
      });

      if (!testResult.success) {
        logger.warn({ error: testResult.error }, 'Provider connection test warning');
      }

      // Use the upsert use case to encrypt and persist
      const upsertConfig = createUpsertPaymentProviderConfigUseCase();
      const result = await upsertConfig.execute({
        tenantId: id,
        provider: parsed.data.provider,
        apiKey: parsed.data.apiKey,
        environment: parsed.data.environment,
      });

      if (!result.success) {
        reply.code(500);
        return { error: 'Failed to save payment provider configuration' };
      }

      // Also update the tenant's default payment provider
      const updated = await tenantRepo.updatePaymentProvider(id, parsed.data.provider, {
        apiKey: '***ENCRYPTED***',
        environment: parsed.data.environment,
      });

      return { data: updated };
    },
  );

  // GET /api/tenants/:id/decision-config — Get decision config
  app.get(
    '/api/tenants/:id/decision-config',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Get decision engine configuration',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isOwnTenant(request, id)) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

      const tenant = await tenantRepo.findById(id);

      if (!tenant) {
        reply.code(404);
        return { error: 'Tenant not found' };
      }

      return { data: tenant.decisionConfig };
    },
  );

  // PUT /api/tenants/:id/decision-config — Update decision config
  app.put(
    '/api/tenants/:id/decision-config',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Update decision engine configuration',
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        body: decisionConfigBodySchema,
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isOwnTenant(request, id) || !isOwner(request)) {
        reply.code(403);
        return { error: 'Forbidden' };
      }

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
        ...((existing.decisionConfig as object) || {}),
        ...parsed.data,
      };

      const updated = await tenantRepo.updateDecisionConfig(id, mergedConfig);
      return { data: updated };
    },
  );
}
