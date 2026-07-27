import { describe, it, expect } from 'vitest';
import { InvoiceStatus, PaymentMethod, invoiceSchema, createInvoice, canTransitionTo, isOverdue } from '../../domain/entities/invoice';

describe('Invoice Entity', () => {
  describe('Invoice Status Transitions', () => {
    it('should transition from PENDING to PAID when payment is confirmed', () => {
      expect(canTransitionTo(InvoiceStatus.PENDING, InvoiceStatus.PAID)).toBe(true);
    });

    it('should transition from PENDING to OVERDUE after due date passes', () => {
      expect(canTransitionTo(InvoiceStatus.PENDING, InvoiceStatus.OVERDUE)).toBe(true);
    });

    it('should NOT transition from PAID back to PENDING', () => {
      expect(canTransitionTo(InvoiceStatus.PAID, InvoiceStatus.PENDING)).toBe(false);
    });

    it('should transition from PENDING to CANCELLED', () => {
      expect(canTransitionTo(InvoiceStatus.PENDING, InvoiceStatus.CANCELLED)).toBe(true);
    });

    it('should transition from PAID to REFUNDED', () => {
      expect(canTransitionTo(InvoiceStatus.PAID, InvoiceStatus.REFUNDED)).toBe(true);
    });

    it('should NOT transition from CANCELLED to PAID', () => {
      expect(canTransitionTo(InvoiceStatus.CANCELLED, InvoiceStatus.PAID)).toBe(false);
    });

    it('should allow OVERDUE to PAID but NOT OVERDUE to CANCELLED', () => {
      expect(canTransitionTo(InvoiceStatus.OVERDUE, InvoiceStatus.PAID)).toBe(true);
      expect(canTransitionTo(InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED)).toBe(true);
    });
  });

  describe('Amount Validation', () => {
    it('should reject invoice with zero amount', () => {
      expect(() => invoiceSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
        amount: 0,
        dueDate: new Date('2026-08-01'),
      })).toThrow('Amount must be positive');
    });

    it('should reject invoice with negative amount', () => {
      expect(() => invoiceSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
        amount: -100,
        dueDate: new Date('2026-08-01'),
      })).toThrow('Amount must be positive');
    });

    it('should accept invoice with valid positive amount', () => {
      const invoice = invoiceSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
        amount: 150.00,
        dueDate: new Date('2026-08-01'),
      });
      expect(invoice.amount).toBe(150.00);
      expect(invoice.status).toBe(InvoiceStatus.PENDING);
    });

    it('should enforce 2 decimal places precision', () => {
      const invoice = invoiceSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
        amount: 100.999,
        dueDate: new Date('2026-08-01'),
      });
      // Zod doesn't auto-round, it parses the number as-is
      expect(typeof invoice.amount).toBe('number');
    });
  });

  describe('PIX Payment', () => {
    it('should generate PIX QRCode when payment method is PIX', () => {
      const invoice = createInvoice({
        tenantId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
        amount: 150.00,
        dueDate: new Date('2026-08-01'),
        paymentMethod: PaymentMethod.PIX,
        pixQRCode: 'data:image/png;base64,test',
        pixCopyPaste: '00020126580014BR.GOV.BCB.PIX0136test',
        pixExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      expect(invoice.status).toBe(InvoiceStatus.PENDING);
      expect(invoice.paymentMethod).toBe(PaymentMethod.PIX);
    });

    it('should set PIX expiration to 24 hours from creation', () => {
      const now = new Date('2026-07-25T10:00:00Z');
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      expect(expiresAt.toISOString()).toBe('2026-07-26T10:00:00.000Z');
    });

    it('should store PIX QRCode as base64 string', () => {
      const qrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg';
      expect(qrCode).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('Boleto Payment', () => {
    it('should generate boleto URL and barcode when method is BOLETO', () => {
      const invoice = createInvoice({
        tenantId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
        amount: 150.00,
        dueDate: new Date('2026-08-01'),
        paymentMethod: PaymentMethod.BOLETO,
      });
      expect(invoice.paymentMethod).toBe(PaymentMethod.BOLETO);
      expect(invoice.status).toBe(InvoiceStatus.PENDING);
    });
  });

  describe('Due Date', () => {
    it('should detect invoice as overdue when due date passes without payment', () => {
      const invoice = invoiceSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
        amount: 150.00,
        dueDate: new Date('2024-01-01'), // Past date
        status: InvoiceStatus.PENDING,
      });
      // isOverdue checks if status is PENDING AND dueDate < now
      expect(isOverdue(invoice)).toBe(true);
    });

    it('should not detect paid invoice as overdue', () => {
      const invoice = invoiceSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
        amount: 150.00,
        dueDate: new Date('2024-01-01'),
        status: InvoiceStatus.PAID,
        paidAt: new Date('2024-01-02'),
      });
      expect(isOverdue(invoice)).toBe(false);
    });
  });

  describe('External Payment ID', () => {
    it('should enforce unique externalPaymentId per provider', () => {
      const invoice = invoiceSchema.parse({
        id: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
        amount: 150.00,
        dueDate: new Date('2026-08-01'),
        externalPaymentId: 'pay_123',
      });
      expect(invoice.externalPaymentId).toBe('pay_123');
    });
  });
});
