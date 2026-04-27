import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { AppConfig } from '../../../config/app.config';
import { SmsProvider, SmsSendResult } from './provider.interface';

/**
 * MSG91 — India's leading transactional SMS provider. DLT/template compliant.
 * Docs: https://docs.msg91.com/reference/send-otp
 */
@Injectable()
export class Msg91Provider implements SmsProvider {
  readonly name = 'msg91';
  private readonly logger = new Logger(Msg91Provider.name);
  private readonly http: AxiosInstance;
  private readonly cfg: AppConfig['providers']['msg91'];

  constructor(config: ConfigService) {
    this.cfg = config.get<AppConfig['providers']>('providers')!.msg91;
    this.http = axios.create({
      baseURL: 'https://control.msg91.com/api/v5',
      timeout: 8_000,
    });
  }

  get enabled(): boolean {
    return this.cfg.enabled && !!this.cfg.authKey;
  }

  async sendOtp(phoneE164: string, otp: string): Promise<SmsSendResult> {
    // MSG91 expects the mobile number *without* the leading `+`.
    const mobile = phoneE164.replace(/^\+/, '');
    const payload = {
      template_id: this.cfg.templateId,
      mobile,
      otp,
      sender: this.cfg.senderId,
      otp_length: otp.length,
    };
    const { data } = await this.http.post('/otp', payload, {
      headers: { authkey: this.cfg.authKey, 'Content-Type': 'application/json' },
    });
    this.logger.debug(`msg91 sent to ${mobile}: ${JSON.stringify(data)}`);
    const accepted = data?.type === 'success';
    return {
      provider: this.name,
      accepted,
      messageId: data?.request_id,
      raw: data,
    };
  }
}
