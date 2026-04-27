import { IsString, Matches, MaxLength, MinLength, IsOptional } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  countryCode?: string;

  @IsString()
  @Matches(/^\d{4,10}$/, { message: 'OTP must be 4–10 digits.' })
  otp!: string;
}
