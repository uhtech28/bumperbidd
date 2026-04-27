import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class KycDocKeyDto {
  @IsIn(['pan', 'aadhaar', 'driving_license', 'passport']) docType!: 'pan' | 'aadhaar' | 'driving_license' | 'passport';
  @IsString() fileKey!: string;
  @IsString() mimeType!: string;
  @IsInt() sizeBytes!: number;
}

export class SubmitKycDto {
  @IsString() @Length(3, 120) fullName!: string;
  @IsOptional() @IsDateString() dob?: string;
  @IsOptional() @Matches(/^[A-Z]{5}\d{4}[A-Z]$/) panNumber?: string;
  @IsOptional() @Matches(/^\d{4}$/) aadhaarLast4?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() addressLine2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @Matches(/^\d{6}$/) pincode?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => KycDocKeyDto) documentKeys?: KycDocKeyDto[];
}
