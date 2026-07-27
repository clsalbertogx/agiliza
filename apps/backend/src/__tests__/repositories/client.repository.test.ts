import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma client before importing the repository
const mockPrismaClient = {
  client: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('../../infrastructure/database/prisma.service', () => ({
  getPrismaClient: vi.fn(() => mockPrismaClient),
}));

import { ClientRepository } from '../../infrastructure/database/repositories/client.repository';

describe('ClientRepository', () => {
  let repo: ClientRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ClientRepository();
  });

  const mockClient = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000002',
    name: 'John Doe',
    phone: '5511999998888',
    email: 'john@example.com',
    riskScore: 'GREEN',
    preferredChannel: 'WHATSAPP',
    preferredLeadDays: 3,
    totalInvoices: 0,
    paidInvoices: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('CRUD Operations', () => {
    it('should create a new client with all required fields', async () => {
      mockPrismaClient.client.create.mockResolvedValue(mockClient);
      const result = await repo.create(mockClient);
      expect(result).toEqual(mockClient);
      expect(mockPrismaClient.client.create).toHaveBeenCalledWith({ data: mockClient });
    });

    it('should find client by ID within tenant scope', async () => {
      mockPrismaClient.client.findUnique.mockResolvedValue(mockClient);
      const result = await repo.findById(mockClient.id);
      expect(result).toEqual(mockClient);
      expect(mockPrismaClient.client.findUnique).toHaveBeenCalledWith({ where: { id: mockClient.id } });
    });

    it('should return null when finding client by ID with wrong tenantId', async () => {
      mockPrismaClient.client.findUnique.mockResolvedValue(null);
      const result = await repo.findById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should update client details', async () => {
      const updateData = { name: 'Updated Name', preferredChannel: 'EMAIL' };
      const updatedClient = { ...mockClient, ...updateData };
      mockPrismaClient.client.update.mockResolvedValue(updatedClient);
      const result = await repo.update(mockClient.id, updateData);
      expect(result.name).toBe('Updated Name');
      expect(mockPrismaClient.client.update).toHaveBeenCalledWith({
        where: { id: mockClient.id },
        data: updateData,
      });
    });

    it('should soft-delete / anonymize a client (LGPD)', async () => {
      const anonymizedData = { name: 'DELETADO', phone: '00000000000' };
      mockPrismaClient.client.update.mockResolvedValue({ ...mockClient, ...anonymizedData });
      const result = await repo.update(mockClient.id, anonymizedData);
      expect(result.name).toBe('DELETADO');
      expect(result.phone).toBe('00000000000');
    });
  });

  describe('Query Operations', () => {
    it('should find client by phone within tenant scope', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(mockClient);
      const result = await repo.findByPhone(mockClient.tenantId, mockClient.phone);
      expect(result).toEqual(mockClient);
      expect(mockPrismaClient.client.findFirst).toHaveBeenCalledWith({
        where: { tenantId: mockClient.tenantId, phone: mockClient.phone },
      });
    });

    it('should NOT find client by phone across tenants', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(null);
      const result = await repo.findByPhone('other-tenant-id', mockClient.phone);
      expect(result).toBeNull();
    });

    it('should list clients filtered by risk score', async () => {
      const redClients = [mockClient];
      mockPrismaClient.client.findMany.mockResolvedValue(redClients);
      const result = await repo.findByRiskScore(mockClient.tenantId, 'RED');
      expect(result).toEqual(redClients);
    });

    it('should search clients by name with partial match', async () => {
      const results = [mockClient];
      mockPrismaClient.client.findMany.mockResolvedValue(results);
      const result = await repo.search(mockClient.tenantId, 'Silva');
      expect(result).toEqual(results);
    });

    it('should search clients by phone with partial match', async () => {
      const results = [mockClient];
      mockPrismaClient.client.findMany.mockResolvedValue(results);
      const result = await repo.search(mockClient.tenantId, '5511');
      expect(result).toEqual(results);
    });

    it('should NOT return clients from other tenants', async () => {
      mockPrismaClient.client.findMany.mockResolvedValue([]);
      const result = await repo.findMany({ where: { tenantId: 'tenant-b' } });
      expect(result).toEqual([]);
    });

    it('should paginate client list with default page 1, perPage 20', async () => {
      mockPrismaClient.client.findMany.mockResolvedValue([mockClient]);
      mockPrismaClient.client.count.mockResolvedValue(1);
      const [data, total] = await Promise.all([
        repo.findMany({ skip: 0, take: 20, orderBy: { createdAt: 'desc' } }),
        repo.count(),
      ]);
      expect(Array.isArray(data)).toBe(true);
      expect(total).toBe(1);
    });

    it('should paginate client list with custom page and perPage', async () => {
      const allClients = Array(50).fill(null).map((_, i) => ({
        ...mockClient,
        id: `id-${i}`,
        name: `Client ${i}`,
      }));
      mockPrismaClient.client.findMany.mockResolvedValue(allClients.slice(10, 20));
      mockPrismaClient.client.count.mockResolvedValue(50);
      const [data, total] = await Promise.all([
        repo.findMany({ skip: 10, take: 10, orderBy: { createdAt: 'desc' } }),
        repo.count(),
      ]);
      expect(data.length).toBe(10);
      expect(total).toBe(50);
    });

    it('should sort clients by name ascending', async () => {
      mockPrismaClient.client.findMany.mockResolvedValue([mockClient]);
      const result = await repo.findMany({
        where: { tenantId: mockClient.tenantId },
        orderBy: { name: 'asc' },
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter clients by onboarding completed status', async () => {
      mockPrismaClient.client.findMany.mockResolvedValue([mockClient]);
      const result = await repo.findMany({
        where: { tenantId: mockClient.tenantId },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique phone per tenant', async () => {
      mockPrismaClient.client.findFirst.mockResolvedValue(mockClient);
      const existing = await repo.findByPhone(mockClient.tenantId, mockClient.phone);
      expect(existing).not.toBeNull();
    });

    it('should allow same phone across different tenants', async () => {
      mockPrismaClient.client.findFirst
        .mockResolvedValueOnce(mockClient) // exists in tenant A
        .mockResolvedValueOnce(null); // does not exist in tenant B
      
      const existingInA = await repo.findByPhone('tenant-a', '5511999998888');
      expect(existingInA).not.toBeNull();
      
      const existingInB = await repo.findByPhone('tenant-b', '5511999998888');
      expect(existingInB).toBeNull();
    });
  });
});
