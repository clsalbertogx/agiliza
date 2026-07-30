import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReminderService } from '../application/services/reminder.service';
import { createEventRepository, createInvoiceRepository } from '../presentation/factories';

const reminderService = new ReminderService();

const scheduleReminderSchema = z.object({
  invoiceId: z.string().uuid(),
  tenantId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
});

const sendNowSchema = z.object({
  invoiceId: z.string().uuid(),
  tenantId: z.string().uuid(),
});

export async function reminderRoutes(app: FastifyInstance) {
  // POST /api/reminders/schedule — Schedule a reminder
  app.post('/api/reminders/schedule', async (request, reply) => {
    const parsed = scheduleReminderSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const { invoiceId, tenantId } = parsed.data;

    // Verify invoice exists before scheduling
    const invoiceRepo = createInvoiceRepository();
    const invoice = await invoiceRepo.getInvoiceWithClient(invoiceId);
    if (!invoice || !invoice.client) {
      reply.code(404);
      return { error: 'Invoice or client not found' };
    }

    await reminderService.sendReminderNow(invoiceId, tenantId);

    reply.code(200);
    return { data: { status: 'scheduled', invoiceId } };
  });

  // POST /api/reminders/send-now — Send reminder immediately
  app.post('/api/reminders/send-now', async (request, reply) => {
    const parsed = sendNowSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const { invoiceId, tenantId } = parsed.data;

    try {
      const result = await reminderService.sendReminderNow(invoiceId, tenantId);
      reply.code(200);
      return { data: { status: 'sent', externalId: result.externalId } };
    } catch (error: any) {
      reply.code(502);
      return { error: 'Failed to send reminder', message: error.message };
    }
  });

  // GET /api/messages — List messages
  app.get('/api/messages', async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;
    const page = Math.max(1, parseInt(query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(query.perPage) || 10));
    const skip = (page - 1) * perPage;

    const eventRepo = createEventRepository();

    const where: Record<string, any> = { tenantId };
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    if (query.invoiceId) where.invoiceId = query.invoiceId;

    const [events, total] = await Promise.all([
      eventRepo.findMany({
        where: { ...where, eventType: 'MESSAGE_SENT' },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      eventRepo.count({ ...where, eventType: 'MESSAGE_SENT' }),
    ]);

    return {
      data: events,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  });

  // GET /api/messages/:id/tracking — Get message tracking timeline
  app.get('/api/messages/:id/tracking', async (request, reply) => {
    const { id } = request.params as { id: string };
    const eventRepo = createEventRepository();

    const event = await eventRepo.findById(id);

    if (!event) {
      reply.code(404);
      return { error: 'Message not found' };
    }

    // Get all events related to this message
    const trackingEvents = await eventRepo.findMany({
      where: {
        tenantId: event.tenantId,
        clientId: event.clientId,
        eventType: { in: ['MESSAGE_SENT', 'MESSAGE_DELIVERED', 'MESSAGE_READ', 'LINK_CLICKED'] } as any,
      },
      orderBy: { createdAt: 'asc' } as any,
    });

    return {
      data: {
        originalEvent: event,
        timeline: trackingEvents,
      },
    };
  });

  // POST /api/reminders/process-pending — Process all pending reminders for a tenant
  app.post('/api/reminders/process-pending', async (request, reply) => {
    const body = request.body as any;
    const tenantId = request.tenantId || body.tenantId;

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
  });
}
