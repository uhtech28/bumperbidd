import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ProxyBidService } from '../services/proxybid.service';
import { SetProxyDto } from '../dto/set-proxy.dto';

interface AuthedRequest { user: { sub: string } }

@Controller('proxybid/:auctionId')
@UseGuards(JwtAuthGuard)
export class ProxyBidController {
  constructor(private readonly svc: ProxyBidService) {}

  @Post()
  set(@Req() req: AuthedRequest, @Param('auctionId') auctionId: string, @Body() dto: SetProxyDto) {
    return this.svc.setMax(req.user.sub, auctionId, dto.maxAmount);
  }

  @Delete()
  cancel(@Req() req: AuthedRequest, @Param('auctionId') auctionId: string) {
    return this.svc.cancel(req.user.sub, auctionId);
  }

  @Get()
  mine(@Req() req: AuthedRequest, @Param('auctionId') auctionId: string) {
    return this.svc.mine(req.user.sub, auctionId);
  }
}
