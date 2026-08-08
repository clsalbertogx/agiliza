import { afterAll, beforeAll } from 'vitest';

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dev:dev@localhost:5432/agiliza_test';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  // Security: required env vars (fail-closed schema — no defaults in env.ts).
  // Individual test files may still override these for their specific case.
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.MASTER_API_KEY = process.env.MASTER_API_KEY || 'test-master-api-key';
  process.env.ASAAS_API_KEY = process.env.ASAAS_API_KEY || 'test-asaas-api-key';
  process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'test-evolution-api-key';
});

afterAll(() => {
  // Cleanup
});
