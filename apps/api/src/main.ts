// The tracer MUST be imported before anything else: auto-instrumentation
// patches `http`, `pg` and `ioredis` at require time, and a wrong import order
// produces empty traces with no error to tell you why.
import '@/core/telemetry/tracer';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { getEnv } from '@/config/index.js';

import { AppModule } from './app.module.js';
import { setupApp } from './setup.js';

// Already parsed (and, on bad input, already exited) by the tracer import
// above; this just reads the memoised result.
const env = getEnv();

function registerProcessErrorHandlers(logger: Logger): void {
  process.once('uncaughtException', (error) => {
    logger.error({ err: error }, 'Uncaught exception detected');
    process.exit(1);
  });

  process.once('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection detected');
    process.exit(1);
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  registerProcessErrorHandlers(app.get(Logger));
  await setupApp(app, env);

  await app.listen(env.PORT);
}

void bootstrap();
