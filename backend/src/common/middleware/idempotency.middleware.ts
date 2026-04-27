import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import Redis from 'ioredis';
import { tap } from 'rxjs/operators';

/**
 * Idempotency interceptor for mutating endpoints.
 * Client sends `Idempotency-Key: <uuid>` header; if we've seen it within 10min
 * we replay the cached response. Prevents double-bids from retried requests.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private redis: Redis;
  private readonly TTL_SEC = 600;
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD,
      // Honor REDIS_TLS=true for managed providers (Upstash, ElastiCache).
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    });
  }

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = ctx.switchToHttp().getRequest();
    const method = req.method;
    if (!['POST', 'PUT', 'PATCH'].includes(method)) return next.handle();
    const key = req.headers['idempotency-key'];
    if (!key) return next.handle();
    const cacheKey = `idem:${req.user?.sub ?? 'anon'}:${key}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return of(JSON.parse(cached));
    }
    return next.handle().pipe(
      tap(async (body) => {
        try { await this.redis.setex(cacheKey, this.TTL_SEC, JSON.stringify(body)); } catch {}
      }),
    );
  }
}
