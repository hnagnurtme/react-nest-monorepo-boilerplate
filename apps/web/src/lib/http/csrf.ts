export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const CSRF_FAILURE_CODE = 'CSRF_VALIDATION_FAILED';

const FORBIDDEN_STATUS = 403;
const AUTH_ENDPOINT_PATTERN = /\/auth\/(login|refresh)(?:\?|$)/;

/**
 * Expire the (readable, non-httpOnly) CSRF cookie so a stale value from an earlier session
 * cannot keep failing the double-submit check. The next response re-issues a fresh one.
 */
export function expireCsrfCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${CSRF_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; path=/`;
}

/** True when the endpoint is login/refresh, the only calls safe to auto-retry after a CSRF reset. */
export function isCsrfRecoverableEndpoint(endpoint: string): boolean {
  return AUTH_ENDPOINT_PATTERN.test(endpoint);
}

/** Peek at a 403 response (without consuming it) to see whether it is a CSRF failure. */
export async function isCsrfFailure(response: Response): Promise<boolean> {
  if (response.status !== FORBIDDEN_STATUS) return false;
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    (body as { code?: unknown }).code === CSRF_FAILURE_CODE
  );
}
