import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import { initSentry } from './observability/sentry.config';
import { applySecurity, applyCsrf } from './common/middleware/security.middleware';
import { installGracefulShutdown } from './common/middleware/graceful-shutdown';

/**
 * Production bootstrap.
 *
 * Order matters:
 *   1. Sentry init BEFORE express so Sentry.Handlers can wrap requests.
 *   2. Pino logger installed via nestjs-pino.
 *   3. Security middleware (helmet + compression) before routes.
 *   4. cookie-parser before CSRF (it reads cookies).
 *   5. CSRF applied after cookies (skips /webhooks and /ws).
 *   6. Validation pipes + global filters.
 *   7. Redis adapter registered with Socket.IO before listen().
 *   8. Graceful shutdown hooks wired to SIGTERM/SIGINT.
 */
async function bootstrap(): Promise<void> {
  initSentry();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4000;
  const prefix = config.get<string>('apiPrefix') ?? 'api/v1';
  const corsOrigin = config.get<string>('corsOrigin') ?? 'http://localhost:3000';
  const trustProxy = config.get<boolean>('trustProxy') ?? false;

  if (trustProxy) app.set('trust proxy', 1);

  app.setGlobalPrefix(prefix, {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });

  applySecurity(app);
  app.use(cookieParser(process.env.COOKIE_SECRET));
  const csrfUtils = applyCsrf(app);

  // GET /api/v1/auth/csrf-token
  // Frontend hits this once on first load (or after a 403 retry) to fetch
  // the double-submit token. The cookie half is set automatically by
  // csrf-csrf; the response body returns the matching token the frontend
  // echoes in X-CSRF-Token on every mutating request.
  if (csrfUtils.generateToken) {
    const generate = csrfUtils.generateToken;
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get(`/${prefix}/auth/csrf-token`, (req: any, res: any) => {
      const token = generate(req, res);
      res.json({
        success: true,
        data: { csrfToken: token },
        timestamp: new Date().toISOString(),
      });
    });
  }

  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()).filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-CSRF-Token', 'Idempotency-Key'],
    maxAge: 86400,
  });

  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);

  installGracefulShutdown(app);

  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(
    `[boot] BumperBid API ready on :${port}/${prefix} [env=${config.get<AppConfig['env']>('env')}]`,
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
