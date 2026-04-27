import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WalletService } from '../services/wallet.service';

interface AuthedRequest extends Request {
  user: { sub: string };
}

class TopUpDto {
  @Type(() => Number)
  @IsInt({ message: 'amount must be integer paisa' })
  @Min(100)
  amount!: number;
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(
    private readonly svc: WalletService,
    private readonly config: ConfigService,
  ) {}

  @Get('balance')
  async balance(@Req() req: AuthedRequest) {
    return this.svc.getBalance(req.user.sub);
  }

  @Get('entries')
  async entries(
    @Req() req: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.listEntries(req.user.sub, {
      limit: limit ? Math.max(1, parseInt(limit, 10)) : 30,
      cursor,
    });
  }

  /**
   * Dev-only simulated top-up. In production this would be a Razorpay
   * / Stripe webhook handler; here we gate on NODE_ENV so it can't be
   * called in prod even if exposed by mistake.
   */
  @Post('topup/dev')
  async devTopup(@Req() req: AuthedRequest, @Body() dto: TopUpDto) {
    const env = this.config.get<string>('env') ?? 'development';
    if (env !== 'development' && env !== 'test') {
      throw new ForbiddenException({
        code: 'DEV_ONLY',
        message: 'This endpoint is disabled in production.',
      });
    }
    const entry = await this.svc.credit({
      userId: req.user.sub,
      amount: dto.amount,
      idempotencyKey: `dev-topup-${randomUUID()}`,
      note: 'Dev top-up',
    });
    const bal = await this.svc.getBalance(req.user.sub);
    return { entry, balance: bal };
  }
}
