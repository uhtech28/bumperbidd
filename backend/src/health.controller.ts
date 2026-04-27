import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

/**
 * Liveness + readiness probe endpoint for Railway / Fly / Render load
 * balancers. Intentionally does NOT hit the DB — this should return 200
 * while the process is up; dependent-service checks live elsewhere so a
 * transient Redis blip doesn't kill the pod.
 */
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return {
      status: 'ok',
      service: 'bumperbid-api',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
    };
  }
}
