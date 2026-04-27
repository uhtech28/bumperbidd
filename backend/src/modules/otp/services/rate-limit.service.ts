import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../redis/redis.module';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec?: number;
}

/**
 * Sliding-window counter implemented with Redis INCR + EXPIRE.
 * Atomic: first INCR creates the key, EXPIRE sets TTL only once.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async hit(
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    const lua = `
      local c = redis.call('INCR', KEYS[1])
      if c == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('TTL', KEYS[1])
      return { c, ttl }
    `;
    const [countRaw, ttlRaw] = (await this.redis.eval(
      lua,
      1,
      key,
      String(windowSec),
    )) as [number, number];
    const count = Number(countRaw);
    const ttl = Number(ttlRaw);
    const remaining = Math.max(limit - count, 0);
    if (count > limit) {
      return { allowed: false, remaining: 0, retryAfterSec: ttl };
    }
    return { allowed: true, remaining };
  }

  /** Set a short-lived cooldown key (e.g. 30s between OTP sends). */
  async setCooldown(key: string, ttlSec: number): Promise<void> {
    await this.redis.set(key, '1', 'EX', ttlSec, 'NX');
  }

  async getCooldownTtl(key: string): Promise<number> {
    const ttl = await this.redis.ttl(key);
    return ttl > 0 ? ttl : 0;
  }
}
