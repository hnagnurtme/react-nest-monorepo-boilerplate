import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppConfig } from '@/config/index.js';

import { REDIS } from './redis.constants.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Redis =>
        new Redis(config.redisUrl, {
          maxRetriesPerRequest: 2,
          // Fail the request rather than queue it forever behind a dead Redis:
          // a silent queue turns a cache outage into a hung API.
          enableOfflineQueue: false,
          // Connect on first use, so building the DI container (which the
          // OpenAPI export does, with no infrastructure running) never opens a
          // socket. /readyz is what reports whether the connection is healthy.
          lazyConnect: true,
        }),
    },
    RedisService,
  ],
  exports: [REDIS, RedisService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * `quit()` throws if the client never connected — which is the normal case
   * for a process that only built the container (the OpenAPI export) and for a
   * boot that failed before its first query.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis.status === 'end' || this.redis.status === 'wait') {
      this.redis.disconnect();
      return;
    }

    await this.redis.quit();
  }
}
