import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { InvoiceRepository } from '../infrastructure/database/repositories/invoice.repository';
import { ClientRepository } from '../infrastructure/database/repositories/client.repository';
import { PaymentProviderFactory } from '../infrastructure/payment/payment-provider.factory';

const createInvoiceSchema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
  paymentMethod: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']).optional(),
});

const invoiceRepo = new InvoiceRepository();
const clientRepo = new ClientRepository();

export async function invoiceRoutes(app: FastifyInstance) {
  // POST /api/invoices — Create invoice
  app.post('/api/invoices', async (request, reply) => {
    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Validation error', details: parsed.error.flatten() };
    }

    const data = parsed.data;

    // Validate client exists (with tenant isolation)
    const client = await clientRepo.findById(data.clientId, data.tenantId);
    if (!client) {
      reply.code(404);
      return { error: 'Client not found' };
    }

    // Validate client belongs to tenant
    if (data.tenantId !== client.tenantId) {
      reply.code(400);
      return { error: 'Client does not belong to this tenant' };
    }

    const invoice = await invoiceRepo.create({
      id: crypto.randomUUID(),
      tenantId: data.tenantId,
      clientId: data.clientId,
      amount: data.amount,
      dueDate: new Date(data.dueDate),
      description: data.description || null,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    reply.code(201);
    return { data: invoice };
  });

  // GET /api/invoices — List invoices
  app.get('/api/invoices', async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;
    const page = Math.max(1, parseInt(query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(query.perPage) || 10));
    const skip = (page - 1) * perPage;

    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;

    const [data, total] = await Promise.all([
      invoiceRepo.findMany({ 
        where, 
        skip, 
        take: perPage, 
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { name: true, phone: true } } },
      }),
      invoiceRepo.count(where),
    ]);

    return {
      data,
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage) },
    };
  });

  // GET /api/invoices/stats — Get invoice stats (MUST be registered BEFORE :id)
  app.get('/api/invoices/stats', async (request) => {
    const query = request.query as any;
    const tenantId = request.tenantId || query.tenantId;

    if (!tenantId) {
      return { error: 'tenantId is required' };
    }

    const stats = await invoiceRepo.getStats(tenantId);
    return { data: stats };
  });

  // GET /api/invoices/:id — Get invoice
  app.get('/api/invoices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await invoiceRepo.getInvoiceWithClient(id);

    if (!invoice) {
      reply.code(404);
      return { error: 'Invoice not found' };
    }

    return { data: invoice };
  });

  // POST /api/invoices/:id/pay — Process payment (creates PIX charge)
  app.post('/api/invoices/:id/pay', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await invoiceRepo.findById(id, request.tenantId);

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
      const provider = PaymentProviderFactory.create({
        type: (process.env.PAYMENT_PROVIDER as 'asaas' | 'mercadopago' | 'pagbank' | 'polar') || 'asaas',
        apiKey: process.env.ASAAS_API_KEY || 'sandbox-key',
        environment: (process.env.ASAAS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      });

      const pixCharge = await provider.createPixCharge({
        amount: Number(invoice.amount),
        description: invoice.description || `Invoice ${invoice.id}`,
        externalReference: invoice.id,
      });

      // Update invoice with PIX data (tenant-isolated)
      await invoiceRepo.update(id, {
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
    const invoice = await invoiceRepo.findById(id, request.tenantId);

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
