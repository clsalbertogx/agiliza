import { getRedis } from '../queue/redis.service';

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * Redis-based cache service.
 */
export class CacheService {
  private readonly ttl: number;

  constructor(ttlSeconds?: number) {
    this.ttl = ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    const raw = await redis.get(key);

    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const redis = getRedis();
    const serialized = JSON.stringify(value);
    const ttl = ttlSeconds ?? this.ttl;

    await redis.setex(key, ttl, serialized);
  }

  async invalidate(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(key);
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    const redis = getRedis();
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  buildKey(...parts: string[]): string {
    return parts.join(':');
  }
}
