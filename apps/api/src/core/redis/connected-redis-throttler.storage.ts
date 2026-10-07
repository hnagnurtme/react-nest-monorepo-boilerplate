import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

import type { RedisService } from './redis.service.js';

type RedisConnection = Pick<RedisService, 'connectIfNeeded'>;

/**
 * ioredis with lazyConnect + enableOfflineQueue=false rejects commands until
 * the socket is writable. The throttler receives the raw Redis client, so make
 * the connection explicit before its first Lua script call.
 */
export class ConnectedRedisThrottlerStorage implements ThrottlerStorage {
  private readonly storage: ThrottlerStorageRedisService;

  constructor(
    redis: Redis,
    private readonly redisService: RedisConnection,
  ) {
    this.storage = new ThrottlerStorageRedisService(redis);
  }

  // Signature is fixed by @nestjs/throttler's ThrottlerStorage interface.

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ReturnType<ThrottlerStorage['increment']> {
    await this.redisService.connectIfNeeded();
    return this.storage.increment(key, ttl, limit, blockDuration, throttlerName);
  }
}
