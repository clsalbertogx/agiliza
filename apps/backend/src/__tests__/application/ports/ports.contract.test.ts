import { describe, it, expect } from 'vitest';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { InvoiceRepositoryPort } from '@/application/ports/repositories/invoice.repository.port';
import type { TenantRepositoryPort } from '@/application/ports/repositories/tenant.repository.port';
import type { PaymentGatewayPort } from '@/application/ports/gateways/payment-gateway.port';
import type { WebhookVerifierPort } from '@/application/ports/gateways/webhook-verifier.port';
import type { MessageProviderPort } from '@/application/ports/gateways/message-provider.port';
import type { UnitOfWorkPort } from '@/application/ports/adapters/unit-of-work.port';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';

describe('Application Ports - Contract Tests', () => {
  describe('ClientRepositoryPort', () => {
    it('should have correct method signatures', () => {
      // This test verifies the interface compiles correctly
      const port: ClientRepositoryPort = {
        findById: async () => null,
        findByPhone: async () => null,
        findMany: async () => ({ data: [], total: 0 }),
        create: async (client) => client,
        update: async (client) => client,
        delete: async () => {},
        count: async () => 0,
        updateRiskScore: async () => {},
      };

      expect(typeof port.findById).toBe('function');
      expect(typeof port.findByPhone).toBe('function');
      expect(typeof port.findMany).toBe('function');
      expect(typeof port.create).toBe('function');
      expect(typeof port.update).toBe('function');
      expect(typeof port.delete).toBe('function');
      expect(typeof port.count).toBe('function');
      expect(typeof port.updateRiskScore).toBe('function');
    });
  });

  describe('InvoiceRepositoryPort', () => {
    it('should have correct method signatures', () => {
      const port: InvoiceRepositoryPort = {
        findById: async () => null,
        findMany: async () => ({ data: [], total: 0 }),
        create: async (invoice) => invoice,
        update: async (invoice) => invoice,
        delete: async () => {},
        count: async () => 0,
        getStats: async () => ({
          total: 0,
          paid: 0,
          pending: 0,
          overdue: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0,
        }),
      };

      expect(typeof port.findById).toBe('function');
      expect(typeof port.findMany).toBe('function');
      expect(typeof port.create).toBe('function');
      expect(typeof port.update).toBe('function');
      expect(typeof port.delete).toBe('function');
      expect(typeof port.count).toBe('function');
      expect(typeof port.getStats).toBe('function');
    });
  });

  describe('TenantRepositoryPort', () => {
    it('should have correct method signatures', () => {
      const port: TenantRepositoryPort = {
        findById: async () => null,
        findBySlug: async () => null,
        findByEmail: async () => null,
        findMany: async () => ({ data: [], total: 0 }),
        create: async (tenant) => tenant,
        update: async (tenant) => tenant,
        delete: async () => {},
        count: async () => 0,
      };

      expect(typeof port.findById).toBe('function');
      expect(typeof port.findBySlug).toBe('function');
      expect(typeof port.findByEmail).toBe('function');
      expect(typeof port.findMany).toBe('function');
      expect(typeof port.create).toBe('function');
      expect(typeof port.update).toBe('function');
      expect(typeof port.delete).toBe('function');
      expect(typeof port.count).toBe('function');
    });
  });

  describe('PaymentGatewayPort', () => {
    it('should have correct method signatures with Either return types', () => {
      const port: PaymentGatewayPort = {
        createPixCharge: async () => ({ success: true, value: { id: '', qrCode: '', copyPaste: '', expiresAt: new Date(), status: '' } }),
        getCharge: async () => ({ success: true, value: { id: '', qrCode: '', copyPaste: '', expiresAt: new Date(), status: '' } }),
        cancelCharge: async () => ({ success: true, value: undefined }),
        handleWebhook: () => ({ success: true, value: { event: '', paymentId: '', status: '', metadata: {} } }),
      };

      expect(typeof port.createPixCharge).toBe('function');
      expect(typeof port.getCharge).toBe('function');
      expect(typeof port.cancelCharge).toBe('function');
      expect(typeof port.handleWebhook).toBe('function');
    });
  });

  describe('WebhookVerifierPort', () => {
    it('should have correct method signature with Either return type', () => {
      const port: WebhookVerifierPort = {
        verify: async () => ({ success: true, value: true }),
      };

      expect(typeof port.verify).toBe('function');
    });
  });

  describe('MessageProviderPort', () => {
    it('should have correct method signatures', () => {
      const port: MessageProviderPort = {
        sendText: async () => ({ externalId: '', status: 'queued', timestamp: '' }),
        sendTemplate: async () => ({ externalId: '', status: 'queued', timestamp: '' }),
        getStatus: async () => ({ externalId: '', status: 'queued', timestamp: '' }),
      };

      expect(typeof port.sendText).toBe('function');
      expect(typeof port.sendTemplate).toBe('function');
      expect(typeof port.getStatus).toBe('function');
    });
  });

  describe('UnitOfWorkPort', () => {
    it('should have correct method signature', () => {
      const port: UnitOfWorkPort = {
        execute: async (fn) => fn(),
      };

      expect(typeof port.execute).toBe('function');
    });
  });

  describe('EventBusPort', () => {
    it('should have correct method signatures', () => {
      const port: EventBusPort = {
        publish: () => {},
        subscribe: () => {},
      };

      expect(typeof port.publish).toBe('function');
      expect(typeof port.subscribe).toBe('function');
    });
  });
});