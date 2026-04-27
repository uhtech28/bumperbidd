import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin Nest wrapper around PrismaClient. Keeps one pooled connection per
 * app instance; PrismaClient itself multiplexes queries so we never want
 * more than one.
 *
 * `onModuleInit` connects eagerly so a bad DATABASE_URL fails the pod's
 * health check instead of silently failing the first real request.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
