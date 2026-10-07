import type { Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

import { RedisService } from '@/core/redis/redis.service.js';

interface RedisClientFixture {
  status: string;
  connect: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
}

function makeClient(status: string): RedisClientFixture {
  return {
    status,
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
  };
}

describe('RedisService', () => {
  it('waits for a lazy Redis connection before the first health ping', async () => {
    const client = makeClient('wait');
    const service = new RedisService(client as unknown as Redis);

    await service.ping();

    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.ping).toHaveBeenCalledOnce();
    expect(client.connect.mock.invocationCallOrder[0]).toBeLessThan(
      client.ping.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('shares the initial connection while concurrent health probes wait', async () => {
    let resolveConnection: (() => void) | undefined;
    const connection = new Promise<void>((resolve) => {
      resolveConnection = resolve;
    });
    const client = makeClient('wait');
    client.connect.mockReturnValue(connection);
    const service = new RedisService(client as unknown as Redis);

    const firstPing = service.ping();
    const secondPing = service.ping();
    resolveConnection?.();
    await Promise.all([firstPing, secondPing]);

    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.ping).toHaveBeenCalledTimes(2);
  });
});
