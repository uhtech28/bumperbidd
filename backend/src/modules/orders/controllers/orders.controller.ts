import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { OrdersService } from '../orders.service';

interface AuthedRequest extends Request {
  user: { sub: string };
}

class FileDisputeDto {
  @IsString()
  @IsIn(['damage', 'not_as_described', 'title_issue', 'no_show', 'other'])
  reason!: string;

  @IsString()
  @Length(20, 4000)
  details!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('me/wins')
  wins(
    @Req() req: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.orders.listWins(
      req.user.sub,
      limit ? parseInt(limit, 10) : 30,
      cursor,
    );
  }

  @Get('me/sales')
  sales(
    @Req() req: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.orders.listSales(
      req.user.sub,
      limit ? parseInt(limit, 10) : 30,
      cursor,
    );
  }

  @Get(':id')
  getOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.getById(id, req.user.sub);
  }

  @Post(':id/dispute')
  fileDispute(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: FileDisputeDto,
  ) {
    return this.orders.fileDispute(id, req.user.sub, dto);
  }
}
