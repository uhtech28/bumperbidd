import { Body, Controller, Delete, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UploadsService } from '../services/uploads.service';

class PresignDto {
  @IsString() mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10 * 1024 * 1024) sizeBytes!: number;
  @IsIn(['auction', 'kyc', 'payment']) purpose!: 'auction' | 'kyc' | 'payment';
}

class ConfirmDto {
  @IsString() key!: string;
  @IsOptional() @IsUUID() auctionId?: string;
  @IsString() mimeType!: string;
  @Type(() => Number) @IsInt() sizeBytes!: number;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

interface AuthedRequest { user: { sub: string } }

@Controller('uploads')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class UploadsController {
  constructor(private readonly svc: UploadsService) {}

  @Post('presign')
  async presign(@Req() req: AuthedRequest, @Body() dto: PresignDto) {
    return this.svc.presign({ userId: req.user.sub, ...dto });
  }

  @Post('confirm')
  async confirm(@Req() req: AuthedRequest, @Body() dto: ConfirmDto) {
    return this.svc.confirm({ ...dto, uploaderId: req.user.sub });
  }

  @Delete(':key')
  async delete(@Param('key') key: string) {
    return this.svc.delete(decodeURIComponent(key));
  }
}
