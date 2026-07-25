import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().default('postgresql://dev:dev@localhost:5432/agiliza'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  EVOLUTION_API_URL: z.string().default('http://localhost:8080'),
  EVOLUTION_API_KEY: z.string().default(''),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  PAYMENT_PROVIDER: z.enum(['asaas', 'mercadopago', 'pagbank', 'polar']).default('asaas'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
