import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { KycService } from '../services/kyc.service';
import { SubmitKycDto } from '../dto/submit-kyc.dto';

interface AuthedRequest { user: { sub: string } }

@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly svc: KycService) {}

  @Post('submit')
  async submit(@Req() req: AuthedRequest, @Body() dto: SubmitKycDto) {
    return this.svc.submit(req.user.sub, dto);
  }

  @Get('status')
  async mine(@Req() req: AuthedRequest) {
    return this.svc.mine(req.user.sub);
  }
}
