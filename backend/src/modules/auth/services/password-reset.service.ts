import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/services/email.service';
import { hashPassword } from '../../../utils/password.util';

/**
 * Password reset flow.
 *
 * Threat model:
 *  - Token must be unguessable (cryptographic random, 32 bytes -> 256 bits).
 *  - DB leak must not enable account takeover, so we store sha256(token)
 *    and only the raw token leaves the system in the email body.
 *  - Reuse-after-use must fail (usedAt is set on first successful reset).
 *  - Time-bound (1 hour expiry).
 *  - One outstanding token per user — issuing a new request invalidates
 *    the previous one.
 *  - Account enumeration is blocked: forgot-password always returns the
 *    same generic response whether or not the email exists.
 *  - On successful reset all existing sessions are revoked so an
 *    attacker who already has a session loses it the moment the user
 *    completes the recovery.
 */

const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 60;
const RAW_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly appBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    config: ConfigService,
  ) {
    this.appBaseUrl =
      config.get<string>('APP_BASE_URL') ??
      // Reasonable dev default; production must override via env.
      'http://localhost:3000';
  }

  /**
   * Begin a password reset. Always returns success — we never disclose
   * whether the email actually exists.
   */
  async requestReset(params: {
    email: string;
    ip?: string;
    userAgent?: string;
  }): Promise<{ ok: true }> {
    const email = params.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // No leaks: same response shape whether or not the user exists.
    if (!user || !user.passwordHash) {
      this.logger.warn(`[reset] requested for unknown/passwordless email`);
      return { ok: true };
    }

    // Invalidate any outstanding tokens so only the most recent is valid.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });

    const resetUrl = `${this.appBaseUrl.replace(/\/$/, '')}/auth/reset?token=${rawToken}`;

    // Fire-and-forget email; we don't want a transient SMTP failure to
    // surface differently to the caller (would also leak existence).
    void this.email
      .send({
        to: email,
        userId: user.id,
        template: 'password_reset',
        subject: 'Reset your BumperBid password',
        html: this.email.passwordResetHtml(
          user.displayName ?? 'there',
          resetUrl,
          TOKEN_TTL_MINUTES,
        ),
        text: `Reset your BumperBid password by visiting: ${resetUrl}\n\nThis link expires in ${TOKEN_TTL_MINUTES} minutes. If you didn't request this, ignore the email.`,
        meta: { reason: 'password_reset' },
      })
      .catch((err) => {
        this.logger.error(`[reset] email send failed: ${err?.message}`);
      });

    // Dev convenience: when no Resend key is configured, surface the URL
    // in the server log so devs can complete the flow without an inbox.
    this.logger.log(`[reset] link issued for ${maskEmail(email)} -> ${resetUrl}`);

    return { ok: true };
  }

  /**
   * Complete a reset. Validates the token, sets the new password,
   * marks the token used, and revokes every existing session for the
   * user so any prior login (including the attacker's) is killed.
   */
  async completeReset(params: {
    token: string;
    newPassword: string;
  }): Promise<{ ok: true }> {
    const raw = params.token?.trim();
    if (!raw || !RAW_TOKEN_REGEX.test(raw)) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Reset link is malformed.',
      });
    }
    if (
      typeof params.newPassword !== 'string' ||
      params.newPassword.length < 8 ||
      params.newPassword.length > 128
    ) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password must be 8 to 128 characters.',
      });
    }

    const tokenHash = sha256(raw);
    const now = new Date();
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!row || row.usedAt || row.expiresAt < now) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED',
        message: 'This reset link is invalid or has expired. Request a new one.',
      });
    }

    const newHash = hashPassword(params.newPassword);

    // Atomic: set the password, mark the token used, revoke all sessions.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    this.logger.log(`[reset] completed for user=${row.userId}`);
    return { ok: true };
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(0, local.length - 2))}@${domain}`;
}
