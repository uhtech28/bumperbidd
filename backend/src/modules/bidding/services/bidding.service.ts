import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';
import { PrismaService } from '../../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../../redis/redis.module';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { WalletService } from '../../wallet/services/wallet.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuctionStatus } from '@prisma/client';

type LuaResultOk = {
  ok: true;
  prevHighBid: number;
  prevHighBidderId: string | null;
  newHighBid: number;
  newHighBidderId: string;
  version: number;
  endsAt: number;
  extended: boolean;
};
type LuaResultErr = {
  ok: false;
  reason: string;
  requiredMin?: number;
  currentHighBid?: number;
  status?: string;
  highBid?: number;
};
type LuaResult = LuaResultOk | LuaResultErr;

/**
 * BiddingService — the critical real-time bid processor.
 *
 * Flow:
 *   1) Reserve funds on the bidder's wallet (atomic Postgres tx).
 *   2) Run place-bid.lua in Redis — atomic; either wins the top-of-book
 *      or is rejected with a reason.
 *   3) If won: release the outbid user's hold, persist Bid row,
 *      broadcast via WS, notify loser, mirror Redis->Postgres.
 *   4) If rejected: release the hold we just took.
 *
 * Concurrency: the Lua script runs atomically — concurrent bids from
 * 1000 users on the same auction are serialized inside Redis and each
 * sees a consistent view of the top of book.
 */
@Injectable()
export class BiddingService {
  private readonly log = new Logger(BiddingService.name);
  private readonly luaScript: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly gateway: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {
    this.luaScript = fs.readFileSync(
      path.join(__dirname, '..', 'lua', 'place-bid.lua'),
      'utf8',
    );
  }

  private stateKey(auctionId: string): string {
    return `auction:${auctionId}:state`;
  }
  private bidsKey(auctionId: string): string {
    return `auction:${auctionId}:bids`;
  }

  /**
   * Called by AuctionsService when an auction goes live. Seeds the
   * Redis hash so the Lua script can operate on it. Idempotent.
   */
  async primeLiveAuction(params: {
    auctionId: string;
    startingPrice: number;
    minIncrement: number;
    endsAt: number;
    startsAt?: number;
  }): Promise<void> {
    const key = this.stateKey(params.auctionId);
    const startsAt = params.startsAt ?? Date.now();
    await this.redis
      .multi()
      .hset(key, {
        status: 'live',
        startsAt,
        endsAt: params.endsAt,
        minIncrement: params.minIncrement,
        startingPrice: params.startingPrice,
        highBid: 0,
        highBidderId: '',
        version: 0,
      })
      .pexpireat(key, params.endsAt + 5 * 60_000)
      .exec();
  }

  /**
   * Marks the auction ended in Redis so subsequent bids are rejected.
   */
  async markEnded(auctionId: string): Promise<void> {
    await this.redis.hset(this.stateKey(auctionId), 'status', 'ended');
  }

  async placeBid(params: {
    auctionId: string;
    userId: string;
    amount: number;
  }): Promise<{
    bidId: string;
    newHighBid: number;
    endsAt: number;
    extended: boolean;
  }> {
    const { auctionId, userId, amount } = params;
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_BID_AMOUNT',
        message: 'Bid amount must be a positive integer (paisa).',
      });
    }

    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        sellerId: true,
        status: true,
        minIncrement: true,
      },
    });
    if (!auction) {
      throw new NotFoundException({
        code: 'AUCTION_NOT_FOUND',
        message: 'Auction does not exist.',
      });
    }
    if (auction.sellerId === userId) {
      throw new BadRequestException({
        code: 'CANNOT_BID_ON_OWN_AUCTION',
        message: 'You cannot bid on your own auction.',
      });
    }

    // Reserve funds — throws if insufficient balance.
    const hold = await this.wallet.placeHold({
      userId,
      auctionId,
      amount,
    });

    let luaResult: LuaResult;
    const bidId = randomUUID();
    try {
      const rawResult = await this.redis.eval(
        this.luaScript,
        2,
        this.stateKey(auctionId),
        this.bidsKey(auctionId),
        bidId,
        userId,
        String(amount),
        String(Date.now()),
      );
      luaResult = JSON.parse(rawResult as string) as LuaResult;
    } catch (e) {
      await this.wallet.releaseHold(hold.id).catch(() => void 0);
      this.log.error(`Redis EVAL failed: ${(e as Error).message}`);
      throw new ConflictException({
        code: 'BIDDING_ENGINE_ERROR',
        message: 'Bid engine unavailable — please retry.',
      });
    }

    if (!luaResult.ok) {
      await this.wallet.releaseHold(hold.id).catch(() => void 0);
      const reason = luaResult.reason;
      if (reason === 'AMOUNT_TOO_LOW') {
        throw new BadRequestException({
          code: 'BID_TOO_LOW',
          message: `Bid must be at least ₹${((luaResult.requiredMin ?? 0) / 100).toFixed(0)}.`,
          details: {
            requiredMin: luaResult.requiredMin,
            currentHighBid: luaResult.currentHighBid,
          },
        });
      }
      if (reason === 'ALREADY_HIGHEST_BIDDER') {
        throw new ConflictException({
          code: 'ALREADY_HIGHEST_BIDDER',
          message: 'You are already the highest bidder.',
        });
      }
      if (reason === 'AUCTION_NOT_LIVE' || reason === 'AUCTION_NOT_STARTED') {
        throw new ConflictException({
          code: 'AUCTION_NOT_LIVE',
          message: 'This auction is not accepting bids right now.',
        });
      }
      if (reason === 'AUCTION_ENDED') {
        throw new ConflictException({
          code: 'AUCTION_ENDED',
          message: 'This auction has ended.',
        });
      }
      throw new BadRequestException({
        code: reason,
        message: 'Bid rejected.',
      });
    }

    const prevHolderId = luaResult.prevHighBidderId;
    const prevHighBid = luaResult.prevHighBid;

    // Append-only Bid row
    await this.prisma.bid
      .create({
        data: {
          id: bidId,
          auctionId,
          userId,
          amount: luaResult.newHighBid,
        },
      })
      .catch((err: any) =>
        this.log.warn(`Bid row persist failed: ${(err as Error).message}`),
      );

    // Release the previous leader's hold now that they're outbid.
    if (prevHolderId && prevHolderId !== '' && prevHolderId !== userId && prevHighBid > 0) {
      await this.wallet
        .releaseActiveHoldForAuction({
          userId: prevHolderId,
          auctionId,
        })
        .catch((err: any) =>
          this.log.warn(
            `Failed to release prev holder ${prevHolderId}: ${(err as Error).message}`,
          ),
        );
    }

    // Mirror to Postgres (fire-and-forget — Redis is authority during live)
    this.prisma.auction
      .update({
        where: { id: auctionId },
        data: {
          currentHighBid: luaResult.newHighBid,
          currentHighBidderId: userId,
          bidCount: { increment: 1 },
          endsAt: new Date(luaResult.endsAt),
        },
      })
      .catch((err: any) =>
        this.log.warn(
          `Failed to mirror auction state to Postgres: ${(err as Error).message}`,
        ),
      );

    // WS broadcast
    this.gateway.broadcastBid({
      auctionId,
      bidId,
      userId,
      amount: luaResult.newHighBid,
      version: luaResult.version,
      endsAt: luaResult.endsAt,
      extended: luaResult.extended,
    });

    // Notify outbid user
    if (prevHolderId && prevHolderId !== '' && prevHolderId !== userId) {
      this.notifications
        .create({
          userId: prevHolderId,
          type: 'outbid',
          title: 'You were outbid',
          body: 'Someone placed a higher bid on an auction you were leading.',
          auctionId,
        })
        .catch(() => void 0);
    }

    return {
      bidId,
      newHighBid: luaResult.newHighBid,
      endsAt: luaResult.endsAt,
      extended: luaResult.extended,
    };
  }

  async getLiveState(auctionId: string): Promise<{
    status: string;
    highBid: number;
    highBidderId: string | null;
    endsAt: number;
    version: number;
    minIncrement: number;
    startingPrice: number;
  } | null> {
    const raw = await this.redis.hgetall(this.stateKey(auctionId));
    if (!raw || !raw.status) return null;
    return {
      status: raw.status,
      highBid: Number(raw.highBid) || 0,
      highBidderId: raw.highBidderId && raw.highBidderId !== '' ? raw.highBidderId : null,
      endsAt: Number(raw.endsAt) || 0,
      version: Number(raw.version) || 0,
      minIncrement: Number(raw.minIncrement) || 0,
      startingPrice: Number(raw.startingPrice) || 0,
    };
  }

  /**
   * Finalize an ended auction. Picks the winner from Redis, captures
   * the winning hold, writes outcome to Postgres, notifies winner,
   * broadcasts `auction:ended`.
   *
   * Safe to call multiple times — guarded by the Postgres status check.
   */
  async finalize(auctionId: string): Promise<void> {
    const state = await this.getLiveState(auctionId);
    const winnerId = state && state.highBidderId ? state.highBidderId : null;
    const finalPrice = state && state.highBid > 0 ? state.highBid : null;

    await this.markEnded(auctionId).catch(() => void 0);

    const result: any = await this.prisma.$transaction(async (tx: any) => {
      const current = await tx.auction.findUnique({
        where: { id: auctionId },
        select: { status: true, reservePrice: true },
      });
      if (!current) return { already: true };
      if (current.status !== 'live') return { already: true };

      // If reserve not met, end without winner — release the top hold.
      const reserveMet =
        current.reservePrice == null ||
        (finalPrice != null && finalPrice >= current.reservePrice);

      await tx.auction.update({
        where: { id: auctionId },
        data: {
          status: 'ended' as AuctionStatus,
          winnerId: reserveMet ? winnerId : null,
          finalPrice: reserveMet ? finalPrice : null,
          endedAt: new Date(),
        },
      });

      return { already: false, reserveMet };
    });

    if (result.already) return;

    if (!result.reserveMet) {
      // Reserve not met — release any active hold for the highBidder too.
      if (winnerId) {
        await this.wallet
          .releaseActiveHoldForAuction({ userId: winnerId, auctionId })
          .catch(() => void 0);
      }
      this.gateway.broadcastAuctionEnded({
        auctionId,
        winnerId: null,
        finalPrice: 0,
      });
      return;
    }

    if (winnerId && finalPrice) {
      await this.wallet
        .captureHold({ userId: winnerId, auctionId })
        .catch((err: any) =>
          this.log.error(
            `captureHold failed for ${winnerId}/${auctionId}: ${(err as Error).message}`,
          ),
        );

      await this.notifications
        .create({
          userId: winnerId,
          type: 'auction_won',
          title: 'You won the auction!',
          body: 'Please complete payment confirmation from your dashboard.',
          auctionId,
        })
        .catch(() => void 0);
    }

    this.gateway.broadcastAuctionEnded({
      auctionId,
      winnerId,
      finalPrice: finalPrice ?? 0,
    });
  }
}
