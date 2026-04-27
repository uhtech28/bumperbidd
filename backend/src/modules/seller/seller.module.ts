import { Module } from '@nestjs/common';
import { SellerController } from './controllers/seller.controller';
import { SellerService } from './services/seller.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SellerController],
  providers: [SellerService],
  exports: [SellerService],
})
export class SellerModule {}
