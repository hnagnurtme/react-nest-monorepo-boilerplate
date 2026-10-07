import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS } from './redis.constants.js';

/**
 * The only way into Redis from outside `core`.
 *
 * Feature modules are barred from importing `ioredis` directly, so the set of
 * operations the application relies on stays visible in one file — and
 * swapping the client, or adding a namespace prefix, does not become a
 * repo-wide edit.
 */
@Injectable()
export class RedisService {
  private connectionPromise: Promise<void> | undefined;

  constructor(@Inject(REDIS) private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Sets a key that expires on its own; nothing here is worth keeping forever. */
  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Returns the new count, so a caller can act on the first increment. */
  async increment(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  async ping(): Promise<void> {
    await this.connectIfNeeded();
    await this.client.ping();
  }

  async connectIfNeeded(): Promise<void> {
    if (this.connectionPromise !== undefined) {
      await this.connectionPromise;
      return;
    }

    if (this.client.status !== 'wait') return;

    const connection = this.client.connect();
    this.connectionPromise = connection;

    try {
      await connection;
    } finally {
      if (this.connectionPromise === connection) this.connectionPromise = undefined;
    }
  }
}
