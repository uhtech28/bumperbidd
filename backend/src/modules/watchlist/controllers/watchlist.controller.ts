import { Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WatchlistService } from '../services/watchlist.service';

interface AuthedRequest { user: { sub: string } }

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private readonly svc: WatchlistService) {}

  @Post(':auctionId')
  add(@Req() req: AuthedRequest, @Param('auctionId') auctionId: string) {
    return this.svc.add(req.user.sub, auctionId);
  }

  @Delete(':auctionId')
  remove(@Req() req: AuthedRequest, @Param('auctionId') auctionId: string) {
    return this.svc.remove(req.user.sub, auctionId);
  }

  @Get()
  list(@Req() req: AuthedRequest, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.svc.list(req.user.sub, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }
}
