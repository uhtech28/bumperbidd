import { Module } from '@nestjs/common';
import { ProxyBidController } from './controllers/proxybid.controller';
import { ProxyBidService } from './services/proxybid.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProxyBidController],
  providers: [ProxyBidService],
  exports: [ProxyBidService],
})
export class ProxyBidModule {}
