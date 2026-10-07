import { Inject, Injectable } from '@nestjs/common';

import { AppConfig } from '@/config/index.js';

import type { CookieInstruction } from './auth.types.js';

/**
 * The refresh cookie is scoped to the auth routes and nothing else.
 *
 * A cookie on `/` rides along with every API request the browser makes, which
 * multiplies the places it can leak for no benefit — nothing outside these
 * endpoints ever reads it (docs/03-auth-flow-va-casl-abac.md 1.4).
 */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
export const REFRESH_COOKIE_NAME = 'refresh_token';

@Injectable()
export class AuthCookieFactory {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  /** httpOnly: JavaScript cannot read it, so XSS cannot steal it. */
  refresh(value: string, maxAgeMs: number): CookieInstruction {
    return {
      name: REFRESH_COOKIE_NAME,
      value,
      maxAgeMs,
      httpOnly: true,
      path: REFRESH_COOKIE_PATH,
    };
  }

  /**
   * Readable by design: the double-submit check works by having the client copy
   * this value into a header, which an attacker's origin cannot do.
   */
  csrf(value: string, maxAgeMs: number): CookieInstruction {
    return {
      name: this.config.cookie.csrfName,
      value,
      maxAgeMs,
      httpOnly: false,
      path: '/',
    };
  }

  /** Names to clear on logout, in the order the paths were set. */
  clearedNames(): string[] {
    return [REFRESH_COOKIE_NAME, this.config.cookie.csrfName];
  }
}
