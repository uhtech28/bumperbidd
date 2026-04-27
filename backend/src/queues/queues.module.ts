import { Module } from '@nestjs/common';
import { BidPersistenceQueue } from './bid-persistence.queue';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BidPersistenceQueue],
  exports: [BidPersistenceQueue],
})
export class QueuesModule {}
