import { Module } from '@nestjs/common';
import { WatchlistController } from './controllers/watchlist.controller';
import { WatchlistService } from './services/watchlist.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WatchlistController],
  providers: [WatchlistService],
  exports: [WatchlistService],
})
export class WatchlistModule {}
