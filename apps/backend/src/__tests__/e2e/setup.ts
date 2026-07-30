import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Wait for server to be ready
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch('http://localhost:3333/api/health');
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Server not ready after 10s');
});

afterAll(() => {
  // Cleanup
});
