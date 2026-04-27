import { createHmac, randomInt, timingSafeEqual } from 'crypto';

/** Cryptographically secure numeric OTP of given length (default 6). */
export function generateNumericOtp(length = 6): string {
  if (length < 4 || length > 10) throw new Error('OTP length out of range');
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(randomInt(min, max));
}

/**
 * HMAC-SHA256 of the OTP using the app's JWT secret as the key.
 * We never store raw OTPs in Redis — only the hash.
 */
export function hashOtp(otp: string, pepper: string, phone: string): string {
  // Include the phone as additional context so a leaked hash can't be
  // replayed against a different user.
  return createHmac('sha256', pepper).update(`${phone}:${otp}`).digest('hex');
}

/** Constant-time string compare; returns false on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
