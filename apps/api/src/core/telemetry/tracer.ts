import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

import { getEnv } from '@/config/index.js';

/**
 * OpenTelemetry bootstrap.
 *
 * This module MUST be the first import of `main.ts`. Auto-instrumentation
 * monkey-patches `http`, `pg` and `ioredis` at require time; if anything loads
 * them first, the patches miss and you get empty traces with no error to
 * explain why.
 */
const env = getEnv();

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME }),
  // No endpoint configured: spans are still created (so traceId works and
  // correlates the logs) but nothing is shipped anywhere.
  ...(env.OTEL_EXPORTER_OTLP_ENDPOINT === undefined
    ? {}
    : { traceExporter: new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT }) }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // One span per file read drowns everything that matters.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.once('SIGTERM', () => {
  void sdk.shutdown();
});

export { sdk };
