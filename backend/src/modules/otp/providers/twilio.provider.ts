import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';
import { AppConfig } from '../../../config/app.config';
import { SmsProvider, SmsSendResult } from './provider.interface';

/**
 * Twilio — international fallback provider. Cheaper than MSG91 outside India
 * and reliable for non-IN numbers.
 */
@Injectable()
export class TwilioProvider implements SmsProvider {
  readonly name = 'twilio';
  private readonly logger = new Logger(TwilioProvider.name);
  private readonly client: Twilio | null;
  private readonly cfg: AppConfig['providers']['twilio'];

  constructor(config: ConfigService) {
    this.cfg = config.get<AppConfig['providers']>('providers')!.twilio;
    this.client =
      this.cfg.enabled && this.cfg.accountSid && this.cfg.authToken
        ? twilio(this.cfg.accountSid, this.cfg.authToken)
        : null;
  }

  get enabled(): boolean {
    return !!this.client && !!this.cfg.fromNumber;
  }

  async sendOtp(phoneE164: string, otp: string): Promise<SmsSendResult> {
    if (!this.client) {
      return { provider: this.name, accepted: false, raw: 'NOT_CONFIGURED' };
    }
    const msg = await this.client.messages.create({
      to: phoneE164,
      from: this.cfg.fromNumber,
      body: `Your BumperBid verification code is ${otp}. Valid for 5 minutes. Do not share.`,
    });
    this.logger.debug(`twilio sent sid=${msg.sid}`);
    return {
      provider: this.name,
      accepted: msg.status !== 'failed' && msg.status !== 'undelivered',
      messageId: msg.sid,
      raw: { sid: msg.sid, status: msg.status },
    };
  }
}
