import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SmsSendResult } from './provider.interface';

/**
 * Dev-only provider. Activated when OTP_DEV_LOG=true. Writes the OTP to the
 * server log instead of sending a real SMS — useful in local development
 * and integration tests. NEVER enable in production.
 */
@Injectable()
export class DevLogProvider implements SmsProvider {
  readonly name = 'dev-log';
  readonly enabled = true;
  private readonly logger = new Logger(DevLogProvider.name);

  async sendOtp(phoneE164: string, otp: string): Promise<SmsSendResult> {
    this.logger.warn(`[DEV OTP] ${phoneE164} -> ${otp}`);
    return { provider: this.name, accepted: true, messageId: 'dev' };
  }
}
