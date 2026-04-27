import { Module } from '@nestjs/common';
import { PushController } from './controllers/push.controller';
import { PushService } from './services/push.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
