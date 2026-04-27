import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class SetProxyDto {
  @Type(() => Number) @IsInt() @Min(100) maxAmount!: number;
}
