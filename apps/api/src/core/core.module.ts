import { Global, Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { trace } from '@opentelemetry/api';
import { Redis } from 'ioredis';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';

import { AppConfig } from '@/config/index.js';

import { AccessTokenService } from './auth/access-token.service.js';
import { DrizzleModule } from './database/drizzle.module.js';
import { CLS_KEYS } from './database/request-context.js';
import { TransactionManager } from './database/transaction.manager.js';
import { GlobalExceptionFilter } from './filters/global-exception.filter.js';
import { JwtAuthGuard, PoliciesGuard } from './guards/index.js';
import { TransformInterceptor } from './interceptors/transform.interceptor.js';
import { AppLoggerModule } from './logger/logger.module.js';
import { MailModule } from './mail/mail.module.js';
import { CsrfMiddleware } from './middleware/csrf.middleware.js';
import { ConnectedRedisThrottlerStorage } from './redis/connected-redis-throttler.storage.js';
import { REDIS, RedisModule } from './redis/index.js';
import { RedisService } from './redis/redis.service.js';

const DEFAULT_THROTTLE_TTL_SECONDS = 60;
const DEFAULT_THROTTLE_LIMIT = 120;

/**
 * Technical infrastructure, loaded exactly once at the composition root.
 *
 * Global so a feature module can inject `TransactionManager` without
 * re-importing plumbing — which is also what stops it reaching for a raw
 * connection instead.
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        // Mounted by hand below: the built-in mount uses the Express 4 wildcard
        // syntax, which Express 5 warns about on every boot.
        mount: false,
        setup: (cls) => {
          // Seeded here so the very first log line of a request already
          // correlates; JwtAuthGuard adds the identity once it is verified.
          cls.set(CLS_KEYS.traceId, trace.getActiveSpan()?.spanContext().traceId);
        },
      },
    }),
    AppLoggerModule,
    RedisModule,
    DrizzleModule,
    MailModule,
    // No default secret: access and refresh tokens are signed with different
    // secrets, so every call passes its own explicitly.
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      inject: [AppConfig, REDIS, RedisService],
      useFactory: (config: AppConfig, redis: Redis, redisService: RedisService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: seconds(DEFAULT_THROTTLE_TTL_SECONDS),
            limit: DEFAULT_THROTTLE_LIMIT,
          },
        ],
        // Redis rather than in-memory: counters must be shared, or N replicas
        // silently multiply every limit by N.
        storage: new ConnectedRedisThrottlerStorage(redis, redisService),
        skipIf: () => config.nodeEnv === 'test',
      }),
    }),
  ],
  providers: [
    AppConfig,
    AccessTokenService,
    TransactionManager,
    GlobalExceptionFilter,
    TransformInterceptor,
    PoliciesGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [
    AppConfig,
    AccessTokenService,
    TransactionManager,
    GlobalExceptionFilter,
    TransformInterceptor,
    PoliciesGuard,
    JwtModule,
    MailModule,
  ],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // ClsMiddleware first: everything downstream reads the store it opens.
    consumer.apply(ClsMiddleware, CsrfMiddleware).forRoutes('{*splat}');
  }
}
