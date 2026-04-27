import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './controllers/orders.controller';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
