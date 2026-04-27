import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PaymentsService } from '../services/payments.service';
import { CreateProofDto } from '../dto/create-proof.dto';

interface AuthedRequest { user: { sub: string } }

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Get('instructions')
  instructions() {
    return this.svc.getPaymentInstructions();
  }

  @Post('proofs')
  create(@Req() req: AuthedRequest, @Body() dto: CreateProofDto) {
    return this.svc.createProof(req.user.sub, dto);
  }

  @Get('proofs')
  mine(@Req() req: AuthedRequest, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.svc.myProofs(req.user.sub, {
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }
}
