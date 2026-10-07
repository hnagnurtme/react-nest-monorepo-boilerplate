import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AppConfig } from '@/config/index.js';
import { InvalidCredentialsError } from '@/core/errors/index.js';
import { RedisService } from '@/core/redis/index.js';

const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
const LOGIN_ATTEMPT_PREFIX = 'auth:login-attempts:';
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_ATTEMPT_WINDOW_SECONDS = 900;

/**
 * Password verification, plus the per-account brute-force limit that has to
 * wrap it.
 *
 * The two belong together: the global IP rate limiter does not help when an
 * attacker rotates addresses against a single inbox, which is the shape a
 * credential-stuffing run actually takes (docs/rules/07-security.md D4).
 */
@Injectable()
export class CredentialsService {
  private decoy: Promise<string> | undefined;

  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async hash(password: string): Promise<string> {
    return argon2.hash(password, this.options());
  }

  /**
   * Verifies a password against a digest, or against a decoy when the account
   * does not exist.
   *
   * Skipping the decoy would answer "no such user" an order of magnitude faster
   * than "wrong password", and login latency alone would enumerate registered
   * accounts — which is exactly what the identical error message required by
   * docs/rules/07-security.md D5 exists to prevent.
   */
  async matches(digest: string | undefined, password: string): Promise<boolean> {
    const target = digest ?? (await this.decoyDigest());
    const verified = await argon2.verify(target, password).catch(() => false);

    return digest !== undefined && verified;
  }

  /** Throws once an account has absorbed too many attempts in the window. */
  async assertAttemptsRemaining(email: string): Promise<void> {
    const key = attemptKey(email);
    const attempts = await this.redis.increment(key);
    if (attempts === 1) await this.redis.expire(key, LOGIN_ATTEMPT_WINDOW_SECONDS);

    if (attempts > MAX_LOGIN_ATTEMPTS) {
      // The same error as a wrong password: saying "too many attempts" would
      // confirm the address is worth attacking.
      throw new InvalidCredentialsError();
    }
  }

  async clearAttempts(email: string): Promise<void> {
    await this.redis.delete(attemptKey(email));
  }

  private async decoyDigest(): Promise<string> {
    // Built once, from a value nobody knows, with the live Argon2 parameters.
    this.decoy ??= argon2.hash(randomUUID(), this.options());
    return this.decoy;
  }

  private options(): argon2.HashOptions {
    return {
      type: argon2.argon2id,
      memoryCost: this.config.argon2MemoryCost,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
    };
  }
}

/** The address never becomes a Redis key in the clear — keys end up in dumps. */
function attemptKey(email: string): string {
  return `${LOGIN_ATTEMPT_PREFIX}${createHash('sha256').update(email).digest('hex')}`;
}
