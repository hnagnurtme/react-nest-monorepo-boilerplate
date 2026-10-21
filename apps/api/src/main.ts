// The tracer MUST be imported before anything else: auto-instrumentation
// patches `http`, `pg` and `ioredis` at require time, and a wrong import order
// produces empty traces with no error to tell you why.
import '@/core/telemetry/tracer';
// Second, not first: Sentry attaches to the OpenTelemetry provider the tracer registers.
import '@/core/telemetry/sentry';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { getEnv } from '@/config/index.js';
import { flushErrorReports, reportError } from '@/core/telemetry/error-reporter.js';
import { sdk } from '@/core/telemetry/tracer.js';

import { AppModule } from './app.module.js';
import { setupApp } from './setup.js';

// Already parsed (and, on bad input, already exited) by the tracer import
// above; this just reads the memoised result.
const env = getEnv();

const CRASH_FLUSH_TIMEOUT_MS = 2000;

function registerProcessErrorHandlers(logger: Logger): void {
  // Report, then exit once both the error report and the batched spans have
  // left: the report's trace_id is useless if the trace it points at died in
  // the exporter queue. Bounded, so a dead backend cannot keep a crashed
  // process alive.
  const crash = (error: unknown): void => {
    reportError(error);
    const deadline = new Promise<void>((resolve) => {
      setTimeout(resolve, CRASH_FLUSH_TIMEOUT_MS).unref();
    });
    const flushed = Promise.allSettled([flushErrorReports(CRASH_FLUSH_TIMEOUT_MS), sdk.shutdown()]);
    void Promise.race([flushed, deadline]).finally(() => process.exit(1));
  };

  process.once('uncaughtException', (error) => {
    logger.error({ err: error }, 'Uncaught exception detected');
    crash(error);
  });

  process.once('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection detected');
    crash(reason);
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  registerProcessErrorHandlers(app.get(Logger));
  await setupApp(app, env);

  await app.listen(env.PORT);
}

void bootstrap();
