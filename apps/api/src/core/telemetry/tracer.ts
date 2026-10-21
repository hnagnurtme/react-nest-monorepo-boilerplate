import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

import { getEnv } from '@/config/index.js';

/**
 * OpenTelemetry bootstrap: traces and metrics.
 *
 * This module MUST be the first import of `main.ts`. Auto-instrumentation
 * monkey-patches `http`, `pg` and `ioredis` at require time; if anything loads
 * them first, the patches miss and you get empty traces with no error to
 * explain why.
 */
const env = getEnv();

/**
 * Prometheus scrape endpoint, on a listener of its own.
 *
 * The exporter runs its own HTTP server rather than adding a route to Nest:
 * `/metrics` must answer without the auth stack, and a separate port is one a
 * deployment can keep off the public load balancer. Undefined when
 * PROMETHEUS_METRICS_PORT is blank — then no meter is read and no port opens,
 * exactly like a blank OTLP endpoint.
 */
const metricReader =
  env.PROMETHEUS_METRICS_PORT === undefined
    ? undefined
    : new PrometheusExporter({ port: env.PROMETHEUS_METRICS_PORT, endpoint: '/metrics' });

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME }),
  // No endpoint configured: spans are still created (so traceId works and
  // correlates the logs) but nothing is shipped anywhere.
  ...(env.OTEL_EXPORTER_OTLP_ENDPOINT === undefined
    ? {}
    : { traceExporter: new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT }) }),
  // `exactOptionalPropertyTypes` rejects an explicit `undefined` here, so the
  // key is spread in or left out entirely.
  ...(metricReader === undefined ? {} : { metricReader }),
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
