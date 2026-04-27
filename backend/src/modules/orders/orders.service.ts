import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Post-auction lifecycle.
 *
 * When an auction ends with a winner above reserve, an Order row is
 * created. The order tracks payment, delivery, escrow release, and any
 * disputes raised after delivery.
 *
 * Buyer-side surface: GET /orders/me/wins - things I won.
 * Seller-side surface: GET /orders/me/sales - things I sold.
 * Either party can file a dispute up to N days after delivery.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Materialise an Order for a freshly-ended auction. Idempotent on
   * (auctionId, buyerId, sellerId) — re-runs return the existing row.
   * Called by the auctions lifecycle scheduler the moment an auction
   * transitions to `ended` with a winner.
   */
  async finalizeFromAuction(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException({ code: 'AUCTION_NOT_FOUND' });
    if (!auction.winnerId || !auction.finalPrice) {
      // No winner (no bids or below reserve). Nothing to materialise.
      return null;
    }
    const existing = await this.prisma.order.findFirst({
      where: { auctionId, buyerId: auction.winnerId },
    });
    if (existing) return existing;

    const order = await this.prisma.order.create({
      data: {
        auctionId,
        buyerId: auction.winnerId,
        sellerId: auction.sellerId,
        finalPrice: auction.finalPrice,
      },
    });
    this.logger.log(`order created id=${order.id} auction=${auctionId}`);
    return order;
  }

  // ---------- Buyer / seller views ----------

  async listWins(userId: string, limit = 30, cursor?: string) {
    return this.list({ buyerId: userId }, limit, cursor);
  }

  async listSales(userId: string, limit = 30, cursor?: string) {
    return this.list({ sellerId: userId }, limit, cursor);
  }

  private async list(
    where: { buyerId?: string; sellerId?: string },
    limit: number,
    cursor?: string,
  ) {
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        auction: {
          select: {
            id: true,
            title: true,
            imageUrls: true,
            make: true,
            modelName: true,
            year: true,
            city: true,
            endedAt: true,
          },
        },
      },
    });
    const hasMore = rows.length > limit;
    return {
      items: hasMore ? rows.slice(0, -1) : rows,
      nextCursor: hasMore ? rows[limit - 1].id : null,
    };
  }

  async getById(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { auction: true, disputes: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException({ code: 'NOT_YOUR_ORDER' });
    }
    return order;
  }

  // ---------- Disputes ----------

  async fileDispute(
    orderId: string,
    raisedById: string,
    payload: { reason: string; details: string; evidenceUrls?: string[] },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    if (order.buyerId !== raisedById && order.sellerId !== raisedById) {
      throw new ForbiddenException({ code: 'NOT_YOUR_ORDER' });
    }
    if (order.escrowReleasedAt) {
      throw new BadRequestException({
        code: 'ESCROW_ALREADY_RELEASED',
        message: 'Escrow has been released. Disputes are no longer accepted.',
      });
    }
    const dispute = await this.prisma.dispute.create({
      data: {
        orderId,
        raisedById,
        reason: payload.reason.slice(0, 60),
        details: payload.details.slice(0, 4000),
        evidenceUrls: (payload.evidenceUrls ?? []).slice(0, 8),
      },
    });
    await this.prisma.order.update({
      where: { id: orderId },
      data: { deliveryStatus: 'disputed' },
    });
    return dispute;
  }
}
