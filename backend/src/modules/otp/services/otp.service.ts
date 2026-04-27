import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AppConfig } from '../../../config/app.config';
import { generateNumericOtp, hashOtp, safeEqual } from '../../../utils/crypto.util';
import { OtpStoreService } from './otp-store.service';
import { RateLimitService } from './rate-limit.service';
import { MSG91, TWILIO, DEV_LOG } from '../otp.tokens';
import { SmsProvider } from '../providers/provider.interface';

export interface SendOtpOutcome {
  requestId: string;
  expiresInSec: number;
  resendAvailableInSec: number;
  provider: string;
}

export interface VerifyOtpOutcome {
  verified: true;
  requestId: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly cfg: AppConfig['otp'];
  private readonly pepper: string;

  constructor(
    config: ConfigService,
    private readonly store: OtpStoreService,
    private readonly rl: RateLimitService,
    @Inject(MSG91) private readonly msg91: SmsProvider,
    @Inject(TWILIO) private readonly twilio: SmsProvider,
    @Inject(DEV_LOG) private readonly devLog: SmsProvider,
  ) {
    this.cfg = config.get<AppConfig['otp']>('otp')!;
    this.pepper = config.get<AppConfig['jwt']>('jwt')!.secret;
  }

  /**
   * Send an OTP to the given phone.
   *   1. Enforce cooldown + hourly limits (phone & IP)
   *   2. Generate OTP, HMAC-hash it, persist with TTL
   *   3. Dispatch through provider chain (MSG91 → Twilio → Dev)
   */
  async send(phoneE164: string, ip: string): Promise<SendOtpOutcome> {
    // --- 1. Cooldown ---
    const cooldownTtl = await this.rl.getCooldownTtl(this.store.cooldownKey(phoneE164));
    if (cooldownTtl > 0) {
      throw new HttpException(
        {
          code: 'OTP_COOLDOWN',
          message: `Please wait ${cooldownTtl}s before requesting another OTP.`,
          details: { retryAfterSec: cooldownTtl },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // --- 2. Phone hourly limit ---
    const phoneRl = await this.rl.hit(
      this.store.phoneRlKey(phoneE164),
      this.cfg.hourlyRequestLimit,
      this.cfg.hourlyWindowSeconds,
    );
    if (!phoneRl.allowed) {
      throw new HttpException(
        {
          code: 'OTP_PHONE_RATE_LIMIT',
          message: 'Too many OTP requests for this number. Try again later.',
          details: { retryAfterSec: phoneRl.retryAfterSec },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // --- 3. IP hourly limit (fraud protection) ---
    const ipRl = await this.rl.hit(
      this.store.ipRlKey(ip),
      this.cfg.ipHourlyLimit,
      this.cfg.hourlyWindowSeconds,
    );
    if (!ipRl.allowed) {
      throw new HttpException(
        {
          code: 'OTP_IP_RATE_LIMIT',
          message: 'Too many requests from this network. Try again later.',
          details: { retryAfterSec: ipRl.retryAfterSec },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // --- 4. Generate + persist ---
    const otp = generateNumericOtp(this.cfg.length);
    const requestId = randomUUID();
    await this.store.save(
      phoneE164,
      {
        hash: hashOtp(otp, this.pepper, phoneE164),
        attempts: 0,
        createdAt: Date.now(),
        requestId,
      },
      this.cfg.ttlSeconds,
    );

    // --- 5. Dispatch via provider chain ---
    const provider = await this.dispatch(phoneE164, otp);

    // --- 6. Start cooldown for next send ---
    await this.rl.setCooldown(
      this.store.cooldownKey(phoneE164),
      this.cfg.resendCooldownSeconds,
    );

    return {
      requestId,
      expiresInSec: this.cfg.ttlSeconds,
      resendAvailableInSec: this.cfg.resendCooldownSeconds,
      provider,
    };
  }

  /**
   * Verify an OTP. On success, the record is immediately deleted (single-use).
   * On failure, attempts counter is incremented; exceeding max invalidates.
   */
  async verify(phoneE164: string, otp: string): Promise<VerifyOtpOutcome> {
    const record = await this.store.get(phoneE164);
    if (!record) {
      throw new UnauthorizedException({
        code: 'OTP_NOT_FOUND',
        message: 'No active OTP. Please request a new one.',
      });
    }

    if (record.attempts >= this.cfg.maxVerifyAttempts) {
      await this.store.delete(phoneE164);
      throw new UnauthorizedException({
        code: 'OTP_ATTEMPTS_EXCEEDED',
        message: 'Too many invalid attempts. Please request a new OTP.',
      });
    }

    const candidate = hashOtp(otp, this.pepper, phoneE164);
    if (!safeEqual(candidate, record.hash)) {
      const attempts = await this.store.incrementAttempts(phoneE164);
      const remaining = Math.max(this.cfg.maxVerifyAttempts - attempts, 0);
      throw new UnauthorizedException({
        code: 'OTP_INVALID',
        message: 'Invalid OTP.',
        details: { attemptsRemaining: remaining },
      });
    }

    // Success — invalidate immediately (single-use).
    await this.store.delete(phoneE164);
    return { verified: true, requestId: record.requestId };
  }

  /**
   * Provider chain: MSG91 (if enabled) → Twilio (if enabled) → Dev-log.
   * If the primary throws, we fall back transparently. If every real
   * provider fails, we only fall back to dev-log when configured to.
   */
  private async dispatch(phoneE164: string, otp: string): Promise<string> {
    const chain: SmsProvider[] = [];
    if (this.msg91.enabled) chain.push(this.msg91);
    if (this.twilio.enabled) chain.push(this.twilio);
    if (this.cfg.devLog) chain.push(this.devLog);

    if (chain.length === 0) {
      throw new ServiceUnavailableException({
        code: 'NO_SMS_PROVIDER',
        message: 'No SMS provider is configured.',
      });
    }

    let lastErr: unknown;
    for (const provider of chain) {
      try {
        const result = await provider.sendOtp(phoneE164, otp);
        if (result.accepted) {
          this.logger.log(
            `OTP dispatched via ${provider.name} id=${result.messageId ?? '-'}`,
          );
          return provider.name;
        }
        this.logger.warn(`Provider ${provider.name} rejected: ${JSON.stringify(result.raw)}`);
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `Provider ${provider.name} threw: ${(err as Error).message}`,
        );
      }
    }

    throw new ServiceUnavailableException({
      code: 'SMS_DISPATCH_FAILED',
      message: 'Could not deliver OTP. Please try again.',
      details:
        lastErr instanceof Error ? { reason: lastErr.message } : undefined,
    });
  }
}

// Re-export so the module doesn't need a separate import site.
export { BadRequestException };
