import Redis from 'ioredis';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      logger.error({ err }, '[Redis] Connection error:');
    });

    redis.on('connect', () => {
      logger.info('[Redis] Connected');
    });
  }

  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  if (!client.status || client.status === 'wait') {
    await client.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
