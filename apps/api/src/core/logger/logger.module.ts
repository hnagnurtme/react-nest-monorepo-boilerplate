import { Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';

import { AppConfig } from '@/config/index.js';
import { CLS_KEYS, type AppClsStore } from '@/core/database/request-context.js';

/**
 * Field paths Pino blanks out before anything reaches disk.
 *
 * This is a safety net, not permission to log freely — the rule is still not
 * to pass these values to the logger in the first place
 * (docs/rules/07-security.md E1/G3).
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.tokenHash',
];

/**
 * Pino, wired so every line already carries the request's identity.
 *
 * The `mixin` is what makes a log searchable: without it you can read that
 * "something failed" but not which tenant it failed for, and grepping a
 * concatenated message string is not a substitute
 * (docs/rules/02-backend-nestjs.md G2).
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig, ClsService],
      useFactory: (config: AppConfig, cls: ClsService<AppClsStore>) => ({
        pinoHttp: {
          level: config.logLevel,
          redact: { paths: REDACT_PATHS, censor: '[redacted]' },
          mixin: () => ({
            // The W3C trace id, seeded into CLS when the request enters, so a
            // log line and a span can be joined by the same value the client
            // saw in the `x-trace-id` response header.
            traceId: cls.get(CLS_KEYS.traceId) ?? cls.getId(),
            userId: cls.get(CLS_KEYS.userId),
            tenantId: cls.get(CLS_KEYS.tenantId),
          }),
          ...(config.isProduction
            ? {}
            : { transport: { target: 'pino-pretty', options: { singleLine: true } } }),
        },
      }),
    }),
  ],
})
export class AppLoggerModule {}
