import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createCreateInvoiceUseCase,
  createListInvoicesUseCase,
  createGetInvoiceUseCase,
  createGetInvoiceStatsUseCase,
  createProcessPaymentUseCase,
  createListPaymentsForInvoiceUseCase,
  createInvoiceRepository,
  createClientRepository,
} from '@/presentation/factories';

const createInvoiceSchema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
  paymentMethod: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']).optional(),
});

export async function invoiceRoutes(app: FastifyInstance) {
  const invoiceRepo = createInvoiceRepository();
  const clientRepo = createClientRepository();
  // POST /api/invoices — Create invoice (via use case)
  app.post('/api/invoices', async (request, reply) => {
    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const data = parsed.data;
    const useCase = createCreateInvoiceUseCase();

    const result = await useCase.execute({
      tenantId: data.tenantId,
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
  });

  // GET /api/invoices — List invoices (via use case)
  app.get('/api/invoices', async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;

    const useCase = createListInvoicesUseCase();
    const result = await useCase.execute({
      tenantId,
      page: parseInt(query.page) || 1,
      perPage: parseInt(query.perPage) || 10,
      status: query.status as string | undefined,
      clientId: query.clientId as string | undefined,
    });

    return result;
  });

  // GET /api/invoices/stats — Get invoice stats (via use case, MUST be registered BEFORE :id)
  app.get('/api/invoices/stats', async (request, reply) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;

    const useCase = createGetInvoiceStatsUseCase();
    const result = await useCase.execute({ tenantId });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });

  // GET /api/invoices/:id — Get invoice (via use case, tenant-isolated)
  app.get('/api/invoices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId;

    const useCase = createGetInvoiceUseCase();
    const result = await useCase.execute({ id, tenantId: tenantId! });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });

  // POST /api/invoices/:id/pay — Process payment (creates PIX charge)
  app.post('/api/invoices/:id/pay', async (request, reply) => {
    const { id } = request.params as { id: string };
    const useCase = createProcessPaymentUseCase();
    const result = await useCase.execute({ invoiceId: id, tenantId: request.tenantId! });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    reply.code(200);
    return { data: result.value };
  });

  // GET /api/invoices/:id/payments — List payment history for invoice
  app.get('/api/invoices/:id/payments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.tenantId;

    const useCase = createListPaymentsForInvoiceUseCase();
    const result = await useCase.execute({ invoiceId: id, tenantId: tenantId! });

    if (!result.success) {
      reply.code(result.value.statusCode);
      return { error: result.value.message };
    }

    return { data: result.value };
  });

  // GET /api/invoices/:id/pix-qrcode — Get PIX QRCode
  app.get('/api/invoices/:id/pix-qrcode', async (request, reply) => {
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
  });
}
