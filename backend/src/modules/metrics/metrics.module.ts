import { Global, Module } from '@nestjs/common';
import { MetricsService } from './services/metrics.service';
import { MetricsController } from './controllers/metrics.controller';

@Global()
@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
