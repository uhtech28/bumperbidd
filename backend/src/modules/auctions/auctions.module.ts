import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AppConfig } from '../../config/app.config';
import { AuctionsService } from './services/auctions.service';
import { AuctionsController } from './controllers/auctions.controller';
import { AuctionsScheduler } from './auctions.scheduler';
import { BiddingModule } from '../bidding/bidding.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    BiddingModule,
    RealtimeModule,
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
  controllers: [AuctionsController],
  providers: [AuctionsService, AuctionsScheduler, JwtAuthGuard],
  exports: [AuctionsService],
})
export class AuctionsModule {}
