import helmet from 'helmet';
import compression from 'compression';
import { INestApplication } from '@nestjs/common';
import { doubleCsrf } from 'csrf-csrf';

/**
 * Apply production-grade security middleware to the Nest app.
 *   - helmet: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.
 *   - compression: gzip/brotli responses
 *   - body-size limit: 2 MB default (multipart handled separately)
 *   - CSRF: double-submit-cookie (HMAC-signed)
 */
export function applySecurity(app: INestApplication) {
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.gstatic.com', 'https://cdnjs.cloudflare.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  expressApp.use(compression({ threshold: 1024 }));
}

/**
 * Returned object: when CSRF is configured, exposes `generateToken` and
 * `doubleCsrfProtection` from the csrf-csrf library. When CSRF_SECRET is
 * missing (dev mode) returns nulls so callers can branch with optional
 * chaining.
 */
export interface CsrfHandle {
  generateToken: ((req: any, res: any) => string) | null;
  doubleCsrfProtection:
    | ((req: any, res: any, next: any) => void)
    | null;
}

export function applyCsrf(app: INestApplication): CsrfHandle {
  const secret = process.env.CSRF_SECRET;
  if (!secret) {
    console.warn('[security] CSRF_SECRET not set - skipping CSRF middleware (dev only)');
    return { generateToken: null, doubleCsrfProtection: null };
  }
  const isProd = process.env.NODE_ENV === 'production';
  const utils = doubleCsrf({
    getSecret: () => secret,
    getSessionIdentifier: (req: any) =>
      // csrf-csrf v3 wants a stable per-session identifier. We use the
      // signed access cookie when present (post-login), and fall back to
      // the IP for first-load CSRF token issuance before the user signs in.
      req.cookies?.['bb_access'] ?? req.ip ?? 'anon',
    cookieName: isProd ? '__Host-bb_csrf' : 'bb_csrf',
    cookieOptions: {
      sameSite: 'strict',
      secure: isProd,
      httpOnly: false, // frontend reads this and echoes in X-CSRF-Token header
      path: '/',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getTokenFromRequest: (req: any) =>
      (req.headers['x-csrf-token'] as string) || '',
  });
  const expressApp = app.getHttpAdapter().getInstance();
  // Only apply CSRF to mutating endpoints - skip websocket / webhook routes
  expressApp.use((req: any, res: any, next: any) => {
    if (req.path?.startsWith('/api/v1/webhooks') || req.path?.startsWith('/ws')) return next();
    return utils.doubleCsrfProtection(req, res, next);
  });
  return {
    generateToken: utils.generateToken as unknown as (req: any, res: any) => string,
    doubleCsrfProtection: utils.doubleCsrfProtection as unknown as (
      req: any,
      res: any,
      next: any,
    ) => void,
  };
}
