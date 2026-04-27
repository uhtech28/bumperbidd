import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AppConfig } from '../../config/app.config';
import { BiddingService } from './services/bidding.service';
import { BiddingController } from './controllers/bidding.controller';
import { WalletModule } from '../wallet/wallet.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    WalletModule,
    RealtimeModule,
    NotificationsModule,
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
  controllers: [BiddingController],
  providers: [BiddingService, JwtAuthGuard],
  exports: [BiddingService],
})
export class BiddingModule {}
