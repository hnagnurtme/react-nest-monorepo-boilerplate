import { describe, expect, it, vi, afterEach } from 'vitest';

import { apiClient } from '@/lib/http/client';
import {
  CSRF_COOKIE_NAME,
  expireCsrfCookie,
  isCsrfFailure,
  isCsrfRecoverableEndpoint,
} from '@/lib/http/csrf';
import { HTTP_METHOD } from '@/lib/http/types';

import { jsonResponse } from './fixtures/auth';

describe('apiClient write helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a JSON body with PUT and no body with DELETE', async () => {
    const fetchMock = vi
      .fn<(url: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(jsonResponse({ data: { id: 'user-1' } }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.put('/api/v1/users/{id}/roles', { roleIds: ['role-1'] });
    await apiClient.delete('/api/v1/users/{id}');

    const [putCall, deleteCall] = fetchMock.mock.calls;
    expect(putCall?.[1]?.method).toBe('PUT');
    expect(JSON.parse(putCall?.[1]?.body as string)).toEqual({ roleIds: ['role-1'] });
    expect(deleteCall?.[1]?.method).toBe('DELETE');
    expect(deleteCall?.[1]?.body).toBeUndefined();
  });
});

describe('CSRF helpers', () => {
  it('expires the readable cookie so a stale value stops failing the check', () => {
    document.cookie = `${CSRF_COOKIE_NAME}=stale; path=/`;
    expireCsrfCookie();

    expect(document.cookie).not.toContain('stale');
  });

  it('only treats login and refresh as safe to auto-retry', () => {
    expect(isCsrfRecoverableEndpoint('/api/v1/auth/login')).toBe(true);
    expect(isCsrfRecoverableEndpoint('/api/v1/auth/refresh')).toBe(true);
    expect(isCsrfRecoverableEndpoint('/api/v1/users')).toBe(false);
  });

  it('recognises a CSRF failure only on a 403 carrying the code', async () => {
    await expect(
      isCsrfFailure(jsonResponse({ code: 'CSRF_VALIDATION_FAILED' }, 403)),
    ).resolves.toBe(true);
    await expect(isCsrfFailure(jsonResponse({ code: 'FORBIDDEN' }, 403))).resolves.toBe(false);
    await expect(isCsrfFailure(jsonResponse({}, 500))).resolves.toBe(false);
  });
});

describe('HTTP_METHOD', () => {
  it('names the lowercase verbs the generated contract uses as keys', () => {
    expect(HTTP_METHOD.GET).toBe('get');
    expect(HTTP_METHOD.PATCH).toBe('patch');
  });
});
