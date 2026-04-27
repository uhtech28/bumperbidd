import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  add(userId: string, auctionId: string) {
    return this.prisma.watchlist.upsert({
      where: { userId_auctionId: { userId, auctionId } },
      create: { userId, auctionId },
      update: {},
    });
  }

  async remove(userId: string, auctionId: string) {
    await this.prisma.watchlist.deleteMany({ where: { userId, auctionId } });
    return { removed: true };
  }

  async list(userId: string, opts: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const rows = await this.prisma.watchlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { userId_auctionId: { userId, auctionId: opts.cursor } }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, -1) : rows;
    const auctionIds = items.map((r: any) => r.auctionId);
    const auctions = auctionIds.length
      ? await this.prisma.auction.findMany({ where: { id: { in: auctionIds } } })
      : [];
    const byId: Record<string, any> = Object.fromEntries(auctions.map((a: any) => [a.id, a]));
    return {
      items: items.map((r: any) => ({ addedAt: r.createdAt, auction: byId[r.auctionId] })),
      nextCursor: hasMore ? items[items.length - 1].auctionId : null,
    };
  }
}
