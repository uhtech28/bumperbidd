import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListAuctionsDto {
  @IsOptional()
  @IsIn(['scheduled', 'live', 'ended', 'cancelled'])
  status?: 'scheduled' | 'live' | 'ended' | 'cancelled';

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
