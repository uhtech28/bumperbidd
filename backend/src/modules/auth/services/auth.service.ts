import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CountryCode } from 'libphonenumber-js';
import { REDIS_CLIENT } from '../../../redis/redis.module';
import { AppConfig } from '../../../config/app.config';
import { normalizePhone, NormalizedPhone } from '../../../utils/phone.util';
import { OtpService } from '../../otp/services/otp.service';
import { UsersService, User } from '../../users/users.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { randomUUID } from 'crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

interface JwtPayload {
  sub: string;
  phone?: string | null;
  email?: string | null;
  provider: 'phone' | 'email' | 'both';
  type: 'access' | 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly cfg: AppConfig['jwt'];

  constructor(
    private readonly otp: OtpService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {
    this.cfg = config.get<AppConfig['jwt']>('jwt')!;
  }

  // ---------- phone helpers ----------

  parsePhone(raw: string, country?: string): NormalizedPhone {
    try {
      return normalizePhone(raw, (country as CountryCode) ?? 'IN');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'INVALID_PHONE';
      throw new BadRequestException({
        code: msg,
        message:
          msg === 'NON_MOBILE_PHONE'
            ? 'Only mobile numbers are supported.'
            : 'The phone number is not valid.',
      });
    }
  }

  // ---------- phone / OTP flow ----------

  async sendOtp(raw: string, country: string | undefined, ip: string) {
    const phone = this.parsePhone(raw, country);
    const outcome = await this.otp.send(phone.e164, ip);
    return {
      phone: phone.e164,
      ...outcome,
    };
  }

  async verifyAndLogin(
    raw: string,
    country: string | undefined,
    otp: string,
  ): Promise<{ user: User & { isNew: boolean }; tokens: TokenPair }> {
    const phone = this.parsePhone(raw, country);
    await this.otp.verify(phone.e164, otp);
    const user = await this.users.findOrCreateByPhone(phone.e164);
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  // ---------- email / password flow ----------

  async emailSignup(
    email: string,
    password: string,
  ): Promise<{ user: User & { isNew: boolean }; tokens: TokenPair }> {
    const user = await this.users.createWithEmail(email, password);
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async emailLogin(
    email: string,
    password: string,
  ): Promise<{ user: User & { isNew: boolean }; tokens: TokenPair }> {
    const user = await this.users.verifyEmailCredentials(email, password);
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  // ---------- Refresh / logout ----------

  /**
   * Validate an inbound refresh token, rotate the jti (old one is deleted,
   * a fresh one is issued), and return a new token pair. If the jti is not
   * in Redis the refresh is rejected — this is how "logout everywhere"
   * works, and is also the defence against a stolen refresh token being
   * replayed after the legitimate user has already rotated.
   */
  async rotateRefresh(
    refreshToken: string,
  ): Promise<{ user: User & { isNew: boolean }; tokens: TokenPair }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const key = this.refreshKey(payload.sub, payload.jti);
    // DEL is atomic and returns the number of keys removed. If two refresh
    // calls race with the same jti, only one will get 1 — the other gets 0
    // and is rejected. This closes the TOCTOU hole that a GET-then-DEL
    // sequence would leave open (both callers could otherwise pass the
    // "exists" check before either DEL ran).
    const removed = await this.redis.del(key);
    if (removed === 0) {
      throw new UnauthorizedException({
        code: 'REFRESH_REVOKED',
        message: 'Session has expired. Please sign in again.',
      });
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'Account no longer exists.',
      });
    }
    const withFlag: User & { isNew: boolean } = { ...user, isNew: false };
    const tokens = await this.issueTokens(withFlag);
    return { user: withFlag, tokens };
  }

  /**
   * Revoke the refresh jti so it cannot be rotated again. Safe to call
   * with an expired / invalid token — we treat logout as idempotent.
   */
  async revokeRefresh(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    try {
      const payload = await this.verifyRefreshToken(refreshToken, {
        ignoreExpiration: true,
      });
      await this.redis.del(this.refreshKey(payload.sub, payload.jti));
      // Mirror in Postgres so the session disappears from /account/security.
      await this.prisma.userSession
        .updateMany({
          where: { refreshJti: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch(() => undefined);
    } catch {
      // Token was garbage - nothing to revoke. Still treat as success.
    }
  }

  /**
   * List active sessions for a user, freshest first. Excludes revoked
   * and expired rows. The "current" session is flagged so the UI can
   * disable the revoke button on it (logging yourself out has its own
   * dedicated button).
   */
  async listSessions(userId: string, currentJti: string | null) {
    const rows = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      lastSeenAt: r.lastSeenAt,
      expiresAt: r.expiresAt,
      ip: r.ip,
      userAgent: r.userAgent,
      device: r.device,
      isCurrent: currentJti != null && r.refreshJti === currentJti,
    }));
  }

  /**
   * Revoke a specific session (different device / browser). Verifies
   * the session belongs to the caller before flipping revokedAt and
   * removing the Redis jti so the rotated token can't refresh.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const row = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });
    if (!row || row.userId !== userId) {
      throw new UnauthorizedException({ code: 'SESSION_NOT_FOUND' });
    }
    if (row.revokedAt) return;
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await this.redis.del(this.refreshKey(userId, row.refreshJti)).catch(() => undefined);
  }

  // ---------- JWT issuance ----------

  /**
   * Build an access + refresh token pair for `user`. Claims include the
   * primary id, available handles (phone / email), and the provider used
   * for the current session. Refresh `jti` is persisted in Redis so it can
   * be revoked on logout / rotation.
   */
  private async issueTokens(user: User): Promise<TokenPair> {
    const jti = randomUUID();
    const basePayload = {
      sub: user.id,
      phone: user.phone,
      email: user.email,
      provider: user.provider,
    };
    const accessToken = await this.jwt.signAsync(
      { ...basePayload, type: 'access' },
      { secret: this.cfg.secret, expiresIn: this.cfg.accessTtl, jwtid: jti },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...basePayload, type: 'refresh' },
      { secret: this.cfg.secret, expiresIn: this.cfg.refreshTtl, jwtid: jti },
    );
    const refreshTtlSec = this.ttlToSeconds(this.cfg.refreshTtl);
    await this.redis.set(
      this.refreshKey(user.id, jti),
      '1',
      'EX',
      refreshTtlSec,
    );
    // Mirror the session in Postgres so the user can list / revoke their
    // active devices from /account/security and admins can audit logins.
    // Best-effort: we don't fail token issuance if this insert fails.
    await this.prisma.userSession
      .create({
        data: {
          userId: user.id,
          refreshJti: jti,
          expiresAt: new Date(Date.now() + refreshTtlSec * 1000),
        },
      })
      .catch(() => undefined);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.cfg.accessTtl,
    };
  }

  private async verifyRefreshToken(
    token: string,
    opts: { ignoreExpiration?: boolean } = {},
  ): Promise<JwtPayload> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.cfg.secret,
        ignoreExpiration: opts.ignoreExpiration ?? false,
      });
      if (payload.type !== 'refresh' || !payload.jti) {
        throw new UnauthorizedException({
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is malformed.',
        });
      }
      return payload;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired.',
      });
    }
  }

  private refreshKey(userId: string, jti: string): string {
    return `auth:refresh:${userId}:${jti}`;
  }

  private ttlToSeconds(ttl: string): number {
    const m = ttl.match(/^(\d+)([smhd])$/);
    if (!m) return 900;
    const v = Number(m[1]);
    const unit = m[2];
    return unit === 's' ? v : unit === 'm' ? v * 60 : unit === 'h' ? v * 3600 : v * 86400;
  }
}
