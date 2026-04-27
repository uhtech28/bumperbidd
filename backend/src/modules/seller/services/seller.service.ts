import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SellerService {
  constructor(private readonly prisma: PrismaService) {}

  async myListings(userId: string, opts: { status?: string; limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const where: any = { sellerId: userId };
    if (opts.status) where.status = opts.status;
    const rows = await this.prisma.auction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, -1) : rows, nextCursor: hasMore ? rows[limit - 1].id : null };
  }

  async stats(userId: string) {
    const [total, won, active, pending] = await Promise.all([
      this.prisma.auction.count({ where: { sellerId: userId } }),
      this.prisma.auction.aggregate({
        where: { sellerId: userId, status: 'ended', winnerId: { not: null } },
        _sum: { finalPrice: true },
        _count: true,
      }),
      this.prisma.auction.count({
        where: { sellerId: userId, status: { in: ['live', 'scheduled'] } },
      }),
      this.prisma.auction.count({
        where: { sellerId: userId, status: 'scheduled' },
      }),
    ]);
    return {
      totalListings: total,
      activeAuctions: active,
      soldCount: won._count,
      totalRevenuePaisa: won._sum.finalPrice ?? 0,
      pendingReview: pending,
    };
  }

  async revenue(userId: string) {
    const won = await this.prisma.auction.aggregate({
      where: { sellerId: userId, status: 'ended', winnerId: { not: null } },
      _sum: { finalPrice: true },
      _count: true,
    });
    const active = await this.prisma.auction.count({
      where: { sellerId: userId, status: { in: ['live', 'scheduled'] } },
    });
    const pending = await this.prisma.auction.count({
      where: { sellerId: userId, status: 'scheduled' },
    });
    return {
      totalRevenue: won._sum.finalPrice ?? 0,
      soldCount: won._count,
      activeListings: active,
      pendingReview: pending,
    };
  }

  async activeAuctions(userId: string) {
    return this.prisma.auction.findMany({
      where: { sellerId: userId, status: 'live' },
      orderBy: { endsAt: 'asc' },
      take: 50,
    });
  }
}
