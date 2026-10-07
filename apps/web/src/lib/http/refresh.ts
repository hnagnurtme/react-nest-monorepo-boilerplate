/**
 * Refresh session management with single-flight and cross-tab coordination.
 *
 * Single-flight: Multiple concurrent calls to refreshSession() share one network request.
 * Cross-tab lock: Uses navigator.locks to prevent multiple tabs from refreshing simultaneously,
 * avoiding TOKEN_REUSE_DETECTED from backend.
 */

import { env } from '@/config/env';

import { CSRF_HEADER_NAME, expireCsrfCookie, isCsrfFailure } from './csrf';

export type RefreshOutcome =
  | { kind: 'refreshed'; accessToken: string; user: unknown; csrfToken?: string }
  | { kind: 'unauthenticated' } // 401 UNAUTHENTICATED: not logged in / expired
  | { kind: 'reuse-detected' } // 401 TOKEN_REUSE_DETECTED: family revoked
  | { kind: 'unavailable' }; // 429 / 5xx / network error

type RefreshHandler = (outcome: RefreshOutcome) => void;

let refreshHandler: RefreshHandler | null = null;
let inFlight: Promise<RefreshOutcome> | null = null;

const REFRESH_LOCK_NAME = 'app-refresh';
const REFRESH_ENDPOINT = `${env.VITE_API_URL.replace(/\/$/, '')}/api/v1/auth/refresh`;

/**
 * Get CSRF token from cookie.
 */
function getCsrfToken(): string | null {
  const regex = /(?:^|;\s*)csrf_token=([^;]+)/;
  const match = regex.exec(document.cookie);
  return match?.[1] ?? null;
}

/**
 * Refresh session. Multiple concurrent calls share one promise (single-flight).
 * Uses navigator.locks to coordinate across tabs.
 */
export async function refreshSession(): Promise<RefreshOutcome> {
  // Single-flight: return existing promise if already in progress
  if (inFlight) {
    return inFlight;
  }

  // Create new refresh promise
  inFlight = executeRefresh();

  try {
    const outcome = await inFlight;
    refreshHandler?.(outcome);
    return outcome;
  } finally {
    inFlight = null;
  }
}

async function executeRefresh(): Promise<RefreshOutcome> {
  // Use navigator.locks if available for cross-tab coordination
  const nav =
    typeof navigator !== 'undefined' ? (navigator as unknown as Record<string, unknown>) : null;
  if (nav?.['locks']) {
    return (nav['locks'] as LockManager).request(REFRESH_LOCK_NAME, async () => {
      return performRefresh();
    });
  }

  // Fallback: no cross-tab lock (accept risk of concurrent refresh)
  return performRefresh();
}

async function performRefresh(isCsrfRetry = false): Promise<RefreshOutcome> {
  const csrfToken = getCsrfToken();

  try {
    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken && { [CSRF_HEADER_NAME]: csrfToken }),
      },
    });

    if (response.ok) {
      const body = (await response.json()) as {
        data: { accessToken: string; user: unknown; csrfToken?: string };
      };
      const result: RefreshOutcome = {
        kind: 'refreshed',
        accessToken: body.data.accessToken,
        user: body.data.user,
      };
      if (body.data.csrfToken) {
        result.csrfToken = body.data.csrfToken;
      }
      return result;
    }

    // Stale CSRF cookie: expire it and retry once
    if (!isCsrfRetry && (await isCsrfFailure(response))) {
      expireCsrfCookie();
      return await performRefresh(true);
    }

    // Handle error responses
    if (response.status === 401) {
      const problem = (await response.json().catch(() => ({}))) as { code?: string };
      if (problem.code === 'TOKEN_REUSE_DETECTED') {
        return { kind: 'reuse-detected' };
      }
      return { kind: 'unauthenticated' };
    }

    // 429, 5xx, or other errors
    return { kind: 'unavailable' };
  } catch {
    // Network error
    return { kind: 'unavailable' };
  }
}

/**
 * Register handler to be called after each refresh.
 * Called once per actual refresh (not per concurrent caller).
 */
export function setRefreshHandler(handler: RefreshHandler): void {
  refreshHandler = handler;
}

/**
 * Reset for tests only.
 */
export function resetRefreshForTests(): void {
  refreshHandler = null;
  inFlight = null;
}
