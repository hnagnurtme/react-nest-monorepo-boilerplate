import { createHmac, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { parseDuration } from '@/common/index.js';
import { AppConfig } from '@/config/index.js';
import { AccessTokenService, type IssuedAccessToken } from '@/core/auth/access-token.service.js';

import type { PublicUser } from './auth.types.js';

const REFRESH_TOKEN_BYTES = 32;

export interface IssuedRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  constructor(
    @Inject(AccessTokenService) private readonly accessTokens: AccessTokenService,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  async issueAccessToken(user: PublicUser): Promise<IssuedAccessToken> {
    return this.accessTokens.issue({
      sub: user.id,
      email: user.email,
    });
  }

  /** Retires one access token before its natural expiry. */
  async revokeAccessToken(jti: string): Promise<void> {
    await this.accessTokens.revoke(jti);
  }

  /**
   * Refresh tokens are opaque random bytes, not JWTs.
   *
   * A JWT would be self-validating, which is the opposite of what rotation
   * needs: the whole scheme depends on every refresh being a database lookup
   * that can notice the token was already spent.
   */
  issueRefreshToken(): IssuedRefreshToken {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
    };
  }

  /**
   * Keyed SHA-256. Only the digest is ever stored, so a dump of `sessions` is
   * worthless on its own — and keying it with the refresh secret means an
   * attacker holding the database but not the secret cannot even match the
   * tokens they already have against it.
   */
  hashRefreshToken(token: string): string {
    return createHmac('sha256', this.config.jwt.refreshSecret).update(token).digest('hex');
  }

  /** A CSRF token is a public nonce: it only has to be unguessable. */
  issueCsrfToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  get refreshTtlMs(): number {
    return parseDuration(this.config.jwt.refreshTtl);
  }
}
