export interface SmsSendResult {
  provider: string;
  messageId?: string;
  accepted: boolean;
  raw?: unknown;
}

/**
 * All SMS providers implement this interface. The OtpService picks the
 * first enabled + healthy provider and falls back on failure.
 */
export interface SmsProvider {
  readonly name: string;
  readonly enabled: boolean;
  sendOtp(phoneE164: string, otp: string): Promise<SmsSendResult>;
}
