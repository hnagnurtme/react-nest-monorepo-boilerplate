import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { map, type Observable } from 'rxjs';

import { AppConfig } from '@/config/index.js';

import { AuthResult } from './auth.types.js';

/**
 * Applies the `Set-Cookie` headers an auth handler asked for and forwards the
 * plain body onwards.
 *
 * This exists so that no controller has to inject `Response` just to set a
 * cookie — a controller that holds the response object can only be tested by
 * standing up an HTTP server (docs/rules/02-backend-nestjs.md B2).
 */
@Injectable()
export class AuthCookieInterceptor implements NestInterceptor {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((result: unknown) => {
        if (!(result instanceof AuthResult)) return result;
        const typed = result as AuthResult<unknown>;

        for (const cookie of typed.cookies) {
          response.cookie(cookie.name, cookie.value, {
            ...this.baseOptions(),
            httpOnly: cookie.httpOnly,
            path: cookie.path,
            maxAge: cookie.maxAgeMs,
          });
        }

        for (const name of typed.clearCookies) {
          // Path must match the path the cookie was set with, or the browser
          // silently keeps the original.
          response.clearCookie(name, { ...this.baseOptions(), path: '/api/v1/auth' });
          response.clearCookie(name, { ...this.baseOptions(), path: '/' });
        }

        return typed.body;
      }),
    );
  }

  private baseOptions(): CookieOptions {
    return {
      secure: this.config.cookie.secure,
      // Lax, not Strict: Strict drops the cookie when the browser comes back
      // from a payment or OAuth redirect, which logs the user out mid-checkout.
      // The CsrfMiddleware is the other half of that trade.
      sameSite: 'lax',
      ...(this.config.cookie.domain === undefined ? {} : { domain: this.config.cookie.domain }),
    };
  }
}
