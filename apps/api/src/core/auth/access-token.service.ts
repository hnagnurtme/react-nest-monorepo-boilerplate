import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { UserRole } from '@repo/shared-types';

import { parseDuration } from '@/common/index.js';
import { AppConfig } from '@/config/index.js';
import { RedisService } from '@/core/redis/index.js';

/** The verified contents of an access token. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  jti: string;
}

export interface IssuedAccessToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

const DENYLIST_PREFIX = 'auth:denylist:';
const MS_PER_SECOND = 1000;

/**
 * Signs, verifies and revokes access tokens.
 *
 * Revocation lives here rather than beside the session table because a JWT is
 * valid by construction: the only way to retire one early is to keep a list of
 * ids that are no longer accepted, and that list has to be consulted by the
 * same code that verifies the signature.
 */
@Injectable()
export class AccessTokenService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async issue(claims: Omit<AccessTokenPayload, 'jti'>): Promise<IssuedAccessToken> {
    const jti = randomUUID();
    const ttlMs = parseDuration(this.config.jwt.accessTtl);

    const token = await this.jwt.signAsync(
      { ...claims, jti },
      {
        secret: this.config.jwt.accessSecret,
        // Seconds, not the "15m" string: only the number is typed, and every
        // other TTL in the flow is derived from the same parsed value so the
        // token, the cookie and the denylist entry cannot drift apart.
        expiresIn: Math.floor(ttlMs / MS_PER_SECOND),
      },
    );

    return { token, jti, expiresAt: new Date(Date.now() + ttlMs) };
  }

  /** Returns the payload, or undefined for anything that does not verify. */
  async verify(token: string): Promise<AccessTokenPayload | undefined> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });

      return (await this.isRevoked(payload.jti)) ? undefined : payload;
    } catch {
      // The reason is deliberately swallowed: telling a caller "expired" versus
      // "bad signature" tells an attacker which half of the token to work on.
      return undefined;
    }
  }

  /**
   * Retires one token immediately. The entry expires with the token itself, so
   * the denylist stays bounded rather than growing for the life of the system.
   */
  async revoke(jti: string): Promise<void> {
    const ttlSeconds = Math.ceil(parseDuration(this.config.jwt.accessTtl) / MS_PER_SECOND);
    await this.redis.setWithTtl(`${DENYLIST_PREFIX}${jti}`, '1', ttlSeconds);
  }

  private async isRevoked(jti: string): Promise<boolean> {
    return this.redis.exists(`${DENYLIST_PREFIX}${jti}`);
  }
}
