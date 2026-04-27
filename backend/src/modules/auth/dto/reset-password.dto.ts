import { IsString, Length, Matches } from 'class-validator';

/**
 * POST /auth/reset-password — body
 *
 * `token` is the raw 64-char hex string from the email link.
 * `newPassword` is bound to 8-128 characters; the service does the
 * scrypt hashing.
 */
export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, { message: 'Reset link is malformed.' })
  token!: string;

  @IsString()
  @Length(8, 128, { message: 'Password must be 8 to 128 characters.' })
  newPassword!: string;
}
