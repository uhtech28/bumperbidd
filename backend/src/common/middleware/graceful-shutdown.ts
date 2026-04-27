import { INestApplication, Logger } from '@nestjs/common';

/**
 * Graceful shutdown: on SIGTERM/SIGINT, stop accepting new connections,
 * drain in-flight HTTP + WebSocket traffic, close DB + Redis, then exit.
 */
export function installGracefulShutdown(app: INestApplication, timeoutMs = 30_000) {
  const log = new Logger('Shutdown');
  let shuttingDown = false;
  const handle = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.warn(`Received ${signal} — draining...`);
    const t = setTimeout(() => {
      log.error('Graceful shutdown timeout exceeded — forcing exit');
      process.exit(1);
    }, timeoutMs);
    try {
      await app.close();
      log.log('Shutdown complete');
      clearTimeout(t);
      process.exit(0);
    } catch (e: any) {
      log.error(`Shutdown error: ${e?.message}`);
      clearTimeout(t);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => handle('SIGTERM'));
  process.on('SIGINT', () => handle('SIGINT'));
  app.enableShutdownHooks();
}
