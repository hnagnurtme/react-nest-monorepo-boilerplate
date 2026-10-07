export interface SwaggerRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
}

interface BrowserWindow {
  location: { origin: string };
  __APP_CSRF_COOKIE_NAME__?: string;
}

interface BrowserDocument {
  cookie: string;
}

declare const window: BrowserWindow;
declare const document: BrowserDocument;

/**
 * Served as a same-origin script so Helmet's `script-src 'self'` policy still
 * allows Swagger UI to receive the configured (non-secret) cookie name.
 */
export function createSwaggerCsrfConfigScript(cookieName: string): string {
  return `window.__APP_CSRF_COOKIE_NAME__ = ${JSON.stringify(cookieName)};`;
}

/**
 * This function is serialized by @nestjs/swagger and executed in the Swagger
 * UI browser context. It must therefore not close over any server-side values.
 */
export function addSwaggerCsrfHeader(request: SwaggerRequest): SwaggerRequest {
  const method = request.method?.toUpperCase();
  if (method === undefined || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return request;
  }

  const origin = window.location.origin;
  if (new URL(request.url, origin).origin !== origin) return request;

  const cookieName = window.__APP_CSRF_COOKIE_NAME__;
  if (typeof cookieName !== 'string') return request;

  const cookiePrefix = `${cookieName}=`;
  const csrfCookie = document.cookie.split('; ').find((cookie) => cookie.startsWith(cookiePrefix));
  if (csrfCookie === undefined) return request;

  return {
    ...request,
    headers: {
      ...request.headers,
      'x-csrf-token': decodeURIComponent(csrfCookie.slice(cookiePrefix.length)),
    },
  };
}
