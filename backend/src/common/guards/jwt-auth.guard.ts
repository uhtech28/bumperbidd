import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppConfig } from '../../config/app.config';

/**
 * Extracts the access token from (in order):
 *   1. the `bb_access` HttpOnly cookie — set by the backend on login
 *   2. the `Authorization: Bearer <token>` header — fallback for non-web
 *      clients (mobile apps, server-to-server integrations).
 *
 * Requests without a valid token are rejected with a structured
 * UnauthorizedException that the global filter converts to JSON.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException({
        code: 'MISSING_TOKEN',
        message: 'Authentication required.',
      });
    }
    const { secret } = this.config.get<AppConfig['jwt']>('jwt')!;
    try {
      const payload = await this.jwt.verifyAsync(token, { secret });
      if (payload?.type !== 'access') {
        throw new UnauthorizedException({
          code: 'WRONG_TOKEN_TYPE',
          message: 'Access token required.',
        });
      }
      (req as unknown as { user: unknown }).user = payload;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token.',
      });
    }
  }

  private extractToken(req: Request): string | null {
    // express + cookie-parser exposes cookies on req.cookies.
    const fromCookie = (req as Request & { cookies?: Record<string, string> })
      .cookies?.bb_access;
    if (fromCookie) return fromCookie;

    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }
    return null;
  }
}
