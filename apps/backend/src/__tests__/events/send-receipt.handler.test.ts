import { describe, it, expect, vi } from 'vitest';
import { SendReceiptHandler } from '@/application/events/handlers/send-receipt.handler';
import type { DomainEvent } from '@/domain/events/domain-events';

function createMocks() {
  const invoiceRepo = {
    findById: vi.fn(),
    findExistingForSubscription: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    getStats: vi.fn(),
  };

  const clientRepo = {
    findById: vi.fn(),
    findByPhone: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    updateRiskScore: vi.fn(),
  };

  const messageProvider = {
    sendText: vi.fn(),
    sendTemplate: vi.fn(),
    getStatus: vi.fn(),
  };

  return { invoiceRepo, clientRepo, messageProvider };
}

function makePaymentConfirmedEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: 'evt-123',
    eventType: 'payment.confirmed',
    clientId: 'client-123',
    tenantId: 'tenant-123',
    invoiceId: 'invoice-123',
    timestamp: new Date().toISOString(),
    metadata: { amount: 150.0, method: 'PIX' },
    ...overrides,
  } as DomainEvent;
}

function makeOtherEvent(eventType: any = 'invoice.created'): DomainEvent {
  return {
    eventId: 'evt-456',
    eventType,
    clientId: 'client-123',
    tenantId: 'tenant-123',
    timestamp: new Date().toISOString(),
    metadata: {},
  } as DomainEvent;
}

describe('SendReceiptHandler', () => {
  describe('event filtering', () => {
    it('should ignore events that are not payment.confirmed', async () => {
      const { invoiceRepo, clientRepo, messageProvider } = createMocks();
      const handler = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider);

      await handler.handle(makeOtherEvent('invoice.created'));

      expect(invoiceRepo.findById).not.toHaveBeenCalled();
      expect(clientRepo.findById).not.toHaveBeenCalled();
      expect(messageProvider.sendTemplate).not.toHaveBeenCalled();
    });

    it('should ignore payment.confirmed events without invoiceId', async () => {
      const { invoiceRepo, clientRepo, messageProvider } = createMocks();
      const handler = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider);

      await handler.handle(makePaymentConfirmedEvent({ invoiceId: undefined }));

      expect(invoiceRepo.findById).not.toHaveBeenCalled();
      expect(clientRepo.findById).not.toHaveBeenCalled();
      expect(messageProvider.sendTemplate).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('should send receipt template when payment is confirmed', async () => {
      const { invoiceRepo, clientRepo, messageProvider } = createMocks();
      const handler = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider);

      const invoice = {
        id: 'invoice-123',
        clientId: 'client-123',
        tenantId: 'tenant-123',
        amount: 150.0,
        dueDate: new Date('2026-08-15'),
        status: 'PAID',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const client = {
        id: 'client-123',
        tenantId: 'tenant-123',
        name: 'John Doe',
        phone: '5511999998888',
        riskScore: 'GREEN' as any,
        totalInvoices: 1,
        paidInvoices: 1,
        preferredChannel: 'WHATSAPP' as any,
        preferredLeadDays: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      invoiceRepo.findById.mockResolvedValue(invoice);
      clientRepo.findById.mockResolvedValue(client);

      await handler.handle(makePaymentConfirmedEvent());

      expect(invoiceRepo.findById).toHaveBeenCalledWith('invoice-123');
      expect(clientRepo.findById).toHaveBeenCalledWith('client-123');
      expect(messageProvider.sendTemplate).toHaveBeenCalledWith({
        to: '5511999998888',
        text: '',
        tenantId: 'tenant-123',
        clientId: 'client-123',
        invoiceId: 'invoice-123',
        templateName: 'payment_receipt',
        variables: {
          clientName: 'John Doe',
          invoiceAmount: '150',
          invoiceDueDate: '2026-08-15',
          invoiceId: 'invoice-123',
        },
      });
    });

    it('should do nothing if invoice is not found', async () => {
      const { invoiceRepo, clientRepo, messageProvider } = createMocks();
      const handler = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider);

      invoiceRepo.findById.mockResolvedValue(null);

      await handler.handle(makePaymentConfirmedEvent());

      expect(invoiceRepo.findById).toHaveBeenCalledWith('invoice-123');
      expect(clientRepo.findById).not.toHaveBeenCalled();
      expect(messageProvider.sendTemplate).not.toHaveBeenCalled();
    });

    it('should do nothing if client is not found', async () => {
      const { invoiceRepo, clientRepo, messageProvider } = createMocks();
      const handler = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider);

      invoiceRepo.findById.mockResolvedValue({ id: 'invoice-123', clientId: 'client-123' });
      clientRepo.findById.mockResolvedValue(null);

      await handler.handle(makePaymentConfirmedEvent());

      expect(invoiceRepo.findById).toHaveBeenCalledWith('invoice-123');
      expect(clientRepo.findById).toHaveBeenCalledWith('client-123');
      expect(messageProvider.sendTemplate).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should catch and log errors without throwing', async () => {
      const { invoiceRepo, clientRepo, messageProvider } = createMocks();
      const handler = new SendReceiptHandler(invoiceRepo, clientRepo, messageProvider);

      invoiceRepo.findById.mockRejectedValue(new Error('Database connection lost'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(handler.handle(makePaymentConfirmedEvent())).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SendReceiptHandler] Error:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
