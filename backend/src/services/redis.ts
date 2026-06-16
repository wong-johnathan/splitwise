import Redis from 'ioredis';
import { config } from '../config';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });

    redis.on('error', (err) => {
      console.warn('⚠️ Redis connection error (non-fatal):', err.message);
    });
  }
  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await getRedis().get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Cache failures are non-fatal
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getRedis().del(key);
  } catch {
    // Cache failures are non-fatal
  }
}
