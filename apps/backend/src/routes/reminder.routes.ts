import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createEventRepository, createInvoiceRepository, createReminderService } from '@/presentation/factories';

const scheduleReminderSchema = z.object({
  invoiceId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
});

const sendNowSchema = z.object({
  invoiceId: z.string().uuid(),
});

export async function reminderRoutes(app: FastifyInstance) {
  const reminderService = createReminderService();

  // POST /api/reminders/schedule — Schedule a reminder
  app.post(
    '/api/reminders/schedule',
    {
      schema: {
        tags: ['Reminders'],
        summary: 'Schedule a reminder for an invoice',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['invoiceId'],
          properties: {
            invoiceId: { type: 'string', format: 'uuid' },
            scheduledAt: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'object', additionalProperties: true } },
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = scheduleReminderSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'Validation error', details: parsed.error.flatten() };
      }

      const { invoiceId } = parsed.data;

      const tenantId = request.tenantId;
      if (!tenantId) {
        reply.code(401);
        return { error: 'Missing tenant context' };
      }

      // Verify invoice exists AND belongs to the calling tenant before scheduling
      const invoiceRepo = createInvoiceRepository();
      const invoice = await invoiceRepo.getInvoiceWithClientRaw(invoiceId, tenantId);
      if (!invoice?.client) {
        reply.code(404);
        return { error: 'Invoice or client not found' };
      }

      await reminderService.sendReminderNow(invoiceId, tenantId);

      reply.code(200);
      return { data: { status: 'scheduled', invoiceId } };
    },
  );

  // POST /api/reminders/send-now — Send reminder immediately
  app.post(
    '/api/reminders/send-now',
    {
      schema: {
        tags: ['Reminders'],
        summary: 'Send reminder immediately',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['invoiceId'],
          properties: {
            invoiceId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'object', additionalProperties: true } },
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = sendNowSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'Validation error', details: parsed.error.flatten() };
      }

      const { invoiceId } = parsed.data;

      const tenantId = request.tenantId;
      if (!tenantId) {
        reply.code(401);
        return { error: 'Missing tenant context' };
      }

      // a3: verify the invoice belongs to the calling tenant before sending.
      const invoiceRepo = createInvoiceRepository();
      const invoice = await invoiceRepo.getInvoiceWithClientRaw(invoiceId, tenantId);
      if (!invoice) {
        reply.code(404);
        return { error: 'Invoice not found' };
      }

      try {
        const result = await reminderService.sendReminderNow(invoiceId, tenantId);
        reply.code(200);
        return { data: { status: 'sent', externalId: result.externalId } };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        reply.code(502);
        return { error: 'Failed to send reminder', message };
      }
    },
  );

  // GET /api/messages — List messages
  app.get(
    '/api/messages',
    {
      schema: {
        tags: ['Messages'],
        summary: 'List sent messages',
        description: 'Paginated list of sent messages (event type MESSAGE_SENT).',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            perPage: { type: 'integer', minimum: 1 },
            status: { type: 'string' },
            clientId: { type: 'string', format: 'uuid' },
            invoiceId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
              meta: { type: 'object', additionalProperties: true },
            },
            additionalProperties: true,
          },
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

      const page = Math.max(1, parseInt(query.page ?? '', 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(query.perPage ?? '', 10) || 10));
      const skip = (page - 1) * perPage;

      const eventRepo = createEventRepository();

      const where: Record<string, unknown> = { tenantId };
      if (query.status) where.status = query.status;
      if (query.clientId) where.clientId = query.clientId;
      if (query.invoiceId) where.invoiceId = query.invoiceId;

      const [events, total] = await Promise.all([
        eventRepo.findManyRaw({
          where: { ...where, eventType: 'MESSAGE_SENT' },
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
        }),
        eventRepo.countRaw({ ...where, eventType: 'MESSAGE_SENT' }),
      ]);

      return {
        data: events,
        meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
      };
    },
  );

  // GET /api/messages/:id/tracking — Get message tracking timeline
  app.get(
    '/api/messages/:id/tracking',
    {
      schema: {
        tags: ['Messages'],
        summary: 'Get message tracking timeline',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'object', additionalProperties: true } },
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const eventRepo = createEventRepository();

      // a2: scope the lookup to the calling tenant — a tenant must never read
      // another tenant's message tracking timeline.
      const event = await eventRepo.findByIdRaw(id, request.tenantId);

      if (!event) {
        reply.code(404);
        return { error: 'Message not found' };
      }

      // Get all events related to this message
      const trackingEvents = await eventRepo.findManyRaw({
        where: {
          tenantId: event.tenantId,
          clientId: event.clientId,
          eventType: { in: ['MESSAGE_SENT', 'MESSAGE_DELIVERED', 'MESSAGE_READ', 'LINK_CLICKED'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        data: {
          originalEvent: event,
          timeline: trackingEvents,
        },
      };
    },
  );

  // POST /api/reminders/process-pending — Process all pending reminders for a tenant
  app.post(
    '/api/reminders/process-pending',
    {
      schema: {
        tags: ['Reminders'],
        summary: 'Process all pending reminders for a tenant',
        description: 'Routes through the decision engine to send pending reminders.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'object', additionalProperties: true } },
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;

      if (!tenantId) {
        reply.code(400);
        return { error: 'tenantId is required' };
      }

      const result = await reminderService.processPendingReminders(tenantId);

      reply.code(200);
      return {
        data: {
          processed: result.processed,
          decisions: result.decisions.length,
        },
      };
    },
  );
}
