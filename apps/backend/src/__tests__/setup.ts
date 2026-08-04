import { afterAll, beforeAll } from 'vitest';

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dev:dev@localhost:5432/agiliza_test';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
});

afterAll(() => {
  // Cleanup
});
