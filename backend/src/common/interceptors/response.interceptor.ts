import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Wraps every successful response in a uniform envelope:
 *   { success: true, data: <payload>, timestamp }
 * Controllers can still short-circuit by returning their own envelope.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in data) return data;
        return {
          success: true,
          data: data ?? null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
