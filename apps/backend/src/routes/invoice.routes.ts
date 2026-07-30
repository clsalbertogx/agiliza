import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createCreateInvoiceUseCase,
  createListInvoicesUseCase,
  createGetInvoiceUseCase,
  createGetInvoiceStatsUseCase,
  createInvoiceRepository,
  createClientRepository,
  createPaymentProvider,
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
    const invoice = await invoiceRepo.findByIdRaw(id, request.tenantId);

    if (!invoice) {
      reply.code(404);
      return { error: 'Invoice not found' };
    }

    if (invoice.status === 'PAID') {
      reply.code(400);
      return { error: 'Invoice is already paid' };
    }

    // Create PIX charge via configured payment provider
    try {
      // Get tenant's payment provider config (in real impl, fetch from DB)
      const provider = createPaymentProvider({
        type: (process.env.PAYMENT_PROVIDER as 'asaas' | 'mercadopago' | 'pagbank' | 'polar') || 'asaas',
        apiKey: process.env.ASAAS_API_KEY || 'sandbox-key',
        environment: (process.env.ASAAS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      });

      const pixCharge = await provider.createPixCharge({
        amount: Number(invoice.amount),
        description: (invoice.description as string) || `Invoice ${invoice.id as string}`,
        externalReference: invoice.id as string,
      });

      // Update invoice with PIX data (tenant-isolated)
      await invoiceRepo.updateRaw(id, {
        paymentMethod: 'PIX',
        pixQRCode: pixCharge.qrCode,
        pixCopyPaste: pixCharge.copyPaste,
        pixExpiresAt: pixCharge.expiresAt,
      }, request.tenantId);

      reply.code(200);
      return {
        data: {
          status: 'PENDING',
          pix: {
            qrCode: pixCharge.qrCode,
            copyPaste: pixCharge.copyPaste,
            expiresAt: pixCharge.expiresAt,
          },
        },
      };
    } catch (error: any) {
      reply.code(502);
      return { error: 'Payment provider error', message: error.message };
    }
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
