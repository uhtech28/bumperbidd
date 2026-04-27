import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../redis/redis.module';

export interface OtpRecord {
  hash: string;
  attempts: number;
  createdAt: number; // epoch ms
  requestId: string;
}

interface MemEntry {
  record: OtpRecord;
  expiresAt: number; // epoch ms
}

/**
 * Thin wrapper around Redis for OTP persistence. Keys:
 *   otp:phone:<e164>           -> hash, meta  (JSON, TTL = OTP window)
 *   otp:attempts:<e164>        -> verify attempt counter (same TTL)
 *   otp:cooldown:send:<e164>   -> resend cooldown marker
 *   otp:rl:send:phone:<e164>   -> hourly send-rate window
 *   otp:rl:send:ip:<ip>        -> IP hourly send-rate window
 *
 * In non-production environments we also maintain an in-process mirror of
 * the OTP record so local development keeps working even if the Redis
 * container hiccups (container restart, Docker Desktop DNS flakiness on
 * Windows, a second redis-server bound to the same port, etc.). Redis
 * remains the source of truth in production — the fallback is gated on
 * NODE_ENV !== 'production'.
 */
@Injectable()
export class OtpStoreService {
  private readonly log = new Logger(OtpStoreService.name);
  private readonly mem = new Map<string, MemEntry>();
  private readonly isDev = process.env.NODE_ENV !== 'production';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private otpKey(phone: string): string {
    return `otp:phone:${phone}`;
  }
  cooldownKey(phone: string): string {
    return `otp:cooldown:send:${phone}`;
  }
  phoneRlKey(phone: string): string {
    return `otp:rl:send:phone:${phone}`;
  }
  ipRlKey(ip: string): string {
    return `otp:rl:send:ip:${ip}`;
  }

  /**
   * Sweep expired in-memory entries. Called lazily on each get to avoid a
   * background timer — OTP traffic is low-volume so this is cheap.
   */
  private sweepMem(): void {
    if (this.mem.size === 0) return;
    const now = Date.now();
    for (const [key, entry] of this.mem) {
      if (entry.expiresAt <= now) this.mem.delete(key);
    }
  }

  async save(phone: string, record: OtpRecord, ttlSec: number): Promise<void> {
    const key = this.otpKey(phone);
    try {
      await this.redis.set(key, JSON.stringify(record), 'EX', ttlSec);
    } catch (e) {
      this.log.warn(
        `Redis SET failed for ${key}: ${(e as Error).message} — using in-memory fallback only (dev=${this.isDev})`,
      );
    }

    if (this.isDev) {
      // Mirror to in-process map with matching TTL semantics.
      this.mem.set(key, {
        record: { ...record },
        expiresAt: Date.now() + ttlSec * 1000,
      });
    }

    if (this.isDev) {
      this.log.debug(
        `OTP saved key=${key} ttl=${ttlSec}s memMirror=ON`,
      );
    }
  }

  async get(phone: string): Promise<OtpRecord | null> {
    const key = this.otpKey(phone);
    let raw: string | null = null;
    try {
      raw = await this.redis.get(key);
    } catch (e) {
      this.log.warn(
        `Redis GET failed for ${key}: ${(e as Error).message}`,
      );
    }

    if (raw) {
      return JSON.parse(raw) as OtpRecord;
    }

    // Redis miss — in dev, try the in-process mirror before giving up.
    if (this.isDev) {
      this.sweepMem();
      const entry = this.mem.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        this.log.warn(
          `OTP Redis miss but in-process mirror hit key=${key} — serving from memory (dev only)`,
        );
        return { ...entry.record };
      }
    }

    this.log.warn(`OTP miss key=${key}`);
    return null;
  }

  async incrementAttempts(phone: string): Promise<number> {
    // Rewrite the stored record with attempts+1 while preserving TTL.
    const key = this.otpKey(phone);
    const lua = `
      local val = redis.call('GET', KEYS[1])
      if not val then return -1 end
      local ttl = redis.call('TTL', KEYS[1])
      local rec = cjson.decode(val)
      rec.attempts = (rec.attempts or 0) + 1
      redis.call('SET', KEYS[1], cjson.encode(rec), 'EX', ttl > 0 and ttl or 1)
      return rec.attempts
    `;
    let attempts = -1;
    try {
      const res = (await this.redis.eval(lua, 1, key)) as number;
      attempts = Number(res);
    } catch (e) {
      this.log.warn(
        `Redis EVAL failed for ${key}: ${(e as Error).message}`,
      );
    }

    // Mirror the increment in dev, or recover from the in-process store
    // if Redis has forgotten about the record entirely.
    if (this.isDev) {
      this.sweepMem();
      const entry = this.mem.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        if (attempts < 0) {
          // Redis lost it — bump the in-memory copy instead.
          entry.record.attempts = (entry.record.attempts ?? 0) + 1;
          attempts = entry.record.attempts;
        } else {
          entry.record.attempts = attempts;
        }
      }
    }

    return attempts;
  }

  async delete(phone: string): Promise<void> {
    const key = this.otpKey(phone);
    try {
      await this.redis.del(key);
    } catch {
      /* ignore */
    }
    if (this.isDev) this.mem.delete(key);
  }
}
