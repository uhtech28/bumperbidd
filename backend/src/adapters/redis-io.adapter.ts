import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { AppConfig } from '../config/app.config';

/**
 * RedisIoAdapter — wraps the default Socket.IO adapter with the Redis
 * pub/sub adapter so events emitted from one backend pod fan out to
 * every other pod. Required for horizontal scaling.
 *
 * Uses dedicated pub/sub connections (NOT the main REDIS_CLIENT) because
 * ioredis puts a connection into "subscribed" mode once it subscribes
 * and can't be used for other commands.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly log = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplicationContext) {
    super(app);
    this.app = app;
  }

  private readonly app: INestApplicationContext;

  async connectToRedis(): Promise<void> {
    const config = this.app.get(ConfigService);
    const redis = config.get<AppConfig['redis']>('redis')!;

    const pub = new Redis({
      host: redis.host,
      port: redis.port,
      password: redis.password,
      tls: redis.tls ? {} : undefined,
      db: redis.db ?? 0,
    });
    const sub = pub.duplicate();

    pub.on('error', (e) => this.log.error(`redis-pub error: ${e.message}`));
    sub.on('error', (e) => this.log.error(`redis-sub error: ${e.message}`));

    this.adapterConstructor = createAdapter(pub, sub, {
      key: 'bb:socket.io',
    });
    this.log.log('Socket.IO Redis adapter ready');
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      (server as { adapter: (a: unknown) => void }).adapter(
        this.adapterConstructor,
      );
    }
    return server;
  }
}
