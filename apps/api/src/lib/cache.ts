import { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  delPrefix(prefix: string): Promise<void>;
}

class MemoryCache implements Cache {
  private store = new Map<string, { value: unknown; expires: number }>();
  async get<T>(key: string) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }
  async set(key: string, value: unknown, ttl: number) {
    if (this.store.size > 5000) this.store.clear(); // crude bound for a dev fallback
    this.store.set(key, { value, expires: Date.now() + ttl * 1000 });
  }
  async del(key: string) {
    this.store.delete(key);
  }
  async delPrefix(prefix: string) {
    for (const k of this.store.keys()) if (k.startsWith(prefix)) this.store.delete(k);
  }
}

class RedisCache implements Cache {
  constructor(private redis: Redis) {}
  async get<T>(key: string) {
    const raw = await this.redis.get(`cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : undefined;
  }
  async set(key: string, value: unknown, ttl: number) {
    await this.redis.set(`cache:${key}`, JSON.stringify(value), 'EX', ttl);
  }
  async del(key: string) {
    await this.redis.del(`cache:${key}`);
  }
  async delPrefix(prefix: string) {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', `cache:${prefix}*`, 'COUNT', 200);
      if (keys.length) await this.redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
  }
}

export const redis = env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 }) : null;
redis?.on('error', (err) => logger.warn({ err: err.message }, 'Redis error'));

export const cache: Cache = redis ? new RedisCache(redis) : new MemoryCache();

/** Read-through helper. Cache failures never break the request. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await cache.get<T>(key);
    if (hit !== undefined) return hit;
  } catch (err) {
    logger.warn({ err }, 'cache get failed');
  }
  const value = await load();
  cache.set(key, value, ttlSeconds).catch(() => undefined);
  return value;
}

/** Catalog data changes (admin edits, stock) invalidate everything under "catalog:". */
export const invalidateCatalog = () => cache.delPrefix('catalog:').catch(() => undefined);
