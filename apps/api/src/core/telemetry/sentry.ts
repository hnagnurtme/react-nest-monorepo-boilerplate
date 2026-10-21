import * as Sentry from '@sentry/node';

import { getEnv } from '@/config/index.js';

/**
 * Sentry bootstrap (errors only; reporting goes through ./error-reporter).
 *
 * MUST be imported right after `./tracer` in main.ts: Sentry attaches to the
 * OpenTelemetry provider that the tracer registers instead of installing its
 * own, so the provider has to exist first. Spans keep going to the OTLP
 * exporter, never to Sentry — hence no tracesSampleRate.
 */
const env = getEnv();

// main.ts owns process exit: it reports, flushes, then exits. Sentry's own
// handlers would report the same crash a second time.
const PROCESS_HANDLER_INTEGRATIONS = new Set(['OnUncaughtException', 'OnUnhandledRejection']);

// No DSN: init is a no-op and every report is dropped, like the OTLP exporter
// without an endpoint.
Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  enableOpenTelemetrySetup: false,
  integrations: (defaults) =>
    defaults.filter((integration) => !PROCESS_HANDLER_INTEGRATIONS.has(integration.name)),
});
