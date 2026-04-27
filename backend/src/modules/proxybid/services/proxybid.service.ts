import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * ProxyBidService — user declares a max they're willing to pay; whenever
 * someone else bids, we auto-place a bid = (current + minIncrement) up to
 * the user's max. The bidding engine calls triggerOnOutbid() after every
 * successful bid to cascade auto-bids.
 *
 * We store the max separately from the Bid table so outbid notifications
 * don't fire N times for a proxy bidder — only the final auto-placed bid
 * creates an audit entry.
 */
@Injectable()
export class ProxyBidService {
  private readonly logger = new Logger(ProxyBidService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setMax(userId: string, auctionId: string, maxAmount: number) {
    if (!Number.isInteger(maxAmount) || maxAmount <= 0) {
      throw new BadRequestException({ code: 'INVALID_MAX', message: 'maxAmount must be positive integer paisa.' });
    }
    return this.prisma.proxyBid.upsert({
      where: { auctionId_userId: { auctionId, userId } },
      create: { auctionId, userId, maxAmount, active: true },
      update: { maxAmount, active: true },
    });
  }

  async cancel(userId: string, auctionId: string) {
    await this.prisma.proxyBid.updateMany({
      where: { auctionId, userId },
      data: { active: false },
    });
    return { cancelled: true };
  }

  async mine(userId: string, auctionId: string) {
    return this.prisma.proxyBid.findUnique({
      where: { auctionId_userId: { auctionId, userId } },
    });
  }

  /**
   * Return the next proxy bidder (if any) who is willing to outbid the
   * current high. BiddingService consumes this to cascade bids.
   */
  async nextProxyForAuction(auctionId: string, currentHigh: number, currentBidderId: string | null, minIncrement: number) {
    const next = currentHigh + minIncrement;
    const candidates = await this.prisma.proxyBid.findMany({
      where: {
        auctionId,
        active: true,
        maxAmount: { gte: next },
        ...(currentBidderId ? { userId: { not: currentBidderId } } : {}),
      },
      orderBy: [{ maxAmount: 'desc' }, { createdAt: 'asc' }],
      take: 1,
    });
    return candidates[0] ?? null;
  }
}
