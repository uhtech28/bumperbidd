import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BiddingService } from '../services/bidding.service';
import { PlaceBidDto } from '../dto/place-bid.dto';

interface AuthedRequest extends Request {
  user: { sub: string };
}

/**
 * POST /auctions/:id/bids - place a bid.
 * GET  /auctions/:id/live  - read current live state (Redis snapshot).
 *
 * The bid endpoint is rate-limited aggressively (20 rps per user) to
 * stop a single client from monopolising the Redis Lua channel. Under
 * load the Lua script itself serializes, so this is a soft guard.
 */
@Controller('auctions/:id')
@UseGuards(JwtAuthGuard)
export class BiddingController {
  constructor(private readonly bidding: BiddingService) {}

  @Post('bids')
  @HttpCode(HttpStatus.CREATED)
  // 20 bids per second per IP. Keyed under 'default' so it matches the
  // named limiter registered in app.module.ts (was 'global', which
  // silently no-op'd because no such limiter exists).
  @Throttle({ default: { limit: 20, ttl: 1_000 } })
  async placeBid(
    @Req() req: AuthedRequest,
    @Param('id') auctionId: string,
    @Body() dto: PlaceBidDto,
  ) {
    return this.bidding.placeBid({
      auctionId,
      userId: req.user.sub,
      amount: dto.amount,
    });
  }

  @Get('live')
  async live(@Param('id') auctionId: string) {
    const state = await this.bidding.getLiveState(auctionId);
    return state ?? { status: 'unknown' };
  }
}
