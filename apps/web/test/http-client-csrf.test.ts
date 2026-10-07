import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rawRequest } from '@/lib/http/client';

function csrfFailure(): Response {
  return new Response(
    JSON.stringify({ status: 403, code: 'CSRF_VALIDATION_FAILED', title: 'Forbidden' }),
    { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function ok(): Response {
  return new Response(JSON.stringify({ data: { ok: true } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function readCsrfCookie(): string | undefined {
  return document.cookie.split('; ').find((entry) => entry.startsWith('csrf_token='));
}

describe('http client: stale CSRF cookie recovery', () => {
  beforeEach(() => {
    document.cookie = 'csrf_token=stale-value; path=/';
  });

  afterEach(() => {
    document.cookie = 'csrf_token=; Max-Age=0; path=/';
  });

  it('expires the csrf cookie and retries login once without the stale header', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(csrfFailure()).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetchMock);

    const result = await rawRequest<{ ok: boolean }>('/api/v1/auth/login', {
      method: 'POST',
      body: '{}',
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Headers;
    const second = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Headers;
    expect(first.get('x-csrf-token')).toBe('stale-value');
    expect(second.get('x-csrf-token')).toBeNull();
    expect(readCsrfCookie()).toBeUndefined();
  });

  it('retries only once, then surfaces the error', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(csrfFailure()));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      rawRequest('/api/v1/auth/login', { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ status: 403, code: 'CSRF_VALIDATION_FAILED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry CSRF failures on other endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(csrfFailure()));
    vi.stubGlobal('fetch', fetchMock);

    await expect(rawRequest('/api/v1/users', { method: 'POST', body: '{}' })).rejects.toMatchObject(
      { code: 'CSRF_VALIDATION_FAILED' },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readCsrfCookie()).toBe('csrf_token=stale-value');
  });
});
