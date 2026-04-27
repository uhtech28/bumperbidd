import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../../common/guards/roles.guard';
import { SellerService } from '../services/seller.service';

interface AuthedRequest { user: { sub: string } }

@Controller('seller')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('seller', 'admin')
export class SellerController {
  constructor(private readonly svc: SellerService) {}

  @Get('stats')
  stats(@Req() req: AuthedRequest) { return this.svc.stats(req.user.sub); }

  @Get('listings')
  listings(@Req() req: AuthedRequest, @Query('status') status?: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.svc.myListings(req.user.sub, {
      status, limit: limit ? parseInt(limit, 10) : undefined, cursor,
    });
  }

  @Get('revenue')
  revenue(@Req() req: AuthedRequest) { return this.svc.revenue(req.user.sub); }

  @Get('active')
  active(@Req() req: AuthedRequest) { return this.svc.activeAuctions(req.user.sub); }
}
