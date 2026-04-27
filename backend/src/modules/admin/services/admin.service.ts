import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WalletService } from '../../wallet/services/wallet.service';
import { AuditService } from '../../audit/services/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService,
  ) {}

  // ------- Users -------
  async listUsers(q: { search?: string; role?: string; banned?: boolean; limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(q.limit ?? 30, 1), 200);
    const where: any = {};
    if (q.role) where.role = q.role;
    if (q.banned === true) where.bannedAt = { not: null };
    if (q.banned === false) where.bannedAt = null;
    if (q.search?.trim()) {
      const s = q.search.trim();
      where.OR = [
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { displayName: { contains: s, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: { id: true, email: true, phone: true, displayName: true, role: true, bannedAt: true, createdAt: true, lastLoginAt: true },
    });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, -1) : rows, nextCursor: hasMore ? rows[limit - 1].id : null };
  }

  async banUser(adminId: string, userId: string, reason: string, meta: { ip?: string; userAgent?: string }) {
    if (!reason?.trim()) throw new BadRequestException({ code: 'REASON_REQUIRED' });
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (u.role === 'admin') throw new BadRequestException({ code: 'CANNOT_BAN_ADMIN' });
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bannedAt: new Date(), banReason: reason },
    });
    await this.prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ adminId, action: 'user.ban', targetType: 'user', targetId: userId, diff: { reason }, ...meta });
    return updated;
  }

  async unbanUser(adminId: string, userId: string, meta: { ip?: string; userAgent?: string }) {
    const updated = await this.prisma.user.update({
      where: { id: userId }, data: { bannedAt: null, banReason: null },
    });
    await this.audit.log({ adminId, action: 'user.unban', targetType: 'user', targetId: userId, ...meta });
    return updated;
  }

  // ------- Auctions -------
  async listAuctions(q: { status?: string; sellerId?: string; limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(q.limit ?? 30, 1), 200);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.sellerId) where.sellerId = q.sellerId;
    const rows = await this.prisma.auction.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, -1) : rows, nextCursor: hasMore ? rows[limit - 1].id : null };
  }

  async cancelAuction(adminId: string, auctionId: string, reason: string, meta: { ip?: string; userAgent?: string }) {
    const a = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!a) throw new NotFoundException({ code: 'AUCTION_NOT_FOUND' });
    if (a.status === 'ended') throw new BadRequestException({ code: 'ALREADY_ENDED' });
    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'cancelled', endedAt: new Date() },
    });
    // Release all active holds
    const activeHolds = await this.prisma.walletHold.findMany({ where: { auctionId, status: 'active' } });
    for (const h of activeHolds) {
      await this.wallet.releaseHold(h.id).catch(() => undefined);
    }
    await this.audit.log({ adminId, action: 'auction.cancel', targetType: 'auction', targetId: auctionId, diff: { reason, releasedHolds: activeHolds.length }, ...meta });
    return updated;
  }

  // ------- Wallet ledger (cross-user) -------
  /**
   * Cross-user wallet ledger. Used by the admin Transactions page.
   * Filters by type (credit/debit/hold/release/refund), userId, or
   * referenceType (e.g. only bid or only proof). Cursor-paginated.
   */
  async listWalletEntries(q: {
    type?: string;
    userId?: string;
    referenceType?: string;
    limit?: number;
    cursor?: string;
  } = {}) {
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 500);
    const where: any = {};
    if (q.type) where.type = q.type;
    if (q.referenceType) where.referenceType = q.referenceType;
    if (q.userId) where.wallet = { userId: q.userId };
    const rows = await this.prisma.walletEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: {
        wallet: {
          select: {
            userId: true,
            user: { select: { email: true, phone: true, displayName: true } },
          },
        },
      },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((r: any) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      note: r.note,
      createdAt: r.createdAt,
      userId: r.wallet?.userId ?? null,
      userEmail: r.wallet?.user?.email ?? null,
      userPhone: r.wallet?.user?.phone ?? null,
      userName: r.wallet?.user?.displayName ?? null,
    }));
    return { items, nextCursor: hasMore ? rows[limit - 1].id : null };
  }

  // ------- Bids (flag suspicious) -------
  async listBids(q: { auctionId?: string; userId?: string; limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 500);
    const where: any = {};
    if (q.auctionId) where.auctionId = q.auctionId;
    if (q.userId) where.userId = q.userId;
    const rows = await this.prisma.bid.findMany({
      where, orderBy: { placedAt: 'desc' }, take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, -1) : rows, nextCursor: hasMore ? rows[limit - 1].id : null };
  }

  /** Detect shill-bidding candidates: rapid same-user bursts, self-outbids, etc. */
  async detectSuspicious(auctionId: string) {
    const bids = await this.prisma.bid.findMany({
      where: { auctionId }, orderBy: { placedAt: 'asc' },
    });
    const flags: Array<{ type: string; detail: any }> = [];
    const userBidCounts: Record<string, number> = {};
    for (const b of bids) userBidCounts[b.userId] = (userBidCounts[b.userId] ?? 0) + 1;
    for (const [uid, count] of Object.entries(userBidCounts)) {
      if (count > Math.max(3, bids.length * 0.5)) flags.push({ type: 'DOMINANT_BIDDER', detail: { userId: uid, count } });
    }
    // Rapid-fire within 1s
    for (let i = 1; i < bids.length; i++) {
      if (bids[i].userId === bids[i - 1].userId && (bids[i].placedAt.getTime() - bids[i - 1].placedAt.getTime()) < 1000) {
        flags.push({ type: 'RAPID_SAME_USER', detail: { bidIds: [bids[i - 1].id, bids[i].id] } });
      }
    }
    return { total: bids.length, flags };
  }

  // ------- Wallet (admin ops) -------
  async getUserWallet(userId: string) {
    const bal = await this.wallet.getBalance(userId);
    const entries = await this.wallet.listEntries(userId, { limit: 50 });
    return { balance: bal, entries };
  }

  async refund(adminId: string, userId: string, amount: number, note: string, meta: { ip?: string; userAgent?: string }) {
    if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestException({ code: 'INVALID_AMOUNT' });
    if (!note?.trim()) throw new BadRequestException({ code: 'NOTE_REQUIRED' });
    const { entry } = await this.wallet.credit({
      userId, amount, idempotencyKey: `refund-${adminId}-${Date.now()}`,
      type: 'refund', note, referenceType: 'admin_refund', referenceId: adminId,
    });
    await this.audit.log({ adminId, action: 'wallet.refund', targetType: 'user', targetId: userId, diff: { amount, note }, ...meta });
    return entry;
  }

  // ------- Listing review queue -------

  /**
   * List auctions waiting for review. New seller-submitted listings land
   * with reviewStatus='pending' and are invisible to buyers until an
   * admin approves them here.
   */
  async listPendingReviews(q: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(q.limit ?? 30, 1), 200);
    const rows = await this.prisma.auction.findMany({
      where: { reviewStatus: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    return {
      items: hasMore ? rows.slice(0, -1) : rows,
      nextCursor: hasMore ? rows[limit - 1].id : null,
    };
  }

  async approveAuction(adminId: string, auctionId: string, meta: { ip?: string; userAgent?: string }) {
    const a = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!a) throw new NotFoundException({ code: 'AUCTION_NOT_FOUND' });
    if (a.reviewStatus === 'approved') return a;
    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: { reviewStatus: 'approved', reviewedAt: new Date(), reviewedById: adminId, reviewNote: null },
    });
    await this.audit.log({
      adminId, action: 'auction.approve', targetType: 'auction', targetId: auctionId, ...meta,
    });
    return updated;
  }

  async rejectAuction(
    adminId: string, auctionId: string, note: string, meta: { ip?: string; userAgent?: string },
  ) {
    if (!note?.trim()) throw new BadRequestException({ code: 'NOTE_REQUIRED' });
    const a = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!a) throw new NotFoundException({ code: 'AUCTION_NOT_FOUND' });
    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: { reviewStatus: 'rejected', reviewedAt: new Date(), reviewedById: adminId, reviewNote: note.slice(0, 500) },
    });
    await this.audit.log({
      adminId, action: 'auction.reject', targetType: 'auction', targetId: auctionId, diff: { note }, ...meta,
    });
    return updated;
  }

  // ------- Stats dashboard -------
  async stats() {
    const [userCount, auctionCount, liveCount, bidCount, holdsSum] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.auction.count(),
      this.prisma.auction.count({ where: { status: 'live' } }),
      this.prisma.bid.count(),
      this.prisma.walletHold.aggregate({ _sum: { amount: true }, where: { status: 'active' } }),
    ]);
    return {
      users: userCount,
      auctions: auctionCount,
      liveAuctions: liveCount,
      totalBids: bidCount,
      holdsLocked: holdsSum._sum.amount ?? 0,
    };
  }
}
