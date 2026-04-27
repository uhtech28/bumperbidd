import { Module } from '@nestjs/common';
import { OtpService } from './services/otp.service';
import { OtpStoreService } from './services/otp-store.service';
import { RateLimitService } from './services/rate-limit.service';
import { Msg91Provider } from './providers/msg91.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { DevLogProvider } from './providers/dev-log.provider';
import { MSG91, TWILIO, DEV_LOG } from './otp.tokens';

@Module({
  providers: [
    OtpStoreService,
    RateLimitService,
    { provide: MSG91, useClass: Msg91Provider },
    { provide: TWILIO, useClass: TwilioProvider },
    { provide: DEV_LOG, useClass: DevLogProvider },
    OtpService,
  ],
  exports: [OtpService, RateLimitService],
})
export class OtpModule {}
