import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuctionsService } from './services/auctions.service';

/**
 * AuctionsScheduler — drives the state machine by calling
 * AuctionsService.tick() every 3 seconds. In a multi-pod deployment
 * every pod runs its own scheduler but `updateMany` + row-level locks
 * make transitions idempotent.
 *
 * We intentionally don't use @nestjs/schedule to keep the dependency
 * surface small — a plain setInterval is enough at this granularity.
 */
@Injectable()
export class AuctionsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AuctionsScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly auctions: AuctionsService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.run(), 3_000);
    this.log.log('Auctions scheduler started (tick every 3s)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    if (this.running) return; // overlap guard
    this.running = true;
    try {
      const res = await this.auctions.tick();
      if (res.started || res.ended) {
        this.log.log(
          `tick started=${res.started} ended=${res.ended}`,
        );
      }
    } catch (e) {
      this.log.error(`tick failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
