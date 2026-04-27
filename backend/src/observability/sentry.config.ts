import * as Sentry from '@sentry/node';
import { INestApplication } from '@nestjs/common';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('[observability] SENTRY_DSN not set — error tracking disabled');
    return false;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_RATE ?? '0.1'),
    beforeSend(event: any) {
      // Scrub common PII
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        delete (event.request.headers as any).authorization;
        delete (event.request.headers as any).cookie;
      }
      return event;
    },
  });
  return true;
}

export function attachSentryErrorHandler(app: INestApplication) {
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(Sentry.Handlers.errorHandler());
}
