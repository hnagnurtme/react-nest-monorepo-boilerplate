import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { AppConfig } from '@/config/index.js';
import type { RedisService } from '@/core/redis/index.js';
import { InvitationService } from '@/modules/auth/invitation.service.js';

interface MockRedis {
  get: Mock;
  setWithTtl: Mock;
  delete: Mock;
}

const TTL_HOURS = 72;
const SECONDS_PER_HOUR = 3600;

describe('InvitationService', () => {
  let redis: MockRedis;
  let service: InvitationService;

  beforeEach(() => {
    redis = { get: vi.fn(), setWithTtl: vi.fn(), delete: vi.fn() };
    service = new InvitationService(
      redis as unknown as RedisService,
      {
        invitationTtlHours: TTL_HOURS,
      } as unknown as AppConfig,
    );
  });

  it('stores only the hash of the token, under the configured TTL', async () => {
    const token = await service.issue('user-1');

    expect(redis.setWithTtl).toHaveBeenCalledTimes(1);
    const [key, value, ttl] = redis.setWithTtl.mock.calls[0] as [string, string, number];

    expect(value).toBe('user-1');
    expect(ttl).toBe(TTL_HOURS * SECONDS_PER_HOUR);
    expect(key.startsWith('auth:invite:')).toBe(true);
    // The plaintext must not be recoverable from the key.
    expect(key).not.toContain(token);
  });

  it('mints a different token every time', async () => {
    const [first, second] = [await service.issue('user-1'), await service.issue('user-1')];

    expect(first).not.toBe(second);
  });

  it('peek returns the user without spending the token', async () => {
    redis.get.mockResolvedValue('user-1');

    await expect(service.peek('token')).resolves.toBe('user-1');
    expect(redis.delete).not.toHaveBeenCalled();
  });

  it('consume returns the user and burns the key', async () => {
    redis.get.mockResolvedValue('user-1');

    await expect(service.consume('token')).resolves.toBe('user-1');
    expect(redis.delete).toHaveBeenCalledTimes(1);
  });

  it('consume returns undefined for an expired or unknown token, and burns nothing', async () => {
    redis.get.mockResolvedValue(null);

    await expect(service.consume('token')).resolves.toBeUndefined();
    expect(redis.delete).not.toHaveBeenCalled();
  });
});
