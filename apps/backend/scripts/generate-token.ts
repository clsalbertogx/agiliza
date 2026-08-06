import { createToken } from '../src/infrastructure/auth/jwt.strategy';

const token = createToken(
  { tenantId: process.argv[2] || '00000000-0000-0000-0000-000000000000', userId: 'admin', role: 'owner' },
  // No hardcoded fallback (E2): must come from the environment.
  process.env.JWT_SECRET ?? '',
);

console.log('JWT Token:', token);
