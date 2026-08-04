import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PaymentProvider } from '@/domain/entities/tenant';
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

// Pass-through response envelopes for OpenAPI (see client.routes.ts).
const dataEnvelope = {
  type: 'object',
  properties: {
    data: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
};

const listEnvelope = {
  type: 'object',
  properties: {
    data: { type: 'array', items: { type: 'object', additionalProperties: true } },
    meta: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
};

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
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
  // POST /api/tenants — Create tenant
  app.post(
    '/api/tenants',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'Create a new tenant',
        security: [{ bearerAuth: [] }],
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

      reply.code(201);
      return { data: tenant };
    },
  );

  // GET /api/tenants — List tenants
  app.get(
    '/api/tenants',
    {
      schema: {
        tags: ['Tenants'],
        summary: 'List tenants',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            perPage: { type: 'integer', minimum: 1 },
            search: { type: 'string' },
          },
        },
        response: {
          200: listEnvelope,
        },
      },
    },
    async (request) => {
      const query = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(query.page ?? '', 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(query.perPage ?? '', 10) || 10));
      const _skip = (page - 1) * perPage;

      const [data, total] = await Promise.all([
        tenantRepo.findMany({ page, limit: perPage, search: query.search }),
        tenantRepo.count(),
      ]);

      return {
        data,
        meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
      };
    },
  );

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
