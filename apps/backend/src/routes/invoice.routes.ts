import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createClientRepository,
  createCreateInvoiceUseCase,
  createGetInvoiceStatsUseCase,
  createGetInvoiceUseCase,
  createInvoiceRepository,
  createListInvoicesUseCase,
  createListPaymentsForInvoiceUseCase,
  createProcessPaymentUseCase,
} from '@/presentation/factories';

const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
  paymentMethod: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']).optional(),
});

// Pass-through response envelopes for OpenAPI (see client.routes.ts).
const dataEnvelope = {
  type: 'object',
  properties: {
    data: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
};

// Documented Invoice item shape. Nullable unions (`['string','null']`) let
// runtime `null`s round-trip untouched, and `additionalProperties: true`
// preserves fields not listed here (PIX fields, `externalPaymentId`,
// `metadata`, nested `client`, ...).
const invoiceResponseSchema = {
  type: 'object',
  required: ['id', 'tenantId', 'clientId', 'amount', 'dueDate', 'status'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    tenantId: { type: 'string', format: 'uuid' },
    clientId: { type: 'string', format: 'uuid' },
    amount: { type: 'number' },
    dueDate: { type: ['string', 'null'], format: 'date-time' },
    description: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'] },
    paymentMethod: { type: ['string', 'null'], enum: ['PIX', 'BOLETO', 'CREDIT_CARD'] },
    createdAt: { type: ['string', 'null'], format: 'date-time' },
    updatedAt: { type: ['string', 'null'], format: 'date-time' },
  },
  additionalProperties: true,
} as const;

const invoiceSingleEnvelope = {
  type: 'object',
  properties: {
    data: invoiceResponseSchema,
  },
  additionalProperties: true,
} as const;

const invoiceListEnvelope = {
  type: 'object',
  properties: {
    data: { type: 'array', items: invoiceResponseSchema },
    meta: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
} as const;

export async function invoiceRoutes(app: FastifyInstance) {
  const invoiceRepo = createInvoiceRepository();
  const _clientRepo = createClientRepository();
  // POST /api/invoices — Create invoice (via use case)
  app.post(
    '/api/invoices',
    {
      schema: {
        tags: ['Invoices'],
        summary: 'Create a new invoice',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['clientId', 'amount', 'dueDate'],
          properties: {
            clientId: { type: 'string', format: 'uuid' },
            amount: { type: 'number', exclusiveMinimum: 0 },
            dueDate: { type: 'string', format: 'date-time' },
            description: { type: 'string' },
            paymentMethod: { type: 'string', enum: ['PIX', 'BOLETO', 'CREDIT_CARD'] },
          },
        },
        response: {
          201: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const parsed = createInvoiceSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'Validation error', details: parsed.error.flatten() };
      }

      const data = parsed.data;
      const tenantId = request.tenantId;

      if (!tenantId) {
        reply.code(401);
        return { error: 'Missing tenant context' };
      }

      const useCase = createCreateInvoiceUseCase();

      const result = await useCase.execute({
        tenantId,
        clientId: data.clientId,
        amount: data.amount,
        dueDate: new Date(data.dueDate),
        description: data.description,
      });

      if (!result.success) {
        reply.code(result.value.statusCode);
        return { error: result.value.message };
      }

      reply.code(201);
      return { data: result.value };
    },
  );

  // GET /api/invoices — List invoices (via use case)
  app.get(
    '/api/invoices',
    {
      schema: {
        tags: ['Invoices'],
        summary: 'List invoices',
        description: 'Paginated invoice list, filtered by the authenticated tenant (JWT).',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            perPage: { type: 'integer', minimum: 1 },
            status: { type: 'string' },
            clientId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: invoiceListEnvelope,
        },
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      // A6: the JWT is the authoritative tenant source.
      const tenantId = request.tenantId;

      if (!tenantId) {
        reply.code(401);
        return { error: 'Missing tenant context' };
      }

      const useCase = createListInvoicesUseCase();
      const result = await useCase.execute({
        tenantId,
        page: parseInt(query.page ?? '', 10) || 1,
        perPage: parseInt(query.perPage ?? '', 10) || 10,
        status: query.status,
        clientId: query.clientId,
      });

      return result;
    },
  );

  // GET /api/invoices/stats — Get invoice stats (via use case, MUST be registered BEFORE :id)
  app.get(
    '/api/invoices/stats',
    {
      schema: {
        tags: ['Invoices'],
        summary: 'Get invoice statistics',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {},
        },
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      // A6: the JWT is the authoritative tenant source.
      const tenantId = request.tenantId;

      if (!tenantId) {
        reply.code(401);
        return { error: 'Missing tenant context' };
      }

      const useCase = createGetInvoiceStatsUseCase();
      const result = await useCase.execute({ tenantId });

      if (!result.success) {
        reply.code(result.value.statusCode);
        return { error: result.value.message };
      }

      return { data: result.value };
    },
  );

  // GET /api/invoices/:id — Get invoice (via use case, tenant-isolated)
  app.get(
    '/api/invoices/:id',
    {
      schema: {
        tags: ['Invoices'],
        summary: 'Get an invoice by ID',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: invoiceSingleEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.tenantId;

      if (!tenantId) {
        reply.code(401);
        return { error: 'Missing tenant context' };
      }

      const useCase = createGetInvoiceUseCase();
      const result = await useCase.execute({ id, tenantId });

      if (!result.success) {
        reply.code(result.value.statusCode);
        return { error: result.value.message };
      }

      return { data: result.value };
    },
  );

  // POST /api/invoices/:id/pay — Process payment (creates PIX charge)
  app.post(
    '/api/invoices/:id/pay',
    {
      schema: {
        tags: ['Invoices'],
        summary: 'Process payment for an invoice',
        description: 'Creates a PIX charge at the tenant payment provider.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.tenantId;

      if (!tenantId) {
        reply.code(401);
        return { error: 'Missing tenant context' };
      }

      const useCase = createProcessPaymentUseCase();
      const result = await useCase.execute({ invoiceId: id, tenantId });

      if (!result.success) {
        reply.code(result.value.statusCode);
        return { error: result.value.message };
      }

      reply.code(200);
      return { data: result.value };
    },
  );

  // GET /api/invoices/:id/payments — List payment history for invoice
  app.get(
    '/api/invoices/:id/payments',
    {
      schema: {
        tags: ['Invoices'],
        summary: 'List payments for an invoice',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.tenantId;

      if (!tenantId) {
        reply.code(401);
        return { error: 'Missing tenant context' };
      }

      const useCase = createListPaymentsForInvoiceUseCase();
      const result = await useCase.execute({ invoiceId: id, tenantId });

      if (!result.success) {
        reply.code(result.value.statusCode);
        return { error: result.value.message };
      }

      return { data: result.value };
    },
  );

  // GET /api/invoices/:id/pix-qrcode — Get PIX QRCode
  app.get(
    '/api/invoices/:id/pix-qrcode',
    {
      schema: {
        tags: ['Invoices'],
        summary: 'Get PIX QR code for an invoice',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: dataEnvelope,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const invoice = await invoiceRepo.findByIdRaw(id, request.tenantId);

      if (!invoice) {
        reply.code(404);
        return { error: 'Invoice not found' };
      }

      if (!invoice.pixQRCode) {
        reply.code(404);
        return { error: 'PIX QRCode not available for this invoice' };
      }

      return {
        data: {
          qrCode: invoice.pixQRCode,
          copyPaste: invoice.pixCopyPaste,
          expiresAt: invoice.pixExpiresAt,
        },
      };
    },
  );
}
