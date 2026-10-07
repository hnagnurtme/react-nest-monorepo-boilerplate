import { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import { ConnectedRedisThrottlerStorage } from '@/core/redis/connected-redis-throttler.storage.js';
import type { RedisService } from '@/core/redis/redis.service.js';

const THROTTLE_TTL_MS = 60_000;
const THROTTLE_LIMIT = 5;
const THROTTLE_BLOCK_MS = 60_000;
const FIRST_HIT = 1;
const NOT_BLOCKED = 0;

describe('ConnectedRedisThrottlerStorage', () => {
  it('connects the lazy Redis client before incrementing throttler counters', async () => {
    const redis = new Redis('redis://localhost:6379', {
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    const redisCall = vi
      .spyOn(redis, 'call')
      .mockResolvedValue([FIRST_HIT, THROTTLE_TTL_MS, NOT_BLOCKED, NOT_BLOCKED]);
    const connectIfNeeded = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const redisService: Pick<RedisService, 'connectIfNeeded'> = { connectIfNeeded };
    const storage = new ConnectedRedisThrottlerStorage(redis, redisService);

    try {
      await storage.increment(
        'login',
        THROTTLE_TTL_MS,
        THROTTLE_LIMIT,
        THROTTLE_BLOCK_MS,
        'default',
      );
    } finally {
      redis.disconnect();
    }

    expect(connectIfNeeded).toHaveBeenCalledOnce();
    expect(redisCall).toHaveBeenCalledOnce();
    expect(connectIfNeeded.mock.invocationCallOrder[0]).toBeLessThan(
      redisCall.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });
});
