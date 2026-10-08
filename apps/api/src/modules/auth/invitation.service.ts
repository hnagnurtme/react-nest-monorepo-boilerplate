import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { AppConfig } from '@/config/index.js';
import { RedisService } from '@/core/redis/index.js';

const INVITATION_PREFIX = 'auth:invite:';
const TOKEN_BYTES = 32;
const SECONDS_PER_HOUR = 3600;

/**
 * Invitation tokens live in Redis, keyed by their hash, exactly like the reset
 * OTP. The trade-off is deliberate: no migration and no new RLS policy, at the
 * cost of losing outstanding invitations if Redis is flushed. An admin resends
 * in that case (`POST /users/:id/resend-invitation`).
 *
 * Only the hash is stored, so a dump of Redis does not hand out live links.
 */
@Injectable()
export class InvitationService {
  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  get ttlHours(): number {
    return this.config.invitationTtlHours;
  }

  /** Mints a token for `userId` and returns the plaintext — the only copy. */
  async issue(userId: string): Promise<string> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');

    await this.redis.setWithTtl(
      keyFor(token),
      userId,
      this.config.invitationTtlHours * SECONDS_PER_HOUR,
    );

    return token;
  }

  /** Reads the token without spending it, for the pre-fill screen. */
  async peek(token: string): Promise<string | undefined> {
    return (await this.redis.get(keyFor(token))) ?? undefined;
  }

  /** Reads and burns the token: an invitation link works exactly once. */
  async consume(token: string): Promise<string | undefined> {
    const key = keyFor(token);
    const userId = await this.redis.get(key);
    if (userId === null) return undefined;

    await this.redis.delete(key);
    return userId;
  }

  /** Invalidates an outstanding link, used when a fresh one is sent. */
  async revoke(token: string): Promise<void> {
    await this.redis.delete(keyFor(token));
  }
}

function keyFor(token: string): string {
  return `${INVITATION_PREFIX}${createHash('sha256').update(token).digest('hex')}`;
}
