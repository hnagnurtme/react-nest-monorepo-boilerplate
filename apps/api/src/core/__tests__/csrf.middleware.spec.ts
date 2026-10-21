import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '@/config/index.js';
import { CsrfValidationFailedError } from '@/core/errors/index.js';
import { CsrfMiddleware } from '@/core/middleware/csrf.middleware.js';

interface RequestParts {
  method?: string;
  cookieHeader?: string;
  /** What `cookie-parser` exposes: the first value of each name, nothing more. */
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}

function makeConfig(corsOrigins: string[] = ['http://localhost:5173']): AppConfig {
  return {
    cookie: { csrfName: 'csrf_token' },
    webOrigin: 'http://localhost:5173',
    corsOrigins,
  } as unknown as AppConfig;
}

function call(parts: RequestParts, config = makeConfig()): () => void {
  const headers: Record<string, string> = { ...parts.headers };
  const request: Request = {
    method: parts.method ?? 'POST',
    headers: { cookie: parts.cookieHeader },
    cookies: parts.cookies ?? {},
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
  const response: Response = {} as unknown as Response;
  const next: NextFunction = vi.fn();
  const middleware = new CsrfMiddleware(config);

  return () => {
    middleware.use(request, response, next);
    expect(next).toHaveBeenCalledTimes(1);
  };
}

describe('CsrfMiddleware', () => {
  it('lets a request through when no CSRF cookie was sent', () => {
    expect(call({})).not.toThrow();
  });

  it('accepts the header matching the second cookie of that name', () => {
    // A browser that signed in before COOKIE_DOMAIN was set holds the
    // host-only cookie too and sends it first; `request.cookies` keeps only
    // that one, and the SPA reads the shared one.
    expect(
      call({
        cookieHeader: 'csrf_token=stale; csrf_token=fresh',
        cookies: { csrf_token: 'stale' },
        headers: { 'x-csrf-token': 'fresh' },
      }),
    ).not.toThrow();
  });

  it('rejects a header that matches no cookie of that name', () => {
    expect(
      call({
        cookieHeader: 'csrf_token=stale; csrf_token=fresh',
        cookies: { csrf_token: 'stale' },
        headers: { 'x-csrf-token': 'forged' },
      }),
    ).toThrow(CsrfValidationFailedError);
  });

  it('accepts any origin CORS already trusts with credentials', () => {
    expect(
      call(
        {
          cookieHeader: 'csrf_token=t',
          headers: { 'x-csrf-token': 't', origin: 'https://preview.example.com' },
        },
        makeConfig(['http://localhost:5173', 'https://preview.example.com']),
      ),
    ).not.toThrow();
  });

  it('rejects an origin neither WEB_ORIGIN nor CORS allows', () => {
    expect(
      call({
        cookieHeader: 'csrf_token=t',
        headers: { 'x-csrf-token': 't', origin: 'https://evil.example.com' },
      }),
    ).toThrow(CsrfValidationFailedError);
  });
});
