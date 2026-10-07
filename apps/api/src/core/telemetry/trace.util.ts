import { trace } from '@opentelemetry/api';

/**
 * The current W3C trace id, or undefined outside an active span (a cron tick,
 * a unit test). Callers must treat it as optional rather than assert it.
 */
export function getActiveTraceId(): string | undefined {
  return trace.getActiveSpan()?.spanContext().traceId;
}
