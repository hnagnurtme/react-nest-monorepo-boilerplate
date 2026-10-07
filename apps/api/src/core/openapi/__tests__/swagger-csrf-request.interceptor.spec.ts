import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addSwaggerCsrfHeader,
  createSwaggerCsrfConfigScript,
  type SwaggerRequest,
} from '@/core/openapi/swagger-csrf-request.interceptor.js';

describe('addSwaggerCsrfHeader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('copies the CSRF cookie into same-origin state-changing Swagger requests', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:3000' },
      __APP_CSRF_COOKIE_NAME__: 'csrf_token',
    });
    vi.stubGlobal('document', { cookie: 'csrf_token=csrf-value' });
    const request: SwaggerRequest = {
      url: '/api/v1/auth/login',
      method: 'POST',
      headers: { accept: 'application/json' },
    };

    expect(addSwaggerCsrfHeader(request)).toEqual({
      ...request,
      headers: { accept: 'application/json', 'x-csrf-token': 'csrf-value' },
    });
  });

  it('uses the configured CSRF cookie name', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:3000' },
      __APP_CSRF_COOKIE_NAME__: 'app_csrf',
    });
    vi.stubGlobal('document', { cookie: 'app_csrf=configured-value' });
    const request: SwaggerRequest = { url: '/api/v1/auth/login', method: 'POST' };

    expect(addSwaggerCsrfHeader(request)).toEqual({
      ...request,
      headers: { 'x-csrf-token': 'configured-value' },
    });
  });

  it('serializes a configured cookie name as a browser configuration script', () => {
    expect(createSwaggerCsrfConfigScript('app_csrf')).toBe(
      'window.__APP_CSRF_COOKIE_NAME__ = "app_csrf";',
    );
  });

  it('does not expose the CSRF token to a cross-origin Swagger server', () => {
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:3000' },
      __APP_CSRF_COOKIE_NAME__: 'csrf_token',
    });
    vi.stubGlobal('document', { cookie: 'csrf_token=csrf-value' });
    const request: SwaggerRequest = {
      url: 'https://untrusted.example/api',
      method: 'POST',
    };

    expect(addSwaggerCsrfHeader(request)).toBe(request);
  });
});
