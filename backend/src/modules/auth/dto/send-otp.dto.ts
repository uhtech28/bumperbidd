import { IsString, Matches, MaxLength, MinLength, IsOptional } from 'class-validator';

export class SendOtpDto {
  // Accept raw phone; normalisation happens server-side via libphonenumber-js.
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/^[+\d][\d\s-]{6,19}$/, { message: 'Phone format is invalid.' })
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  countryCode?: string; // optional ISO-3166 alpha-2, e.g. "IN"
}
