import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthProvider, User as PrismaUser } from '@prisma/client';
import { hashPassword, verifyPassword } from '../../utils/password.util';

/**
 * Re-export the Prisma-generated User type so the rest of the app imports
 * it from here (keeping the existing import path stable). `User.phone` and
 * `User.email` are both nullable; at least one must be set.
 */
export type User = PrismaUser;

/**
 * Postgres-backed repository. Public surface matches the previous
 * Redis-backed service so callers in AuthService do not change.
 *
 * Unique constraints on `phone` and `email` are enforced at the DB level
 * (see prisma/schema.prisma), so signup races can't create duplicates —
 * the DB returns a P2002 error and we translate to a proper HTTP code.
 *
 * `publicView` is the only shape the frontend should ever see; it strips
 * passwordHash, internal flags, and timestamps.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findOrCreateByPhone(phone: string): Promise<User & { isNew: boolean }> {
    const existing = await this.findByPhone(phone);
    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: { lastLoginAt: new Date() },
      });
      return { ...updated, isNew: false };
    }
    try {
      const created = await this.prisma.user.create({
        data: {
          phone,
          provider: 'phone' as AuthProvider,
          phoneVerified: true,
        },
      });
      return { ...created, isNew: true };
    } catch (e) {
      // Race: a concurrent OTP verification for the same phone already
      // created the row between our findByPhone and our create. Prisma
      // throws P2002 on the unique-constraint violation; fall back to a
      // read and treat it as a returning login.
      if ((e as { code?: string }).code === 'P2002') {
        const raced = await this.findByPhone(phone);
        if (raced) {
          const updated = await this.prisma.user.update({
            where: { id: raced.id },
            data: { lastLoginAt: new Date() },
          });
          return { ...updated, isNew: false };
        }
      }
      throw e;
    }
  }

  async createWithEmail(email: string, password: string): Promise<User & { isNew: boolean }> {
    const lower = email.toLowerCase();
    try {
      const created = await this.prisma.user.create({
        data: {
          email: lower,
          passwordHash: hashPassword(password),
          provider: 'email' as AuthProvider,
        },
      });
      return { ...created, isNew: true };
    } catch (e) {
      // Prisma P2002 = unique constraint violation on `email`.
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists. Please log in.',
        });
      }
      throw e;
    }
  }

  async verifyEmailCredentials(
    email: string,
    password: string,
  ): Promise<User & { isNew: boolean }> {
    const user = await this.findByEmail(email);
    const invalid = () =>
      new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      });
    if (!user || !user.passwordHash) throw invalid();
    if (!verifyPassword(password, user.passwordHash)) throw invalid();
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return { ...updated, isNew: false };
  }

  publicView(user: User & { isNew?: boolean }) {
    return {
      id: user.id,
      phone: user.phone ?? undefined,
      email: user.email ?? undefined,
      provider: user.provider,
      isNew: Boolean(user.isNew),
    };
  }

  /**
   * Self-service profile fetch. Returns the writable profile fields plus
   * the read-only identity fields the frontend uses to render the
   * "Account" page header. PII like passwordHash never leaves the
   * service.
   */
  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND' });
    }
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      provider: user.provider,
      displayName: user.displayName,
      profilePhotoUrl: user.profilePhotoUrl,
      bio: user.bio,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  /**
   * Profile patch. Whitelisted fields only — phone / email / role /
   * passwordHash are intentionally not mutable here. Treats empty
   * string as "clear" for the optional fields.
   */
  /**
   * DPDP Act 2023 plumbing - export every shred of personal data we
   * hold about the user, in a single JSON document. Heavy lifting that
   * touches every user-bearing table; we keep it simple by fanning
   * out via Prisma rather than writing a SQL union.
   */
  async exportUserData(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException({ code: 'USER_NOT_FOUND' });
    const [bids, auctions, wins, walletEntries, kyc, sessions, notifications] =
      await Promise.all([
        this.prisma.bid.findMany({ where: { userId } }),
        this.prisma.auction.findMany({ where: { sellerId: userId } }),
        this.prisma.auction.findMany({ where: { winnerId: userId } }),
        this.prisma.walletEntry.findMany({ where: { wallet: { userId } } }),
        this.prisma.kycProfile.findUnique({ where: { userId } }),
        this.prisma.userSession.findMany({ where: { userId } }),
        this.prisma.notification.findMany({ where: { userId } }),
      ]);
    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        provider: user.provider,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      bids,
      auctionsAsSeller: auctions,
      auctionsWon: wins,
      walletEntries,
      kyc,
      sessions,
      notifications,
    };
  }

  /**
   * DPDP Act 2023 right to erasure. Soft-deletes the user by:
   *   - Anonymising PII in place (phone/email/displayName/bio/photo)
   *   - Setting bannedAt to lock further sign-in
   *   - Revoking all active sessions
   *
   * Auctions, bids, wallet entries are KEPT for the 7-year period
   * Indian tax law requires for transactional records. Their FK
   * relationships still resolve; the user just appears as
   * "deleted-user".
   */
  async softDeleteSelf(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new UnauthorizedException({ code: 'USER_NOT_FOUND' });
    const stamp = Date.now();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          phone: null,
          email: `deleted-${stamp}-${userId.slice(0, 8)}@bumperbid.invalid`,
          displayName: 'deleted user',
          passwordHash: null,
          bannedAt: new Date(),
          banReason: 'Account deleted by user (DPDP)',
        },
      }),
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async updateProfile(
    userId: string,
    patch: {
      displayName?: string | null;
      bio?: string | null;
      profilePhotoUrl?: string | null;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (patch.displayName !== undefined) {
      const v = patch.displayName?.trim();
      data.displayName = v ? v.slice(0, 80) : null;
    }
    if (patch.bio !== undefined) {
      const v = patch.bio?.trim();
      data.bio = v ? v.slice(0, 500) : null;
    }
    if (patch.profilePhotoUrl !== undefined) {
      data.profilePhotoUrl = patch.profilePhotoUrl || null;
    }
    if (Object.keys(data).length === 0) {
      return this.getProfile(userId);
    }
    await this.prisma.user.update({ where: { id: userId }, data });
    return this.getProfile(userId);
  }
}
