import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CreateAuctionDto — all prices in paisa (integer).
 * minIncrement defaults to 1000 paisa (₹10) if not set by the caller.
 */
export class CreateAuctionDto {
  @IsString()
  @Length(4, 120)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsString()
  @Length(1, 40)
  make!: string;

  @IsString()
  @Length(1, 60)
  modelName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  kmDriven!: number;

  @IsString()
  @Matches(/^(petrol|diesel|ev|cng|hybrid)$/i, {
    message: 'fuelType must be one of petrol|diesel|ev|cng|hybrid',
  })
  fuelType!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  ownerCount?: number;

  @IsString()
  @Length(2, 60)
  city!: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  imageUrls!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(10_000) // ≥ ₹100
  startingPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  minIncrement?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reservePrice?: number;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;
}
