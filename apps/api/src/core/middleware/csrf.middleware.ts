import { timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { CSRF_HEADER } from '@/common/index.js';
import { AppConfig } from '@/config/index.js';
import { CsrfValidationFailedError } from '@/core/errors/index.js';

/** Methods that cannot change state, so there is nothing to forge. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, and the lengths themselves are
  // not a secret, so compare them first.
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Double-submit CSRF check for cookie-authenticated requests.
 *
 * The refresh cookie is `SameSite=Lax` rather than `Strict`, because `Strict`
 * drops the cookie when the browser returns from a payment or OAuth redirect
 * and logs the user out mid-checkout. `Lax` buys that back at the cost of
 * needing this check — the two are a package, and shipping one without the
 * other is the security hole (docs/03-auth-flow-va-casl-abac.md 1.4).
 *
 * A bearer-token request carries no cookies, so it cannot be forged this way
 * and is left alone.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const cookieName = this.config.cookie.csrfName;
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    const cookieToken = cookies?.[cookieName];

    // No CSRF cookie means no cookie-based session to ride on.
    if (cookieToken === undefined) {
      next();
      return;
    }

    const headerToken = request.get(CSRF_HEADER);
    if (headerToken === undefined || !constantTimeEquals(cookieToken, headerToken)) {
      throw new CsrfValidationFailedError();
    }

    // Belt and braces: an attacker's page cannot set a matching Origin.
    const origin = request.get('origin');
    if (origin !== undefined && origin !== this.config.webOrigin) {
      throw new CsrfValidationFailedError();
    }

    next();
  }
}
