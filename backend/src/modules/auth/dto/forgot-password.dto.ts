import { IsEmail } from 'class-validator';

/**
 * POST /auth/forgot-password — body
 *
 * Email is the only thing we accept. Phone-based reset doesn't apply
 * here because phone accounts use OTP (no password to reset).
 */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'A valid email is required.' })
  email!: string;
}
