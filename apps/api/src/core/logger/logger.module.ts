import { Module } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import type { TransportTargetOptions } from 'pino';

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
 * Where the log lines go.
 *
 * `pino-pretty` is the readable dev console; `pino-loki` ships the same lines
 * to Loki so Grafana can jump from a span to the logs that carry its
 * `traceId`. Both are optional and independent: a blank LOKI_URL leaves the
 * console alone, and production drops pretty-printing and keeps JSON on
 * stdout, which is what a container log collector expects.
 *
 * Returning an empty array would silence the logger entirely, so the stdout
 * target is always present.
 */
function buildTransportTargets(config: AppConfig): TransportTargetOptions[] {
  const targets: TransportTargetOptions[] = [
    config.isProduction
      ? { target: 'pino/file', options: { destination: 1 } }
      : { target: 'pino-pretty', options: { singleLine: true } },
  ];

  const { lokiUrl, serviceName } = config.telemetry;

  if (lokiUrl !== undefined) {
    targets.push({
      target: 'pino-loki',
      options: {
        host: lokiUrl,
        // The label set is what Loki indexes; everything else stays in the log
        // line. Keep it small and bounded — a label per traceId or per userId
        // makes one stream per request and brings Loki down.
        labels: { service: serviceName, env: config.nodeEnv },
        // A failed push must never take the API down with it, and a dev
        // machine without `just observability` running is the normal case.
        silenceErrors: true,
        batching: true,
        interval: 5,
      },
    });
  }

  return targets;
}

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
          transport: { targets: buildTransportTargets(config) },
        },
      }),
    }),
  ],
})
export class AppLoggerModule {}
