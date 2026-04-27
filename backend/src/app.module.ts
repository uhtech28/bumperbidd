import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import Redis from 'ioredis';
import { appConfig, AppConfig } from './config/app.config';
import { RedisModule } from './redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';
import { pinoConfig } from './observability/pino.config';
import { AuthCommonModule } from './common/auth-common.module';

// Core product modules
import { AuthModule } from './modules/auth/auth.module';
import { OtpModule } from './modules/otp/otp.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { BiddingModule } from './modules/bidding/bidding.module';
import { AuctionsModule } from './modules/auctions/auctions.module';

// New production modules
import { UploadsModule } from './modules/uploads/uploads.module';
import { KycModule } from './modules/kyc/kyc.module';
import { SearchModule } from './modules/search/search.module';
import { EmailModule } from './modules/email/email.module';
import { PushModule } from './modules/push/push.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { ProxyBidModule } from './modules/proxybid/proxybid.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { SellerModule } from './modules/seller/seller.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AuditModule } from './modules/audit/audit.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { QueuesModule } from './queues/queues.module';

import { HealthController } from './health.controller';

/**
 * Root application module.
 *
 * Module dependency graph (simplified):
 *   Auth -> Users, Otp, Email, Notifications
 *   Auctions -> Users, Uploads, Search, Bidding
 *   Bidding -> Wallet, Realtime, Queues(BullMQ), Notifications, Push, Email
 *   Payments -> Wallet, Email, Notifications, Uploads
 *   Admin -> Audit, Users, Auctions, Payments, Wallet
 *   Seller -> Auctions (gated by Kyc-driven role)
 *   Watchlist, ProxyBid -> Auctions, Bidding
 *   Metrics is global (injected into hot paths via MetricsService).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig], cache: true }),
    LoggerModule.forRoot(pinoConfig()),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisCfg = config.get<AppConfig['redis']>('redis')!;
        const storage = new ThrottlerStorageRedisService(
          new Redis({
            host: redisCfg.host,
            port: redisCfg.port,
            password: redisCfg.password,
            db: redisCfg.db ?? 0,
            // Honor REDIS_TLS for managed providers (Upstash etc).
            tls: redisCfg.tls ? {} : undefined,
            lazyConnect: false,
          }),
        );
        return {
          throttlers: [
            { name: 'global', ttl: 60_000, limit: 120 },
            { name: 'auth', ttl: 60_000, limit: 10 },
            { name: 'bid', ttl: 1_000, limit: 10 },
          ],
          storage,
        };
      },
    }),
    PrismaModule,
    RedisModule,
    AuthCommonModule,
    MetricsModule,
    QueuesModule,
    UsersModule,
    OtpModule,
    EmailModule,
    PushModule,
    AuditModule,
    UploadsModule,
    KycModule,
    SearchModule,
    WatchlistModule,
    ProxyBidModule,
    PaymentsModule,
    AuthModule,
    WalletModule,
    NotificationsModule,
    RealtimeModule,
    BiddingModule,
    AuctionsModule,
    SellerModule,
    OrdersModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
