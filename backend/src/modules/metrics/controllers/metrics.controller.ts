import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from '../services/metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Get()
  async metrics(@Res() res: Response) {
    res.setHeader('Content-Type', this.svc.contentType());
    res.send(await this.svc.snapshot());
  }
}
