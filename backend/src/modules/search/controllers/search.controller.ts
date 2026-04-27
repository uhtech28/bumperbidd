import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { SearchService } from '../services/search.service';

class SearchDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() fuelType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() yearFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() yearTo?: number;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsIn(['live', 'scheduled', 'ended']) status?: 'live' | 'scheduled' | 'ended';
  @IsOptional() @IsIn(['ending_soon', 'newest', 'price_asc', 'price_desc']) sort?: any;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsString() cursor?: string;
}

@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get('auctions')
  search(@Query() dto: SearchDto) {
    return this.svc.searchAuctions(dto);
  }

  @Get('suggest')
  suggest(@Query('q') q: string) {
    return this.svc.suggest(q ?? '');
  }
}
