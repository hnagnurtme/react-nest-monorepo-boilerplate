import * as Sentry from '@sentry/node';

/**
 * Error reporting to a Sentry-compatible backend. Initialised by
 * `./sentry` from main.ts; until then (unit tests, scripts) both calls are
 * no-ops, so importing this module never needs a valid environment.
 */

export interface ErrorReportTags {
  /** W3C trace id, the key to the matching trace in the tracing backend. */
  trace_id?: string | undefined;
  code?: string | undefined;
}

export function reportError(error: unknown, tags: ErrorReportTags = {}): void {
  const defined = Object.fromEntries(
    Object.entries(tags).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  Sentry.captureException(error, { tags: defined });
}

/** Waits (bounded) for queued reports to leave, e.g. before `process.exit`. */
export async function flushErrorReports(timeoutMs = 2000): Promise<void> {
  await Sentry.flush(timeoutMs);
}
