import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class CreateProofDto {
  @Type(() => Number) @IsInt() @Min(10000) amount!: number;   // paisa, min ₹100
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9]{6,30}$/) utrReference?: string;
  @IsString() fileKey!: string;
}
