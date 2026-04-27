import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BiddingService } from '../../bidding/services/bidding.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { CreateAuctionDto } from '../dto/create-auction.dto';
import { ListAuctionsDto } from '../dto/list-auctions.dto';
import { AuctionStatus } from '@prisma/client';

/**
 * AuctionsService — lifecycle + CRUD.
 *
 * State machine:
 *   scheduled --(tick >= startsAt)--> live --(tick >= endsAt)--> ended
 *   scheduled/live --(seller cancel)--> cancelled
 *
 * Ticks are driven by a periodic sweep (see tick()). It's idempotent so
 * it's safe to run every few seconds from any number of pods — the DB
 * update uses `updateMany where status=scheduled` which serializes the
 * transition atomically.
 *
 * When an auction goes live:
 *   - We seed Redis live-state via BiddingService.primeLiveAuction()
 *   - Broadcast `auction:started` over WS so open clients can flip UI
 *
 * When an auction's endsAt passes:
 *   - BiddingService.finalize() picks a winner from Redis, captures the
 *     hold, and writes the outcome row in a Prisma transaction.
 */
@Injectable()
export class AuctionsService {
  private readonly log = new Logger(AuctionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bidding: BiddingService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async create(sellerId: string, dto: CreateAuctionDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException({
        code: 'BAD_DATE',
        message: 'startsAt / endsAt must be ISO 8601.',
      });
    }
    if (endsAt.getTime() - startsAt.getTime() < 60_000) {
      throw new BadRequestException({
        code: 'DURATION_TOO_SHORT',
        message: 'Auction must run for at least 60 seconds.',
      });
    }
    if (dto.reservePrice != null && dto.reservePrice < dto.startingPrice) {
      throw new BadRequestException({
        code: 'BAD_RESERVE',
        message: 'reservePrice cannot be below startingPrice.',
      });
    }
    const row = await this.prisma.auction.create({
      data: {
        title: dto.title,
        description: dto.description,
        make: dto.make,
        modelName: dto.modelName,
        year: dto.year,
        kmDriven: dto.kmDriven,
        fuelType: dto.fuelType.toLowerCase(),
        ownerCount: dto.ownerCount ?? 1,
        city: dto.city,
        imageUrls: dto.imageUrls,
        startingPrice: dto.startingPrice,
        minIncrement: dto.minIncrement ?? 1_000,
        reservePrice: dto.reservePrice ?? null,
        startsAt,
        endsAt,
        sellerId,
        status: 'scheduled' as AuctionStatus,
        currentHighBid: dto.startingPrice,
      },
    });
    this.log.log(`auction created id=${row.id} seller=${sellerId}`);
    return this.toPublic(row);
  }

  async list(opts: ListAuctionsDto) {
    const limit = Math.min(opts.limit ?? 24, 100);
    const where: Record<string, unknown> = {};
    if (opts.status) where.status = opts.status;
    if (opts.city) where.city = opts.city;
    if (opts.make) where.make = opts.make;
    const rows = await this.prisma.auction.findMany({
      where,
      orderBy: [{ status: 'asc' }, { endsAt: 'asc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const next = rows.pop()!;
      nextCursor = next.id;
    }
    return {
      items: rows.map((r: any) => this.toPublic(r)),
      nextCursor,
    };
  }

  async get(id: string) {
    const row = await this.prisma.auction.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        code: 'AUCTION_NOT_FOUND',
        message: 'No auction with that id.',
      });
    }
    return this.toPublic(row);
  }

  async cancel(id: string, userId: string) {
    const row = await this.prisma.auction.findUnique({ where: { id } });
    if (!row)
      throw new NotFoundException({ code: 'AUCTION_NOT_FOUND' });
    if (row.sellerId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_SELLER',
        message: 'Only the seller can cancel this auction.',
      });
    }
    if (row.status === 'ended' || row.status === 'cancelled') {
      throw new BadRequestException({
        code: 'ALREADY_CLOSED',
        message: 'Auction already closed.',
      });
    }
    await this.prisma.auction.update({
      where: { id },
      data: { status: 'cancelled' as AuctionStatus, endedAt: new Date() },
    });
    await this.bidding.markEnded(id).catch(() => void 0);
    return { ok: true };
  }

  /**
   * Periodic sweep. Should be invoked every 1-5 seconds by a worker.
   * Idempotent — only transitions rows whose clock has actually passed.
   */
  async tick(): Promise<{ started: number; ended: number }> {
    const now = new Date();

    // ---- scheduled → live ----
    const toStart = await this.prisma.auction.findMany({
      where: {
        status: 'scheduled' as AuctionStatus,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      take: 50,
      select: {
        id: true,
        startingPrice: true,
        minIncrement: true,
        endsAt: true,
      },
    });
    let started = 0;
    for (const a of toStart) {
      const res = await this.prisma.auction.updateMany({
        where: { id: a.id, status: 'scheduled' as AuctionStatus },
        data: { status: 'live' as AuctionStatus },
      });
      if (res.count === 1) {
        await this.bidding
          .primeLiveAuction({
            auctionId: a.id,
            startingPrice: a.startingPrice,
            minIncrement: a.minIncrement,
            endsAt: a.endsAt.getTime(),
          })
          .catch((e) =>
            this.log.warn(
              `primeLiveAuction failed for ${a.id}: ${(e as Error).message}`,
            ),
          );
        this.gateway.broadcastAuctionStarted({
          auctionId: a.id,
          endsAt: a.endsAt.getTime(),
          startingPrice: a.startingPrice,
        });
        started++;
      }
    }

    // ---- live → ended ----
    const toEnd = await this.prisma.auction.findMany({
      where: {
        status: 'live' as AuctionStatus,
        endsAt: { lte: now },
      },
      take: 50,
      select: { id: true },
    });
    let ended = 0;
    for (const a of toEnd) {
      try {
        await this.bidding.finalize(a.id);
        ended++;
      } catch (e) {
        this.log.error(
          `finalize failed for ${a.id}: ${(e as Error).message}`,
        );
      }
    }
    return { started, ended };
  }

  private toPublic(row: {
    id: string;
    title: string;
    description: string;
    make: string;
    modelName: string;
    year: number;
    kmDriven: number;
    fuelType: string;
    ownerCount: number;
    city: string;
    imageUrls: string[];
    startingPrice: number;
    minIncrement: number;
    reservePrice: number | null;
    status: AuctionStatus;
    startsAt: Date;
    endsAt: Date;
    currentHighBid: number | null;
    currentHighBidderId: string | null;
    bidCount: number;
    winnerId: string | null;
    finalPrice: number | null;
    endedAt: Date | null;
    sellerId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      vehicle: {
        make: row.make,
        model: row.modelName,
        year: row.year,
        kmDriven: row.kmDriven,
        fuelType: row.fuelType,
        ownerCount: row.ownerCount,
        city: row.city,
        imageUrls: row.imageUrls,
      },
      pricing: {
        startingPrice: row.startingPrice,
        minIncrement: row.minIncrement,
        reservePrice: row.reservePrice,
      },
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      live: {
        currentHighBid: row.currentHighBid,
        currentHighBidderId: row.currentHighBidderId,
        bidCount: row.bidCount,
      },
      outcome: {
        winnerId: row.winnerId,
        finalPrice: row.finalPrice,
        endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      },
      sellerId: row.sellerId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
