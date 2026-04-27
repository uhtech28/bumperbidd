import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Password policy: 8-128 chars, must contain at least one letter and one
 * digit. Intentionally not symbol-mandatory — NIST guidance (2024) is that
 * length + entropy beat character-class rules.
 */
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

export class EmailSignupDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(254)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(128, { message: 'Password is too long.' })
  @Matches(PASSWORD_RULE, {
    message:
      'Password must contain at least one letter and one number.',
  })
  password!: string;
}
