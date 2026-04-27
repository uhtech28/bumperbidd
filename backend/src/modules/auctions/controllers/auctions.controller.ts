import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuctionsService } from '../services/auctions.service';
import { CreateAuctionDto } from '../dto/create-auction.dto';
import { ListAuctionsDto } from '../dto/list-auctions.dto';

interface AuthedRequest extends Request {
  user: { sub: string };
}

@Controller('auctions')
export class AuctionsController {
  constructor(private readonly svc: AuctionsService) {}

  /** Public list — visible without auth so landing pages can render. */
  @Get()
  async list(@Query() q: ListAuctionsDto) {
    return this.svc.list(q);
  }

  /** Public detail. */
  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.svc.get(id);
  }

  /** Create — requires auth; caller becomes the seller. */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: AuthedRequest, @Body() dto: CreateAuctionDto) {
    return this.svc.create(req.user.sub, dto);
  }

  /** Seller-only cancel. */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async cancel(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.svc.cancel(id, req.user.sub);
  }
}
