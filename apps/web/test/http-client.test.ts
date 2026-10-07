import { afterEach, describe, expect, it, vi } from 'vitest';

import { rawRequest } from '@/lib/http/client';

describe('http client', () => {
  afterEach(() => {
    document.cookie = 'csrf_token=; Max-Age=0; path=/';
    vi.unstubAllGlobals();
  });

  it('copies the readable CSRF cookie into unsafe request headers', async () => {
    document.cookie = 'csrf_token=csrf-value; path=/';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null })));
    vi.stubGlobal('fetch', fetchMock);

    await rawRequest('/api/v1/auth/login', { method: 'POST', body: '{}' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);

    expect(headers.get('x-csrf-token')).toBe('csrf-value');
  });
});
