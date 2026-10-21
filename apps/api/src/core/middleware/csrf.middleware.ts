import { timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { CSRF_HEADER } from '@/common/index.js';
import { AppConfig } from '@/config/index.js';
import { CsrfValidationFailedError } from '@/core/errors/index.js';

/**
 * Every value the browser sent under `name`, in the order it sent them.
 *
 * `request.cookies` keeps only the first. A browser holds two cookies of one
 * name when their domains differ — a host-only `csrf_token` left from before
 * `COOKIE_DOMAIN` was set, beside the shared one — and sends both, the older
 * first. The SPA reads the shared one, so checking the first alone failed every
 * write from that browser with no way for the SPA to recover: it cannot see,
 * let alone expire, a cookie that belongs to the API's host.
 */
function cookieValues(header: string | undefined, name: string): string[] {
  if (header === undefined) return [];
  const values: string[] = [];
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1 || pair.slice(0, separator).trim() !== name) continue;
    const raw = pair.slice(separator + 1).trim();
    try {
      values.push(decodeURIComponent(raw));
    } catch {
      values.push(raw);
    }
  }
  return values;
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

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
    const sent = cookieValues(request.headers.cookie, cookieName);
    const cookieTokens = sent.length > 0 ? sent : [cookies?.[cookieName]].filter(isString);

    // No CSRF cookie means no cookie-based session to ride on.
    if (cookieTokens.length === 0) {
      next();
      return;
    }

    const headerToken = request.get(CSRF_HEADER);
    if (
      headerToken === undefined ||
      !cookieTokens.some((cookieToken) => constantTimeEquals(cookieToken, headerToken))
    ) {
      throw new CsrfValidationFailedError();
    }

    // Belt and braces: an attacker's page cannot set a matching Origin. Any
    // origin CORS already trusts with credentials counts — a second address
    // for the SPA (a tunnel, a preview host) otherwise passes CORS and then
    // fails here on every write.
    const origin = request.get('origin');
    if (
      origin !== undefined &&
      origin !== this.config.webOrigin &&
      !this.config.corsOrigins.includes(origin)
    ) {
      throw new CsrfValidationFailedError();
    }

    next();
  }
}
