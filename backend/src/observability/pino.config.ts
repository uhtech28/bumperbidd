import { Params } from 'nestjs-pino';
import { randomUUID } from 'crypto';

/**
 * Returns the options for LoggerModule.forRoot(...).
 *
 * Why a function (not a static module): `forRoot` wants the options
 * object, and NestJS composes that inside `LoggerModule.forRoot(...)`.
 * Exporting a callable keeps AppModule free to decide when to construct
 * it (e.g. after env is loaded).
 */
export function pinoConfig(): Params {
  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? 'info',
      autoLogging: true,
      genReqId: (req: any, res: any) => {
        const id = (req.headers['x-request-id'] as string) || randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      redact: {
        paths: [
          'req.headers.cookie',
          'req.headers.authorization',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.otp',
        ],
        censor: '[REDACTED]',
      },
      serializers: {
        req(req: any) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          };
        },
      },
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
          : undefined,
    },
  };
}
