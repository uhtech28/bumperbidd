import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { AppConfig } from '../config/app.config';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const redis = config.get<AppConfig['redis']>('redis')!;
        const opts: RedisOptions = {
          host: redis.host,
          port: redis.port,
          password: redis.password,
          tls: redis.tls ? {} : undefined,
          lazyConnect: false,
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          retryStrategy: (times) => Math.min(times * 200, 3_000),
        };
        const client = new Redis(opts);
        client.on('error', (err) =>
          // eslint-disable-next-line no-console
          console.error('[redis] error', err.message),
        );
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
