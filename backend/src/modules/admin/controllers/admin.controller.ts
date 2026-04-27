import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../../../common/guards/roles.guard';
import { AdminService } from '../services/admin.service';
import { AuditService } from '../../audit/services/audit.service';
import { PaymentsService } from '../../payments/services/payments.service';
import { KycService } from '../../kyc/services/kyc.service';

interface AuthedRequest { user: { sub: string }; ip?: string; headers: Record<string, any> }

class BanDto { @IsString() reason!: string }
class RefundDto {
  @Type(() => Number) @IsInt() @Min(1) amount!: number;
  @IsString() note!: string;
}
class ReviewDto { @IsOptional() @IsString() note?: string }

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'support')
export class AdminController {
  constructor(
    private readonly svc: AdminService,
    private readonly audit: AuditService,
    private readonly payments: PaymentsService,
    private readonly kyc: KycService,
  ) {}

  private meta(req: AuthedRequest) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Get('stats') stats() { return this.svc.stats(); }

  @Get('users')
  users(@Query('search') search?: string, @Query('role') role?: string, @Query('banned') banned?: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.svc.listUsers({
      search, role,
      banned: banned === 'true' ? true : banned === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Post('users/:id/ban')
  ban(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: BanDto) {
    return this.svc.banUser(req.user.sub, id, dto.reason, this.meta(req));
  }

  @Post('users/:id/unban')
  unban(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.svc.unbanUser(req.user.sub, id, this.meta(req));
  }

  @Get('users/:id/wallet')
  wallet(@Param('id') id: string) { return this.svc.getUserWallet(id); }

  @Post('users/:id/refund')
  refund(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: RefundDto) {
    return this.svc.refund(req.user.sub, id, dto.amount, dto.note, this.meta(req));
  }

  @Get('auctions')
  auctions(@Query('status') status?: string, @Query('sellerId') sellerId?: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.svc.listAuctions({ status, sellerId, limit: limit ? parseInt(limit, 10) : undefined, cursor });
  }

  @Post('auctions/:id/cancel')
  cancelAuction(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: BanDto) {
    return this.svc.cancelAuction(req.user.sub, id, dto.reason, this.meta(req));
  }

  @Get('auctions/:id/suspicious')
  suspicious(@Param('id') id: string) { return this.svc.detectSuspicious(id); }

  @Get('bids')
  bids(@Query('auctionId') auctionId?: string, @Query('userId') userId?: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.svc.listBids({ auctionId, userId, limit: limit ? parseInt(limit, 10) : undefined, cursor });
  }

  // Wallet ledger (cross-user) - powers the admin Transactions page.
  @Get('wallet-entries')
  walletEntries(
    @Query('type') type?: string,
    @Query('userId') userId?: string,
    @Query('referenceType') referenceType?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.svc.listWalletEntries({
      type,
      userId,
      referenceType,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  // Payment proofs
  @Get('payments/pending')
  pending(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.payments.listPending({ limit: limit ? parseInt(limit, 10) : undefined, cursor });
  }

  @Post('payments/:id/approve')
  approvePayment(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.payments.approve(req.user.sub, id, this.meta(req));
  }

  @Post('payments/:id/reject')
  rejectPayment(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: ReviewDto) {
    return this.payments.reject(req.user.sub, id, dto.note ?? 'No reason provided', this.meta(req));
  }

  // KYC review
  @Post('kyc/:id/approve')
  approveKyc(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.kyc.approve(req.user.sub, id, this.meta(req));
  }

  @Post('kyc/:id/reject')
  rejectKyc(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: ReviewDto) {
    return this.kyc.reject(req.user.sub, id, dto.note ?? 'Insufficient documents', this.meta(req));
  }

  // Listing review queue
  @Get('reviews/pending')
  pendingReviews(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.svc.listPendingReviews({
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Post('auctions/:id/approve')
  approveAuction(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.svc.approveAuction(req.user.sub, id, this.meta(req));
  }

  @Post('auctions/:id/reject')
  rejectAuction(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: BanDto) {
    return this.svc.rejectAuction(req.user.sub, id, dto.reason, this.meta(req));
  }

  // Audit log
  @Get('audit')
  auditLog(@Query('adminId') adminId?: string, @Query('action') action?: string, @Query('targetType') targetType?: string, @Query('targetId') targetId?: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.audit.list({ adminId, action, targetType, targetId, limit: limit ? parseInt(limit, 10) : undefined, cursor });
  }
}
