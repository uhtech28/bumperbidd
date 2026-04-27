import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';
import { RealtimeGateway } from './realtime.gateway';

/**
 * RealtimeModule wraps the Socket.IO gateway. JwtModule is registered
 * here (same secret + TTL as the HTTP auth module) so the gateway can
 * verify `bb_access` tokens on connect.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const jwt = config.get<AppConfig['jwt']>('jwt')!;
        return {
          secret: jwt.secret,
          signOptions: { expiresIn: jwt.accessTtl, issuer: 'bumperbid' },
        };
      },
    }),
  ],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
